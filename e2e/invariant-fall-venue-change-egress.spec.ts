import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE the run module + route read it (all reads are lazy/at-call).
process.env.NOTION_API_KEY = "ntn_test_venuechange";
process.env.NOTION_FALL_REGS_DB_ID = "venue-change-regs-db";
process.env.RESEND_API_KEY = "re_test_venuechange";
process.env.NGA_ADMIN_SECRET = "venue-change-egress-secret";

import { runFallVenueChangeNotice } from "../src/lib/fall-venue-change-run";
import { POST as noticePOST } from "../src/app/api/fall-venue-change/route";

// THE venue-change invariants. This notice goes to families who have PAID, so
// the failure modes that matter are: mailing someone who was refunded, mailing
// a family twice for two kids, leaking a child's data to Resend, and sending
// anything at all on a dry run.
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];

const CONFIRMED_EMAIL = "confirmed@venuechange.org";
const SECOND_KID_EMAIL = CONFIRMED_EMAIL; // same family, second registration
const OTHER_EMAIL = "other@venuechange.org";
const REFUNDED_EMAIL = "refunded@venuechange.org";
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";

// A real row carries child fields — first name, birth year, allergies. They are
// present in every fixture ON PURPOSE: the egress assertions below only mean
// something if the data the engine must not forward is actually in the payload.
const CHILD_NAME = "Rosalind";
const ALLERGY = "peanut allergy — carries an EpiPen";

let rowSeq = 0;
function regRow(
  email: string,
  parentName: string,
  status = "Confirmed",
  childFirstName = CHILD_NAME,
) {
  return {
    id: `reg-${++rowSeq}`,
    properties: {
      "Child First Name": { rich_text: [{ plain_text: childFirstName }] },
      "Child Birth Year": { number: 2014 },
      Allergies: { rich_text: [{ plain_text: ALLERGY }] },
      "Emergency Name": { rich_text: [{ plain_text: "Aunt Meg" }] },
      "Emergency Phone": { phone_number: "240-555-0134" },
      "Parent Name": { rich_text: [{ plain_text: parentName }] },
      "Parent Email": { email },
      Group: { select: { name: "Green" } },
      Status: { select: { name: status } },
    },
  };
}

function installWorld(stub: FetchStub, rows?: unknown[]) {
  stub
    .on("databases/venue-change-regs-db/query", {
      results: rows ?? [regRow(CONFIRMED_EMAIL, "Dana Fields")],
      has_more: false,
    })
    .on("api.resend.com", { id: "email_test" })
    .install();
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  rowSeq = 0;
});
test.afterEach(() => stub.uninstall());

function resendSends() {
  return stub.calls.filter((c) => c.url.includes("api.resend.com"));
}

test.describe("fall venue-change — egress", () => {
  test("reaches only Notion + Resend", async () => {
    installWorld(stub);
    await runFallVenueChangeNotice({});

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }
  });

  test("a dry run previews with ZERO sends", async () => {
    installWorld(stub);
    const res = await runFallVenueChangeNotice({ dryRun: true });

    expect(res.ok).toBe(true);
    expect(resendSends()).toHaveLength(0);
    if (res.ok && res.dryRun) {
      expect(res.recipients).toEqual([CONFIRMED_EMAIL]);
      expect(res.to_send).toBe(1);
    }
  });

  test("the engine never writes to Notion — this notice reads only", async () => {
    installWorld(stub);
    await runFallVenueChangeNotice({});

    const writes = stub.calls.filter(
      (c) =>
        c.url.includes("api.notion.com") &&
        (c.method === "PATCH" ||
          (c.method === "POST" && !c.url.includes("/query"))),
    );
    expect(writes, "venue-change must not mutate any Notion row").toHaveLength(
      0,
    );
  });
});

test.describe("fall venue-change — no child data leaves with the email", () => {
  test("no child name, birth year, allergy or emergency contact reaches Resend", async () => {
    installWorld(stub);
    await runFallVenueChangeNotice({});

    const sends = resendSends();
    expect(sends.length).toBeGreaterThan(0);
    for (const send of sends) {
      expect(send.body).not.toContain(CHILD_NAME);
      expect(send.body).not.toContain(ALLERGY);
      expect(send.body).not.toContain("Aunt Meg");
      expect(send.body).not.toContain("240-555-0134");
      expect(send.body).not.toContain("2014");
    }
  });

  test("the parent is the recipient, and admin is BCC — never CC", async () => {
    installWorld(stub);
    await runFallVenueChangeNotice({});

    const send = resendSends()[0]!;
    const payload = JSON.parse(send.body);
    expect(payload.to).toBe(CONFIRMED_EMAIL);
    expect(payload.bcc).toBe(ADMIN_EMAIL);
    expect(payload.cc).toBeUndefined();
    expect(payload.reply_to ?? payload.replyTo).toBe(ADMIN_EMAIL);
  });
});

test.describe("fall venue-change — audience", () => {
  test("a refunded or cancelled seat is never mailed", async () => {
    installWorld(stub, [
      regRow(CONFIRMED_EMAIL, "Dana Fields", "Confirmed"),
      regRow(REFUNDED_EMAIL, "Gone Family", "Refunded"),
      regRow(OTHER_EMAIL, "Cancelled Family", "Cancelled"),
    ]);
    await runFallVenueChangeNotice({});

    const bodies = resendSends().map((s) => s.body).join("|");
    expect(bodies).toContain(CONFIRMED_EMAIL);
    expect(bodies).not.toContain(REFUNDED_EMAIL);
    expect(bodies).not.toContain(OTHER_EMAIL);
  });

  test("client-side filter still holds if the Notion query filter drifts", async () => {
    // Model a drifted/ignored server-side filter: the query returns everything.
    // The engine must still refuse to mail the non-Confirmed rows.
    installWorld(stub, [
      regRow(CONFIRMED_EMAIL, "Dana Fields", "Confirmed"),
      regRow(REFUNDED_EMAIL, "Gone Family", "Refunded"),
    ]);
    const res = await runFallVenueChangeNotice({ dryRun: true });

    if (res.ok && res.dryRun) {
      expect(res.scanned_rows).toBe(2);
      expect(res.confirmed_rows).toBe(1);
      expect(res.recipients).toEqual([CONFIRMED_EMAIL]);
    }
  });

  test("a two-kid family gets ONE email, not one per registration", async () => {
    installWorld(stub, [
      regRow(CONFIRMED_EMAIL, "Dana Fields", "Confirmed", "Rosalind"),
      regRow(SECOND_KID_EMAIL, "Dana Fields", "Confirmed", "Jasper"),
      regRow(OTHER_EMAIL, "Sam Other", "Confirmed", "Wren"),
    ]);
    const res = await runFallVenueChangeNotice({ dryRun: true });

    if (res.ok && res.dryRun) {
      expect(res.scanned_rows).toBe(3);
      expect(res.confirmed_rows).toBe(3);
      expect(res.to_send).toBe(2);
      expect(new Set(res.recipients)).toEqual(
        new Set([CONFIRMED_EMAIL, OTHER_EMAIL]),
      );
    }
  });

  test("addresses fold case-insensitively so one family is one email", async () => {
    installWorld(stub, [
      regRow("Dana@VenueChange.org", "Dana Fields", "Confirmed"),
      regRow("dana@venuechange.org", "Dana Fields", "Confirmed"),
    ]);
    const res = await runFallVenueChangeNotice({ dryRun: true });
    if (res.ok && res.dryRun) expect(res.to_send).toBe(1);
  });

  test("`only` restricts a retry to the named addresses", async () => {
    installWorld(stub, [
      regRow(CONFIRMED_EMAIL, "Dana Fields", "Confirmed"),
      regRow(OTHER_EMAIL, "Sam Other", "Confirmed"),
    ]);
    await runFallVenueChangeNotice({ only: [OTHER_EMAIL] });

    const bodies = resendSends().map((s) => s.body).join("|");
    expect(bodies).toContain(OTHER_EMAIL);
    expect(bodies).not.toContain(CONFIRMED_EMAIL);
  });

  test("a failed audience query fails the run rather than mailing nobody quietly", async () => {
    stub
      .on("databases/venue-change-regs-db/query", { message: "boom" }, 500)
      .on("api.resend.com", { id: "email_test" })
      .install();

    const res = await runFallVenueChangeNotice({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("audience_query_failed");
    expect(resendSends()).toHaveLength(0);
  });
});

test.describe("fall venue-change route — secret gate", () => {
  function req(url: string, body: unknown = {}) {
    return new NextRequest(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  test("no secret → 401 and nothing sent", async () => {
    installWorld(stub);
    const res = await noticePOST(
      req("https://nextgenpbacademy.com/api/fall-venue-change"),
    );
    expect(res.status).toBe(401);
    expect(resendSends()).toHaveLength(0);
  });

  test("wrong secret → 401 and nothing sent", async () => {
    installWorld(stub);
    const res = await noticePOST(
      req("https://nextgenpbacademy.com/api/fall-venue-change?secret=nope"),
    );
    expect(res.status).toBe(401);
    expect(resendSends()).toHaveLength(0);
  });

  test("correct secret with ?dryRun=1 → 200 and still nothing sent", async () => {
    installWorld(stub);
    const res = await noticePOST(
      req(
        "https://nextgenpbacademy.com/api/fall-venue-change?secret=venue-change-egress-secret&dryRun=1",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(resendSends()).toHaveLength(0);
  });
});
