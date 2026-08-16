import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE the run module + routes read it (all reads are lazy/at-call).
// Distinct DB ids so the stub can tell the two audience queries apart.
process.env.NOTION_API_KEY = "ntn_test_fallpoll";
process.env.NOTION_NEWSLETTER_DB_ID = "poll-newsletter-db";
process.env.NOTION_PLAYER_CRM_DB_ID = "poll-crm-db";
process.env.RESEND_API_KEY = "re_test_fallpoll";
process.env.NGA_ADMIN_SECRET = "fall-poll-egress-secret";
process.env.FALL_POLL_SECRET = "fall-poll-egress-signing";

import { runFallPollOutreach } from "../src/lib/fall-poll-run";
import { POST as outreachPOST } from "../src/app/api/fall-poll-outreach/route";
import { GET as pollGET, POST as pollPOST } from "../src/app/api/fall-poll/route";
import { signFallPollToken } from "../src/lib/fall-poll-token";

// THE fall-poll invariants. The blast may reach ONLY Notion (audience reads)
// and Resend (sends); the click capture may reach ONLY Notion, and only from
// the POST leg — a GET (what a mail scanner prefetches) must never write.
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];

const ACTIVE_EMAIL = "activefam@egresspoll.org";
const SECOND_EMAIL = "secondfam@egresspoll.org";
const LEAD_EMAIL = "leadonly@egresspoll.org";
const QUAR_EMAIL = "quarfam@egresspoll.org";
const UNSUB_EMAIL = "unsubfam@egresspoll.org";
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";

let rowSeq = 0;
function crmRow(
  email: string,
  name: string,
  over: Record<string, unknown> = {},
) {
  return {
    id: `crm-${++rowSeq}`,
    properties: {
      "Player Name": { title: [{ plain_text: "Kid" }] },
      "Parent Name": { rich_text: [{ plain_text: name }] },
      "Parent Email": { email },
      Status: { select: { name: "Active" } },
      Quarantine: { checkbox: false },
      ...over,
    },
  };
}

function unsubRow(email: string) {
  return {
    id: `sub-${email}`,
    properties: {
      Email: { email },
      Status: { select: { name: "Unsubscribed" } },
    },
  };
}

function installWorld(
  stub: FetchStub,
  opts: { crm?: unknown[]; unsubscribed?: unknown[] } = {},
) {
  stub
    .on("databases/poll-crm-db/query", {
      results: opts.crm ?? [crmRow(ACTIVE_EMAIL, "Active Fam")],
      has_more: false,
    })
    .on("databases/poll-newsletter-db/query", {
      results: opts.unsubscribed ?? [],
      has_more: false,
    })
    .on("v1/pages/", {})
    .on("api.resend.com", { id: "email_test" })
    .install();
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("fall-poll blast — egress + audience", () => {
  test("reaches only Notion + Resend", async () => {
    installWorld(stub);
    await runFallPollOutreach({});

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }
  });

  test("a dry run previews with ZERO sends", async () => {
    installWorld(stub);
    const result = await runFallPollOutreach({ dryRun: true });

    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result && result.dryRun) {
      expect(result.to_send).toBe(1);
      expect(result.recipients[0].email).toBe(ACTIVE_EMAIL);
    }
  });

  test("a lead-only family (no Active row) is not mailed", async () => {
    installWorld(stub, {
      crm: [
        crmRow(ACTIVE_EMAIL, "Active Fam"),
        crmRow(LEAD_EMAIL, "Lead Fam", { Status: { select: { name: "Lead" } } }),
      ],
    });
    const result = await runFallPollOutreach({ dryRun: true });

    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result && result.dryRun) {
      const emails = result.recipients.map((r) => r.email);
      expect(emails).toContain(ACTIVE_EMAIL);
      expect(emails).not.toContain(LEAD_EMAIL);
    }
  });

  test("one Quarantine tick anywhere in the family suppresses it — even with a clean Active row", async () => {
    installWorld(stub, {
      crm: [
        crmRow(ACTIVE_EMAIL, "Active Fam"),
        crmRow(QUAR_EMAIL, "Quar Fam"),
        crmRow(QUAR_EMAIL, "Quar Fam dupe", {
          Status: { select: { name: "Inactive" } },
          Quarantine: { checkbox: true },
        }),
      ],
    });
    const result = await runFallPollOutreach({ dryRun: true });

    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result && result.dryRun) {
      const emails = result.recipients.map((r) => r.email);
      expect(emails).toContain(ACTIVE_EMAIL);
      expect(emails).not.toContain(QUAR_EMAIL);
      expect(result.quarantined_excluded).toBe(1);
    }
  });

  test("a newsletter unsubscribe suppresses the poll too", async () => {
    installWorld(stub, {
      crm: [crmRow(ACTIVE_EMAIL, "Active Fam"), crmRow(UNSUB_EMAIL, "Unsub Fam")],
      unsubscribed: [unsubRow(UNSUB_EMAIL)],
    });
    const result = await runFallPollOutreach({ dryRun: true });

    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result && result.dryRun) {
      const emails = result.recipients.map((r) => r.email);
      expect(emails).not.toContain(UNSUB_EMAIL);
      expect(result.unsubscribed_excluded).toBe(1);
    }
  });

  test("an opt-out list that can't be read fails the run — never a short suppression list", async () => {
    stub
      .on("databases/poll-crm-db/query", {
        results: [crmRow(ACTIVE_EMAIL, "Active Fam")],
        has_more: false,
      })
      .on("databases/poll-newsletter-db/query", { object: "error" }, 500)
      .on("api.resend.com", { id: "email_test" })
      .install();

    const result = await runFallPollOutreach({});
    expect(result).toMatchObject({ ok: false, reason: "audience_query_failed" });
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });

  test("a multi-row family is mailed once", async () => {
    installWorld(stub, {
      crm: [
        crmRow(ACTIVE_EMAIL, "Active Fam"),
        crmRow(ACTIVE_EMAIL.toUpperCase(), "Active Fam dupe"),
      ],
    });
    await runFallPollOutreach({});

    // One recipient send + the counts-only admin QA copy.
    expect(stub.callsTo("api.resend.com")).toHaveLength(2);
  });

  test("every live send carries the three signed one-click links", async () => {
    installWorld(stub);
    await runFallPollOutreach({});

    const send = stub.callsTo("api.resend.com")[0];
    for (const action of ["in", "interested", "out"]) {
      expect(send.body).toContain(`/api/fall-poll?action=${action}&token=`);
    }
  });

  test("the admin QA copy is counts-only — no recipient addresses", async () => {
    installWorld(stub, {
      crm: [crmRow(ACTIVE_EMAIL, "Active Fam"), crmRow(SECOND_EMAIL, "Second Fam")],
    });
    await runFallPollOutreach({});

    const sends = stub.callsTo("api.resend.com");
    const qa = sends[sends.length - 1];
    expect(qa.body).toContain(ADMIN_EMAIL);
    expect(qa.body).not.toContain(ACTIVE_EMAIL);
    expect(qa.body).not.toContain(SECOND_EMAIL);
  });

  test("`only` narrows a re-run", async () => {
    installWorld(stub);
    await runFallPollOutreach({ only: ["nobody@egresspoll.org"] });

    // Nothing to a recipient; only the admin QA copy.
    expect(stub.callsTo("api.resend.com")).toHaveLength(1);
  });

  test("a malformed `only` fails loud rather than widening the send", async () => {
    installWorld(stub);
    const result = await runFallPollOutreach({
      only: [42] as unknown as string[],
    });
    expect(result.ok).toBe(false);
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });

  test("a live run refuses when RESEND is unconfigured", async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    installWorld(stub);
    try {
      const result = await runFallPollOutreach({});
      expect(result).toMatchObject({ ok: false, reason: "resend_unconfigured" });
      expect(stub.callsTo("api.resend.com")).toHaveLength(0);
    } finally {
      process.env.RESEND_API_KEY = saved;
    }
  });

  test("linksOnly returns signed links per family and sends NOTHING", async () => {
    installWorld(stub);
    const result = await runFallPollOutreach({ linksOnly: true });

    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result && result.dryRun) {
      expect(result.links).toHaveLength(1);
      expect(result.links![0].email).toBe(ACTIVE_EMAIL);
      expect(result.links![0].inUrl).toContain("/api/fall-poll?action=in&token=");
    }
  });
});

test.describe("fall-poll outreach route — secret gate fails closed", () => {
  function req(search: string, body: unknown = {}): NextRequest {
    return new NextRequest(`http://localhost/api/fall-poll-outreach${search}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  test("no secret → 401 with zero network calls", async () => {
    stub.install();
    const res = await outreachPOST(req(""));
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("wrong secret → 401 with zero network calls", async () => {
    stub.install();
    const res = await outreachPOST(req("?secret=nope"));
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("the correct secret reaches the engine", async () => {
    installWorld(stub);
    const res = await outreachPOST(
      req(`?secret=${process.env.NGA_ADMIN_SECRET}`, { dryRun: true }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, dryRun: true });
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });
});

test.describe("fall-poll click capture — GET never writes, POST writes only to the CRM", () => {
  function getReq(action: string, token: string): NextRequest {
    return new NextRequest(
      `http://localhost/api/fall-poll?action=${action}&token=${encodeURIComponent(token)}`,
    );
  }

  function postReq(action: string, token: string): NextRequest {
    const form = new URLSearchParams({ action, token });
    return new NextRequest("http://localhost/api/fall-poll", {
      method: "POST",
      body: form.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
  }

  test("a valid GET (what a mail scanner prefetches) renders the confirm page with ZERO network calls", async () => {
    stub.install();
    const token = signFallPollToken(ACTIVE_EMAIL, "in")!;
    const res = await pollGET(getReq("in", token));

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Confirm my answer");
    expect(stub.calls).toHaveLength(0);
  });

  // Egress from the POST leg widened deliberately when send-on-confirm landed:
  // an IN answer now also mails the registration link (Resend). Notion + Resend
  // is the whole allowed set — nothing else, and never from the GET leg.
  test("a confirmed POST records the answer on every family row — Notion + Resend only", async () => {
    installWorld(stub, {
      crm: [crmRow(ACTIVE_EMAIL, "Active Fam"), crmRow(ACTIVE_EMAIL, "Dupe row")],
    });
    const token = signFallPollToken(ACTIVE_EMAIL, "in")!;
    const res = await pollPOST(postReq("in", token));

    expect(res.status).toBe(200);
    for (const call of stub.calls) {
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(
        new URL(call.url).host,
      );
    }
    const patches = stub.calls.filter((c) => c.method === "PATCH");
    expect(patches).toHaveLength(2);
    for (const patch of patches) {
      expect(patch.body).toContain("Fall 2026 Poll");
      expect(patch.body).toContain('"In"');
    }
    // One family, one registration link — not one per row.
    expect(stub.callsTo("api.resend.com")).toHaveLength(1);
  });

  test("a confirmed OUT records the answer and mails NOTHING", async () => {
    installWorld(stub, { crm: [crmRow(ACTIVE_EMAIL, "Active Fam")] });
    const token = signFallPollToken(ACTIVE_EMAIL, "out")!;
    const res = await pollPOST(postReq("out", token));

    expect(res.status).toBe(200);
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });

  test("a token minted for one answer cannot be posted as another", async () => {
    stub.install();
    const token = signFallPollToken(ACTIVE_EMAIL, "in")!;
    const res = await pollPOST(postReq("out", token));

    expect(await res.text()).toContain("Link not valid");
    expect(stub.calls).toHaveLength(0);
  });

  test("an invalid token records nothing", async () => {
    stub.install();
    const res = await pollPOST(postReq("in", "garbage.token"));

    expect(await res.text()).toContain("Link not valid");
    expect(stub.calls).toHaveLength(0);
  });
});
