import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE importing the routes/libs under test (module-level constants read
// these at import time — LEAD_DB_ID in lead-outreach-run reads NOTION_DB_ID).
process.env.NGA_ADMIN_SECRET = "test-ops-secret";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_DB_ID = "lead-db";
process.env.NOTION_SESSIONS_DB_ID = "sessions-db";
process.env.RESEND_API_KEY = "re_test";

import { POST as evalReengagementRoute } from "../src/app/api/eval-reengagement/route";
import { POST as campOutreachRoute } from "../src/app/api/camp-outreach/route";
import { POST as postEvalFollowupRoute } from "../src/app/api/post-eval-followup/route";
import {
  runEvalReengagement,
  runCampOutreach,
} from "../src/lib/lead-outreach-run";
import { runPostEvalFollowup } from "../src/lib/post-eval-followup-run";

// Phase 2b trigger-parity invariant (mirrors
// invariant-eval-confirmation-trigger-parity.spec.ts): each curl-with-secret
// ops endpoint — eval-reengagement, post-eval-followup, camp-outreach — now has
// TWO equal-trust entry points that must produce IDENTICAL candidate
// segmentation and fan-out:
//   1. the secret-gated POST route (operator/agent curl, unchanged behavior),
//   2. the coach-ops server action (src/app/coach/(authed)/ops/actions.ts),
//      a thin requireCoach wrapper over the SAME shared core with no fan-out
//      of its own — so pinning route === core pins route === coach action.
// The load-bearing guarantee: OFF-LIMITS (DD-derived / quarantined) contacts
// must NEVER be emailable from EITHER path, and camp-outreach's
// eligible/ambiguous/off_limits buckets must come out identical whichever
// door the send goes through (default = eligible-only).

// ---------------------------------------------------------------------------
// Lead-CRM fixture rows spanning every segmentation bucket.
// (@example.org, not @example.com — the latter is filtered as a QA address.)
// ---------------------------------------------------------------------------

function leadPage(o: {
  name: string;
  email: string;
  source?: string;
  quarantine?: boolean;
  crEvents?: number;
}) {
  return {
    id: `lead-${o.email}`,
    properties: {
      "Parent Name": { rich_text: [{ plain_text: o.name }] },
      "Parent Email": { email: o.email },
      Source: { select: o.source ? { name: o.source } : null },
      "CR Events Attended": { number: o.crEvents ?? null },
      "CR Event History": { rich_text: [] },
      "Last CR Event": { rich_text: [] },
      Season: { select: null },
      Notes: { rich_text: [] },
      Quarantine: { checkbox: o.quarantine ?? false },
    },
  };
}

const ELIGIBLE_EMAILS = ["amy@example.org", "ben@example.org"];
const AMBIGUOUS_EMAIL = "cara@example.org";
const OFF_LIMITS_EMAILS = [
  "dana@example.org", // Source=CourtReserve (DD-derived)
  "evan@example.org", // Quarantine checked (opted out)
  "fay@example.org", // CR events attended (DD-derived)
];

const LEAD_ROWS = [
  leadPage({ name: "Amy Able", email: "amy@example.org", source: "Website" }),
  leadPage({ name: "Ben Baker", email: "ben@example.org", source: "Free Trial" }),
  leadPage({ name: "Cara Cole", email: AMBIGUOUS_EMAIL }), // blank source → ambiguous
  leadPage({ name: "Dana Dill", email: "dana@example.org", source: "CourtReserve" }),
  leadPage({ name: "Evan East", email: "evan@example.org", source: "Website", quarantine: true }),
  leadPage({ name: "Fay Ford", email: "fay@example.org", source: "Website", crEvents: 3 }),
  leadPage({ name: "Test Parent", email: "qa@example.org", source: "Website" }),
];

function stubLeadDb(stub: FetchStub) {
  stub
    .on("/databases/lead-db/query", { results: LEAD_ROWS, has_more: false })
    .on("api.resend.com", { id: "email_test" });
}

function req(
  path: string,
  body: unknown = {},
  query: Record<string, string> = {},
  secret: string | null = "test-ops-secret",
): NextRequest {
  const u = new URL(`http://localhost${path}`);
  if (secret !== null) u.searchParams.set("secret", secret);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return new NextRequest(u, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

/** Emails the run actually tried to send to, from recorded Resend calls. */
function resendRecipients(calls: RecordedFetch[]): string[] {
  return calls
    .filter((c) => c.url.includes("api.resend.com"))
    .map((c) => (JSON.parse(c.body) as { to: string }).to)
    .sort();
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

// ---------------------------------------------------------------------------
// eval-reengagement
// ---------------------------------------------------------------------------

test.describe("eval-reengagement — route ↔ ops-action core parity", () => {
  test("dryRun: route body === core body (identical segmentation, counts, recipients)", async () => {
    stubLeadDb(stub);
    const res = await evalReengagementRoute(
      req("/api/eval-reengagement", {}, { dryRun: "1" }),
    );
    expect(res.status).toBe(200);
    const routeBody = await res.json();

    stub.reset();
    stub.install();
    stubLeadDb(stub);
    const core = await runEvalReengagement({ dryRun: true });
    expect(core.status).toBe(200);

    expect(core.body).toEqual(routeBody);
    expect(routeBody.to_send).toBe(2);
    expect(routeBody.off_limits).toBe(3);
    expect(routeBody.ambiguous).toBe(1);
    expect(routeBody.test_excluded).toBe(1);
    const previewEmails = (
      routeBody.recipients as Array<{ email: string }>
    ).map((r) => r.email);
    expect(previewEmails.sort()).toEqual(ELIGIBLE_EMAILS);
    for (const email of [...OFF_LIMITS_EMAILS, AMBIGUOUS_EMAIL]) {
      expect(previewEmails, `${email} must not be previewed`).not.toContain(email);
    }
  });

  test("live: route and core mail the IDENTICAL eligible-only set; off-limits never mailed", async () => {
    stubLeadDb(stub);
    const res = await evalReengagementRoute(req("/api/eval-reengagement"));
    expect(res.status).toBe(200);
    const routeSent = resendRecipients(stub.calls);

    stub.reset();
    stub.install();
    stubLeadDb(stub);
    const core = await runEvalReengagement({});
    expect(core.status).toBe(200);
    const coreSent = resendRecipients(stub.calls);

    expect(routeSent).toEqual(ELIGIBLE_EMAILS);
    expect(coreSent, "route and ops-action mail the identical set").toEqual(routeSent);
    for (const email of OFF_LIMITS_EMAILS) {
      expect(routeSent, `OFF-LIMITS ${email} mailed via route`).not.toContain(email);
      expect(coreSent, `OFF-LIMITS ${email} mailed via ops action`).not.toContain(email);
    }
  });
});

// ---------------------------------------------------------------------------
// camp-outreach — the eligible/ambiguous/off_limits buckets especially
// ---------------------------------------------------------------------------

test.describe("camp-outreach — route ↔ ops-action core parity", () => {
  test("default (eligible-only) dryRun: route body === core body; ambiguous held, off-limits excluded", async () => {
    stubLeadDb(stub);
    const res = await campOutreachRoute(
      req("/api/camp-outreach", {}, { dryRun: "1" }),
    );
    expect(res.status).toBe(200);
    const routeBody = await res.json();

    stub.reset();
    stub.install();
    stubLeadDb(stub);
    const core = await runCampOutreach({ dryRun: true });
    expect(core.status).toBe(200);

    expect(core.body).toEqual(routeBody);
    expect(routeBody.includeAmbiguous).toBe(false);
    expect(routeBody.to_send).toBe(2);
    expect(routeBody.ambiguous_rows).toBe(1);
    expect(routeBody.off_limits).toBe(3);
    const previewEmails = (
      routeBody.recipients as Array<{ email: string }>
    ).map((r) => r.email);
    expect(previewEmails.sort()).toEqual(ELIGIBLE_EMAILS);
    expect(previewEmails).not.toContain(AMBIGUOUS_EMAIL);
  });

  test("includeAmbiguous dryRun: route (?includeAmbiguous=1) === core({includeAmbiguous:true}); off-limits STILL excluded", async () => {
    stubLeadDb(stub);
    const res = await campOutreachRoute(
      req("/api/camp-outreach", {}, { dryRun: "1", includeAmbiguous: "1" }),
    );
    expect(res.status).toBe(200);
    const routeBody = await res.json();

    stub.reset();
    stub.install();
    stubLeadDb(stub);
    const core = await runCampOutreach({ dryRun: true, includeAmbiguous: true });
    expect(core.status).toBe(200);

    expect(core.body).toEqual(routeBody);
    const previewEmails = (
      routeBody.recipients as Array<{ email: string }>
    ).map((r) => r.email);
    expect(previewEmails.sort()).toEqual(
      [...ELIGIBLE_EMAILS, AMBIGUOUS_EMAIL].sort(),
    );
    for (const email of OFF_LIMITS_EMAILS) {
      expect(
        previewEmails,
        `OFF-LIMITS ${email} leaked into the ambiguous send`,
      ).not.toContain(email);
    }
  });

  test("live: route and core mail the identical set; DD-derived/quarantined never mailed from either path", async () => {
    stubLeadDb(stub);
    const res = await campOutreachRoute(req("/api/camp-outreach"));
    expect(res.status).toBe(200);
    const routeSent = resendRecipients(stub.calls);

    stub.reset();
    stub.install();
    stubLeadDb(stub);
    const core = await runCampOutreach({});
    expect(core.status).toBe(200);
    const coreSent = resendRecipients(stub.calls);

    expect(routeSent).toEqual(ELIGIBLE_EMAILS);
    expect(coreSent).toEqual(routeSent);
    for (const email of OFF_LIMITS_EMAILS) {
      expect(routeSent).not.toContain(email);
      expect(coreSent).not.toContain(email);
    }
  });
});

// ---------------------------------------------------------------------------
// post-eval-followup — single-recipient op keyed by playerId
// ---------------------------------------------------------------------------

const PLAYER_BODY = { playerId: "player-1", level: "Green" as const };

function stubPlayer(stub: FetchStub) {
  stub
    // GET (fetchPlayer) and PATCH (updatePlayer) share this URL; the stub
    // response only matters for the GET.
    .on("/pages/player-1", {
      properties: {
        "Parent Email": { email: "parent@example.org" },
        "Parent Name": { rich_text: [{ plain_text: "Pat Parent" }] },
        "Player Name": { title: [{ plain_text: "Zoe P" }] },
      },
    })
    .on("/databases/sessions-db/query", { results: [], has_more: false })
    .on("api.resend.com", { id: "email_test" });
}

/** Order-independent fan-out signature for the post-eval flow. */
function postEvalSignature(calls: RecordedFetch[]): string[] {
  const sig: string[] = [];
  for (const c of calls) {
    if (c.url.includes("api.resend.com")) sig.push("email:resend");
    else if (/\/pages\/player-1/.test(c.url) && c.method === "PATCH")
      sig.push("notion:player-update");
    else if (/\/pages\/player-1/.test(c.url) && c.method === "GET")
      sig.push("notion:player-fetch");
    else if (/\/databases\/sessions-db\/query/.test(c.url))
      sig.push("notion:sessions-query");
  }
  return sig.sort();
}

test.describe("post-eval-followup — route ↔ ops-action core parity", () => {
  test("live: route fan-out === core fan-out (parent email + Notion player update)", async () => {
    stubPlayer(stub);
    const res = await postEvalFollowupRoute(
      req("/api/post-eval-followup", PLAYER_BODY),
    );
    expect(res.status).toBe(200);
    const routeSig = postEvalSignature(stub.calls);
    const routeSent = resendRecipients(stub.calls);

    stub.reset();
    stub.install();
    stubPlayer(stub);
    const core = await runPostEvalFollowup(PLAYER_BODY, {});
    expect(core.status).toBe(200);
    const coreSig = postEvalSignature(stub.calls);
    const coreSent = resendRecipients(stub.calls);

    expect(routeSig).toEqual([
      "email:resend",
      "notion:player-fetch",
      "notion:player-update",
      "notion:sessions-query",
    ]);
    expect(coreSig, "route and ops action fire identical triggers").toEqual(routeSig);
    expect(routeSent).toEqual(["parent@example.org"]);
    expect(coreSent).toEqual(routeSent);
  });

  test("dryRun: preview only — NO email, NO Notion player update, from either path", async () => {
    stubPlayer(stub);
    const res = await postEvalFollowupRoute(
      req("/api/post-eval-followup", PLAYER_BODY, { dryRun: "1" }),
    );
    expect(res.status).toBe(200);
    const routeBody = await res.json();
    expect(routeBody.dryRun).toBe(true);
    expect(resendRecipients(stub.calls), "no email on dryRun").toEqual([]);
    expect(
      stub.calls.find((c) => c.method === "PATCH"),
      "no Notion write on dryRun",
    ).toBeFalsy();

    stub.reset();
    stub.install();
    stubPlayer(stub);
    const core = await runPostEvalFollowup(PLAYER_BODY, { dryRun: true });
    expect(core.status).toBe(200);
    expect(core.body).toEqual(routeBody);
    expect(resendRecipients(stub.calls)).toEqual([]);
    expect(stub.calls.find((c) => c.method === "PATCH")).toBeFalsy();
  });

  test("validation parity: bad level → 400 from both paths, zero downstream", async () => {
    stubPlayer(stub);
    const res = await postEvalFollowupRoute(
      req("/api/post-eval-followup", { playerId: "player-1", level: "Purple" }),
    );
    expect(res.status).toBe(400);
    expect(stub.calls.length).toBe(0);

    const core = await runPostEvalFollowup(
      // Junk level, exactly as a route caller could send it.
      { playerId: "player-1", level: "Purple" } as unknown as Parameters<
        typeof runPostEvalFollowup
      >[0],
      {},
    );
    expect(core.status).toBe(400);
    expect(stub.calls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The routes keep their secret gates (the ops actions are cookie-authed via
// requireCoach; the invariant-eval-admin-gate spec pins two of these already —
// camp-outreach is pinned here).
// ---------------------------------------------------------------------------

test.describe("camp-outreach admin gate stays fail-closed after extraction", () => {
  test("no secret → 401, zero downstream calls", async () => {
    stubLeadDb(stub);
    stub.calls.length = 0;
    const res = await campOutreachRoute(
      req("/api/camp-outreach", {}, {}, null),
    );
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });
});
