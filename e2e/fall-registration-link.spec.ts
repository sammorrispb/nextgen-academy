import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE the modules under test read it (all reads are lazy/at-call).
process.env.NOTION_API_KEY = "ntn_test_fallreg";
process.env.NOTION_PLAYER_CRM_DB_ID = "reg-crm-db";
process.env.RESEND_API_KEY = "re_test_fallreg";
process.env.NGA_ADMIN_SECRET = "fall-reg-admin-secret";
process.env.FALL_POLL_SECRET = "fall-reg-signing-secret";

import {
  primaryParentEmail,
  recordFallPollResponse,
} from "../src/lib/notion-fall-poll";
import { signFallPollToken } from "../src/lib/fall-poll-token";
import { POST as pollPOST } from "../src/app/api/fall-poll/route";
import { runFallRegLinkOutreach } from "../src/lib/fall-reg-link-run";
import { POST as regLinkPOST } from "../src/app/api/fall-reg-link/route";
import {
  FALL_REGISTRATION_URL,
  fallRegistrationLinkHtml,
  fallRegistrationLinkText,
} from "../src/lib/email/fall-registration-link";
import {
  FALL_POLL_PRICE_USD,
  FALL_POLL_VENUE,
} from "../src/data/fall-poll-2026";

const CRM_QUERY = "databases/reg-crm-db/query";
const RESEND = "api.resend.com";

/** A CRM row carrying an existing Fall 2026 Poll answer (or none). */
let rowSeq = 0;
function crmRow(
  email: string,
  name: string,
  poll: "In" | "Interested" | "Out" | null,
) {
  return {
    id: `reg-crm-${++rowSeq}`,
    properties: {
      "Player Name": { title: [{ plain_text: name }] },
      "Parent Name": { rich_text: [{ plain_text: "Parent" }] },
      "Parent Email": { email },
      Status: { select: { name: "Active" } },
      "Fall 2026 Poll": poll ? { select: { name: poll } } : { select: null },
    },
  };
}

function postConfirm(action: "in" | "interested" | "out", email: string) {
  const token = signFallPollToken(email, action)!;
  const fd = new FormData();
  fd.set("action", action);
  fd.set("token", token);
  return pollPOST(
    new NextRequest("https://nextgenpbacademy.com/api/fall-poll", {
      method: "POST",
      body: fd,
    }),
  );
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

function installWorld(rows: unknown[]) {
  stub
    .on(CRM_QUERY, { results: rows, has_more: false })
    .on("v1/pages/", {})
    .on(RESEND, { id: "email_test" })
    .install();
}

test.describe("fall registration link — send-on-confirm transitions", () => {
  test("a first-time In (no prior answer) sends exactly one link", async () => {
    const email = "newfam@regspec.org";
    installWorld([crmRow(email, "Kid", null)]);

    await postConfirm("in", email);

    const sends = stub.callsTo(RESEND);
    expect(sends).toHaveLength(1);
    expect(sends[0].body).toContain(FALL_REGISTRATION_URL);
    expect(sends[0].body).toContain(email);
  });

  test("Out -> In sends (a real mind-change earns the link)", async () => {
    const email = "changedmind@regspec.org";
    installWorld([crmRow(email, "Kid", "Out")]);

    await postConfirm("in", email);

    expect(stub.callsTo(RESEND)).toHaveLength(1);
  });

  // THE idempotency guard. A parent re-tapping the same In link — or a second
  // device opening it — must not be mailed twice.
  test("In -> In sends NOTHING (re-tap is not a new answer)", async () => {
    const email = "retap@regspec.org";
    installWorld([crmRow(email, "Kid", "In")]);

    await postConfirm("in", email);

    expect(stub.callsTo(RESEND)).toHaveLength(0);
  });

  test("Out and Interested never send, whatever the prior answer", async () => {
    for (const action of ["out", "interested"] as const) {
      stub.reset();
      const email = `${action}@regspec.org`;
      installWorld([crmRow(email, "Kid", null)]);

      await postConfirm(action, email);

      expect(stub.callsTo(RESEND), `${action} must not send`).toHaveLength(0);
      stub.uninstall();
    }
  });

  test("a Resend failure still records the answer and still shows success", async () => {
    const email = "resendbroke@regspec.org";
    stub
      .on(CRM_QUERY, { results: [crmRow(email, "Kid", null)], has_more: false })
      .on("v1/pages/", {})
      .on(RESEND, { message: "boom" }, 500)
      .install();

    const res = await postConfirm("in", email);
    const html = await res.text();

    // The parent's answer IS recorded; a mail blip must not tell them otherwise.
    expect(res.status).toBe(200);
    expect(html).toContain("You're in!");
  });
});

test.describe("fall registration link — family folding", () => {
  // OBSERVED IN PROD: jeffwhitey@gmail.com owns three CRM rows (Spencer White,
  // Spencer white, "DELETE — Spencer white"). One tap must mean one email.
  test("a three-row family on one parent email gets exactly ONE send", async () => {
    const email = "threerows@regspec.org";
    installWorld([
      crmRow(email, "Spencer White", null),
      crmRow(email, "Spencer white", null),
      crmRow(email, "DELETE — Spencer white", null),
    ]);

    await postConfirm("in", email);

    expect(stub.callsTo(RESEND)).toHaveLength(1);
  });

  test("primaryParentEmail takes the FIRST address of a comma-joined cell", () => {
    expect(primaryParentEmail("a@x.com, b@y.com")).toBe("a@x.com");
    expect(primaryParentEmail(" A@X.com ,b@y.com")).toBe("a@x.com");
    expect(primaryParentEmail("solo@x.com")).toBe("solo@x.com");
    expect(primaryParentEmail("")).toBe("");
  });

  test("recordFallPollResponse reports the PRIOR answer", async () => {
    const email = "prior@regspec.org";
    installWorld([crmRow(email, "Kid", "Out")]);

    const result = await recordFallPollResponse(email, "in");

    expect(result.ok).toBe(true);
    expect(result.previous).toBe("out");
  });
});

test.describe("fall registration link — backfill engine", () => {
  test("a dry run previews with ZERO sends", async () => {
    installWorld([
      crmRow("one@regspec.org", "A", "In"),
      crmRow("two@regspec.org", "B", "In"),
      crmRow("nope@regspec.org", "C", "Out"),
    ]);

    const result = await runFallRegLinkOutreach({ dryRun: true });

    expect(stub.callsTo(RESEND)).toHaveLength(0);
    expect(result.ok).toBe(true);
    if (result.ok && result.dryRun) {
      expect(result.to_send).toBe(2);
      expect(result.recipients).not.toContain("nope@regspec.org");
    }
  });

  test("only In families are mailed, folded one-per-parent-email", async () => {
    installWorld([
      crmRow("dup@regspec.org", "Kid One", "In"),
      crmRow("dup@regspec.org", "Kid Two", "In"),
      crmRow("out@regspec.org", "Kid Three", "Out"),
    ]);

    const result = await runFallRegLinkOutreach({});

    expect(result.ok).toBe(true);
    expect(stub.callsTo(RESEND)).toHaveLength(1);
  });

  test("`only` restricts the send to the listed addresses", async () => {
    installWorld([
      crmRow("keep@regspec.org", "A", "In"),
      crmRow("skip@regspec.org", "B", "In"),
    ]);

    const result = await runFallRegLinkOutreach({
      dryRun: true,
      only: ["keep@regspec.org"],
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.dryRun) {
      expect(result.to_send).toBe(1);
      expect(result.recipients).toEqual(["keep@regspec.org"]);
    }
  });

  test("the admin route fails CLOSED without the right secret", async () => {
    installWorld([crmRow("x@regspec.org", "A", "In")]);

    for (const url of [
      "https://nextgenpbacademy.com/api/fall-reg-link",
      "https://nextgenpbacademy.com/api/fall-reg-link?secret=wrong",
    ]) {
      const res = await regLinkPOST(
        new NextRequest(url, {
          method: "POST",
          body: JSON.stringify({ dryRun: true }),
          headers: { "content-type": "application/json" },
        }),
      );
      expect(res.status).toBe(401);
    }
    expect(stub.callsTo(RESEND)).toHaveLength(0);
  });
});

test.describe("fall registration link — template", () => {
  test("renders the real season terms and the /fall link in both parts", () => {
    const html = fallRegistrationLinkHtml({ firstName: "Dana" });
    const text = fallRegistrationLinkText({ firstName: "Dana" });

    for (const part of [html, text]) {
      expect(part).toContain(FALL_REGISTRATION_URL);
      expect(part).toContain(String(FALL_POLL_PRICE_USD));
      expect(part).toContain(FALL_POLL_VENUE);
      expect(part).toContain("Dana");
    }
  });

  test("is pure — renders with no network at all", () => {
    stub.install(); // every unstubbed fetch throws
    expect(() => fallRegistrationLinkHtml({ firstName: "Dana" })).not.toThrow();
    expect(stub.calls).toHaveLength(0);
  });
});
