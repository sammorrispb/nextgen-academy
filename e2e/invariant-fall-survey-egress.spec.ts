import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE the run module + route read it (all reads are lazy/at-call).
// Distinct DB ids so the stub can tell the two audience queries apart.
process.env.NOTION_API_KEY = "ntn_test_fall";
process.env.NOTION_NEWSLETTER_DB_ID = "newsletter-db";
process.env.NOTION_PLAYER_CRM_DB_ID = "crm-db";
process.env.RESEND_API_KEY = "re_test_fall";
process.env.NGA_ADMIN_SECRET = "fall-survey-test-secret";
process.env.NEWSLETTER_UNSUB_SECRET = "fall-unsub-test-secret";

import { runFallSurvey } from "../src/lib/fall-survey-run";
import { POST } from "../src/app/api/fall-survey/route";

// THE fall-survey blast invariant. The broadcast is adult-to-adult marketing:
// it may reach ONLY Notion (reading the two audience lists) and Resend
// (sending). It carries no child data at all. The segmentation rules that keep
// DD-derived and opted-out leads off the list are enforced upstream in
// classifyLead — this spec pins that they actually hold on this surface.
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];

// Lead-CRM addresses deliberately avoid @example.com and the word "test":
// isTestOrInternal() strips both as QA rows before classifyLead ever runs, so
// example.com fixtures would make every segmentation assertion below vacuous.
const SUBSCRIBER_EMAIL = "subscriber@egressfall.org";
const CLEAN_LEAD_EMAIL = "cleanlead@egressfall.org";
const QUARANTINED_EMAIL = "quarantined@egressfall.org";
const DD_EMAIL = "ddlead@egressfall.org";
const AMBIGUOUS_EMAIL = "ambiguous@egressfall.org";
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";

function subscriberRow(email: string, name: string) {
  return {
    id: `sub-${email}`,
    properties: {
      "Parent Name": { title: [{ plain_text: name }] },
      Email: { email },
      Status: { select: { name: "Active" } },
      "Referral Token": { rich_text: [] },
    },
  };
}

function leadRow(
  email: string,
  name: string,
  over: Record<string, unknown> = {},
) {
  return {
    id: `lead-${email}`,
    properties: {
      "Parent Name": { title: [{ plain_text: name }] },
      "Parent Email": { email },
      Source: { select: { name: "Website" } },
      "CR Events Attended": { number: null },
      "CR Event History": { rich_text: [] },
      "Last CR Event": { rich_text: [] },
      Season: { select: null },
      Notes: { rich_text: [] },
      Quarantine: { checkbox: false },
      ...over,
    },
  };
}

/** Both audience lists, wired to the stub. */
function installAudience(
  stub: FetchStub,
  opts: { subscribers?: unknown[]; leads?: unknown[] } = {},
) {
  stub
    .on("databases/newsletter-db/query", {
      results: opts.subscribers ?? [subscriberRow(SUBSCRIBER_EMAIL, "Sub Scriber")],
      has_more: false,
    })
    .on("databases/crm-db/query", {
      results: opts.leads ?? [leadRow(CLEAN_LEAD_EMAIL, "Clean Lead")],
      has_more: false,
    })
    .on("api.resend.com", { id: "email_test" })
    .install();
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("fall survey blast — egress", () => {
  test("reaches only Notion + Resend", async () => {
    installAudience(stub);
    await runFallSurvey({ variant: "nga" });

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }
  });

  test("a dry run previews with ZERO network sends", async () => {
    // Audience reads still happen (that's the point of a preview) — but nothing
    // may reach Resend.
    installAudience(stub);
    const result = await runFallSurvey({ variant: "nga", dryRun: true });

    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result && result.dryRun) {
      expect(result.to_send).toBe(2);
      const emails = result.recipients.map((r) => r.email).sort();
      expect(emails).toEqual([CLEAN_LEAD_EMAIL, SUBSCRIBER_EMAIL].sort());
    }
  });

  test("a quarantined lead is never mailed", async () => {
    installAudience(stub, {
      subscribers: [],
      leads: [
        leadRow(CLEAN_LEAD_EMAIL, "Clean Lead"),
        leadRow(QUARANTINED_EMAIL, "Opted Out", {
          Quarantine: { checkbox: true },
        }),
      ],
    });
    const result = await runFallSurvey({ variant: "nga", dryRun: true });

    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result && result.dryRun) {
      const emails = result.recipients.map((r) => r.email);
      expect(emails).toContain(CLEAN_LEAD_EMAIL);
      expect(emails).not.toContain(QUARANTINED_EMAIL);
    }
  });

  test("a DD/CourtReserve-derived lead is never mailed", async () => {
    installAudience(stub, {
      subscribers: [],
      leads: [
        leadRow(CLEAN_LEAD_EMAIL, "Clean Lead"),
        leadRow(DD_EMAIL, "DD Lead", {
          Source: { select: { name: "CourtReserve" } },
        }),
      ],
    });
    const result = await runFallSurvey({ variant: "nga", dryRun: true });

    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result && result.dryRun) {
      const emails = result.recipients.map((r) => r.email);
      expect(emails).toContain(CLEAN_LEAD_EMAIL);
      expect(emails).not.toContain(DD_EMAIL);
    }
  });

  test("an ambiguous-source lead is never mailed", async () => {
    installAudience(stub, {
      subscribers: [],
      leads: [
        leadRow(AMBIGUOUS_EMAIL, "Ambiguous Lead", {
          Source: { select: null },
        }),
      ],
    });
    const result = await runFallSurvey({ variant: "nga", dryRun: true });

    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result && result.dryRun) {
      expect(result.recipients).toHaveLength(0);
    }
  });

  test("someone on BOTH lists is mailed once", async () => {
    installAudience(stub, {
      subscribers: [subscriberRow(CLEAN_LEAD_EMAIL, "Sub Scriber")],
      leads: [leadRow(CLEAN_LEAD_EMAIL.toUpperCase(), "Clean Lead")],
    });
    await runFallSurvey({ variant: "nga" });

    const sends = stub.callsTo("api.resend.com");
    // One recipient send + the counts-only admin QA copy.
    expect(sends).toHaveLength(2);
  });

  test("only newsletter recipients get an unsubscribe link", async () => {
    installAudience(stub, {
      subscribers: [subscriberRow(SUBSCRIBER_EMAIL, "Sub Scriber")],
      leads: [leadRow(CLEAN_LEAD_EMAIL, "Clean Lead")],
    });
    await runFallSurvey({ variant: "nga" });

    const sends = stub.callsTo("api.resend.com");
    const toSubscriber = sends.find((s) => s.body.includes(SUBSCRIBER_EMAIL));
    const toLead = sends.find((s) => s.body.includes(CLEAN_LEAD_EMAIL));
    expect(toSubscriber?.body).toContain("/api/newsletter/unsubscribe");
    expect(toLead?.body).not.toContain("/api/newsletter/unsubscribe");
  });

  test("the admin QA copy is counts-only — no recipient addresses", async () => {
    installAudience(stub);
    await runFallSurvey({ variant: "nga" });

    const sends = stub.callsTo("api.resend.com");
    const qa = sends[sends.length - 1];
    expect(qa.body).toContain(ADMIN_EMAIL);
    expect(qa.body).not.toContain(SUBSCRIBER_EMAIL);
    expect(qa.body).not.toContain(CLEAN_LEAD_EMAIL);
  });

  test("`only` narrows a re-run", async () => {
    installAudience(stub);
    await runFallSurvey({ variant: "nga", only: ["nobody@example.com"] });

    const sends = stub.callsTo("api.resend.com");
    // Nothing to a recipient; only the admin QA copy.
    expect(sends).toHaveLength(1);
    expect(sends[0].body).toContain(ADMIN_EMAIL);
  });

  test("a malformed `only` fails loud rather than widening the send", async () => {
    installAudience(stub);
    const result = await runFallSurvey({
      variant: "nga",
      only: [42] as unknown as string[],
    });
    expect(result.ok).toBe(false);
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });

  test("a live run refuses when RESEND is unconfigured", async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    installAudience(stub);
    try {
      const result = await runFallSurvey({ variant: "nga" });
      expect(result).toMatchObject({ ok: false, reason: "resend_unconfigured" });
      expect(stub.callsTo("api.resend.com")).toHaveLength(0);
    } finally {
      process.env.RESEND_API_KEY = saved;
    }
  });

  test("an unknown variant is refused before any send", async () => {
    installAudience(stub);
    const result = await runFallSurvey({
      variant: "everyone" as unknown as "nga",
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid_variant" });
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });
});

test.describe("fall survey route — secret gate fails closed", () => {
  function req(search: string, body: unknown = {}): NextRequest {
    return new NextRequest(`http://localhost/api/fall-survey${search}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  test("no secret → 401 with zero network calls", async () => {
    stub.install();
    const res = await POST(req(""));
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("wrong secret → 401 with zero network calls", async () => {
    stub.install();
    const res = await POST(req("?secret=nope"));
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("the correct secret reaches the engine", async () => {
    installAudience(stub);
    const res = await POST(
      req(`?secret=${process.env.NGA_ADMIN_SECRET}`, {
        dryRun: true,
        variant: "nga",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, dryRun: true });
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });
});
