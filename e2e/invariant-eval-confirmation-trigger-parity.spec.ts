import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE importing the route under test (the module + its libs read these
// at call time). NOTION_PLAYER_CRM_DB_ID drives the lead DB that setEvalDate
// queries (the legacy NOTION_DB_ID is no longer consulted for CRM targeting).
process.env.NGA_ADMIN_SECRET = "test-eval-secret";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_PLAYER_CRM_DB_ID = "lead-db";
delete process.env.NOTION_DB_ID;
process.env.NOTION_EVAL_SLOTS_DB_ID = "eval-slots-db";
process.env.RESEND_API_KEY = "re_test";

import { POST } from "../src/app/api/eval-confirmation/route";
import { sendEvalConfirmation } from "../src/lib/eval-confirmation-send";
import { confirmEvalRequest } from "../src/lib/notion-eval-slots";

// The free-eval confirmation has THREE equal-trust entry points that must fire
// the IDENTICAL fan-out — the coach-dashboard server action `confirmEvalAction`
// (src/app/coach/(authed)/eval/actions.ts), the secret-gated agent route
// POST /api/eval-confirmation, and (flow change 2026-07-02) the coach-authed
// eval-requests queue confirm (`confirmEvalRequest` core; the PUBLIC booking
// route no longer confirms — it files a Requested claim, pinned by
// invariant-eval-book-egress). All funnel through the one shared engine
// `sendEvalConfirmation` (src/lib/eval-confirmation-send.ts), whose fan-out is:
//   1. a Resend parent email,
//   2. carrying the .ics calendar attachment,
//   3. then a fail-soft Notion "Eval Date" CRM stamp (setEvalDate).
// confirmEvalAction is a thin 24h→12h time-format wrapper over the engine and
// adds NO fan-out of its own (actions.ts:55-67), so pinning route == engine
// pins route == coach action: neither path can silently drop a trigger. This is
// GAP-N3 from docs/audits/ui-agent-parity-nga.md — the engine was already
// shared; this is the missing trigger-parity pin (mirrors
// invariant-attendance-trigger-parity.spec.ts / invariant-crew-confirm-*).

// Far-future date: the eval-book claim path rejects past slots (F5), and the
// spec must stay deterministic under fixed fixtures.
const VALID_BODY = {
  parentEmail: "parent@example.com",
  parentFirst: "Pat",
  childFirst: "Kid",
  date: "2036-07-01",
  startTime: "10:00 AM",
  endTime: "10:45 AM",
  location: "Olney, MD",
};

function req(
  secret: string | undefined,
  body: unknown = VALID_BODY,
  query: Record<string, string> = {},
): NextRequest {
  const u = new URL("http://localhost/api/eval-confirmation");
  if (secret !== undefined) u.searchParams.set("secret", secret);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return new NextRequest(u, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

// Normalize a recorded fan-out to a stable, order-independent signature so the
// route's effects can be compared to the shared engine's effects.
function fanoutSignature(calls: RecordedFetch[]): string[] {
  const sig: string[] = [];
  for (const c of calls) {
    if (c.url.includes("api.resend.com")) {
      sig.push(c.body.includes("text/calendar") ? "email:resend+ics" : "email:resend");
    } else if (/\/databases\/lead-db\/query/.test(c.url)) {
      sig.push("notion:lead-query");
    } else if (/\/pages\//.test(c.url) && c.method === "PATCH" && c.body.includes('"Eval Date"')) {
      sig.push("notion:eval-stamp");
    }
  }
  return sig.sort();
}

function stubHappyPath(stub: FetchStub) {
  stub
    .on("api.resend.com", { id: "email_test" })
    .on("/databases/lead-db/query", { results: [{ id: "lead-1" }] })
    .on("api.notion.com/v1/pages", { id: "patched" });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("eval-confirmation route — secret gate (fail closed)", () => {
  test("no secret → 401, zero downstream calls", async () => {
    const res = await POST(req(undefined));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong secret → 401, zero downstream calls", async () => {
    const res = await POST(req("wrong-secret"));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("fails closed when NGA_ADMIN_SECRET is unset", async () => {
    const original = process.env.NGA_ADMIN_SECRET;
    try {
      delete process.env.NGA_ADMIN_SECRET;
      const res = await POST(req("anything"));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    } finally {
      process.env.NGA_ADMIN_SECRET = original;
    }
  });
});

test.describe("eval-confirmation route — trigger fan-out", () => {
  test("authorized send fans out to a Resend email WITH .ics + a Notion Eval-Date stamp", async () => {
    stubHappyPath(stub);

    const res = await POST(req("test-eval-secret"));
    expect(res.status).toBe(200);

    const email = stub.callsTo("api.resend.com");
    expect(email.length, "exactly one parent email").toBe(1);
    expect(email[0].body, ".ics calendar attachment present").toContain("text/calendar");
    expect(email[0].body, ".ics filename present").toContain("-eval-2036-07-01.ics");

    const stamp = stub.calls.find(
      (c) => c.method === "PATCH" && /\/pages\//.test(c.url) && c.body.includes('"Eval Date"'),
    );
    expect(stamp, "Notion Eval-Date CRM stamp").toBeTruthy();
  });

  test("dryRun → preview only: NO email, NO CRM stamp", async () => {
    stubHappyPath(stub);

    const res = await POST(req("test-eval-secret", VALID_BODY, { dryRun: "1" }));
    expect(res.status).toBe(200);
    expect(stub.callsTo("api.resend.com").length, "no email on dryRun").toBe(0);
    expect(
      stub.calls.find((c) => c.method === "PATCH"),
      "no Notion write on dryRun",
    ).toBeFalsy();
    expect(JSON.stringify(await res.json())).toContain('"dryRun":true');
  });

  test("validation failure (missing childFirst) → 400, zero downstream", async () => {
    stubHappyPath(stub);
    const res = await POST(req("test-eval-secret", { ...VALID_BODY, childFirst: "" }));
    expect(res.status).toBe(400);
    expect(stub.calls.length, "no email / no CRM write on bad input").toBe(0);
  });

  test("Resend failure → non-200 and NO CRM stamp (stamp only fires after a delivered email)", async () => {
    stub
      .on("api.resend.com", { name: "application_error", message: "boom" }, 500)
      .on("/databases/lead-db/query", { results: [{ id: "lead-1" }] })
      .on("api.notion.com/v1/pages", { id: "patched" });

    const res = await POST(req("test-eval-secret"));
    expect(res.status).not.toBe(200);
    expect(
      stub.calls.find((c) => c.method === "PATCH" && c.body.includes('"Eval Date"')),
      "no Eval-Date stamp when the email never delivered",
    ).toBeFalsy();
  });
});

test.describe("eval-confirmation — UI action ↔ agent route parity", () => {
  // Both entry points converge on sendEvalConfirmation; assert the route and the
  // shared engine (which confirmEvalAction wraps) produce the IDENTICAL fan-out.
  test("route fan-out === shared-engine fan-out (email+ics + CRM stamp)", async () => {
    stubHappyPath(stub);
    const res = await POST(req("test-eval-secret"));
    expect(res.status).toBe(200);
    const routeSig = fanoutSignature(stub.calls);

    stub.reset();
    stub.install();
    stubHappyPath(stub);
    const engineResult = await sendEvalConfirmation(VALID_BODY);
    expect(engineResult.ok).toBe(true);
    const engineSig = fanoutSignature(stub.calls);

    expect(routeSig).toEqual(["email:resend+ics", "notion:eval-stamp", "notion:lead-query"]);
    expect(engineSig, "agent route and coach-action engine fire identical triggers").toEqual(
      routeSig,
    );
  });
});

test.describe("eval-requests confirm (coach queue core) — third-caller parity", () => {
  // Flow change 2026-07-02: the public booking files a Status=Requested claim
  // (no confirmation — pinned by invariant-eval-book-egress). Sam's
  // coach-authed queue action confirms via `confirmEvalRequest`, which reuses
  // sendEvalConfirmation UNCHANGED — its confirmation fan-out (parent email +
  // .ics METHOD:PUBLISH, CRM lead query, Eval-Date stamp) must be
  // byte-for-byte the same trigger set as the shared engine. Its ADDITIONAL
  // fan-out — the Status→Booked PATCH on the slots row — is excluded from the
  // signature by construction: slot writes never touch "Eval Date"/lead-db.
  const SLOT_ID = "22222222-2222-4222-8222-222222222222";
  const SLOT_PATH = `/v1/pages/${SLOT_ID}`;
  const BOOKING_ID = "99999999-9999-4999-8999-999999999999";

  function requestedSlotPage(over: Record<string, unknown> = {}) {
    return {
      id: SLOT_ID,
      object: "page",
      archived: false,
      in_trash: false,
      parent: { type: "database_id", database_id: "eval-slots-db" },
      properties: {
        Slot: { title: [{ plain_text: "2036-07-01 10:00 AM — Olney area" }] },
        Status: { select: { name: "Requested" } },
        Date: {
          date: {
            start: "2036-07-01T10:00:00.000-04:00",
            end: "2036-07-01T10:45:00.000-04:00",
          },
        },
        Location: { select: { name: "Olney area" } },
        "Booking Id": { rich_text: [{ plain_text: BOOKING_ID }] },
        "Parent Name": { rich_text: [{ plain_text: "Pat Parity" }] },
        "Parent Email": { email: VALID_BODY.parentEmail },
        "Parent Phone": { phone_number: "301-555-0100" },
        "Child First Name": { rich_text: [{ plain_text: VALID_BODY.childFirst }] },
        Level: { select: { name: "Green" } },
        ...over,
      },
    };
  }

  test("confirm fan-out === shared-engine fan-out (email+ics + CRM stamp), plus Status→Booked", async () => {
    stub.on(SLOT_PATH, requestedSlotPage());
    stubHappyPath(stub);

    const result = await confirmEvalRequest(SLOT_ID, BOOKING_ID);
    expect(result.ok, !result.ok ? result.error : "").toBe(true);

    // Exactly one parent-facing confirmation email, carrying the same
    // METHOD:PUBLISH .ics attachment naming as the other two callers.
    const parentEmails = stub
      .callsTo("api.resend.com")
      .filter((c) => c.body.includes("method=PUBLISH"));
    expect(parentEmails.length, "exactly one parent confirmation").toBe(1);
    expect(parentEmails[0].body).toContain("text/calendar");
    expect(parentEmails[0].body).toContain("-eval-2036-07-01.ics");

    // The slot row is promoted Requested → Booked.
    const slotPatches = stub
      .callsTo(SLOT_PATH)
      .filter((c) => c.method === "PATCH");
    expect(slotPatches.length, "one Status promotion PATCH").toBe(1);
    const props = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      JSON.parse(slotPatches[0].body) as { properties: Record<string, any> }
    ).properties;
    expect(props.Status?.select?.name).toBe("Booked");

    // Fan-out parity vs the shared engine (slot GET/PATCH excluded by
    // construction — they never match the signature's patterns).
    const confirmSig = fanoutSignature(stub.calls);

    stub.reset();
    stub.install();
    stubHappyPath(stub);
    const engineResult = await sendEvalConfirmation(VALID_BODY);
    expect(engineResult.ok).toBe(true);
    const engineSig = fanoutSignature(stub.calls);

    expect(
      confirmSig,
      "coach confirm fires the identical confirmation triggers as the shared engine",
    ).toEqual(engineSig);
  });

  test("booking-id mismatch (stale queue row) → NO email, NO status change", async () => {
    stub.on(SLOT_PATH, requestedSlotPage());
    stubHappyPath(stub);

    const result = await confirmEvalRequest(SLOT_ID, "00000000-0000-4000-8000-000000000000");
    expect(result.ok).toBe(false);
    expect(stub.callsTo("api.resend.com").length, "nothing emailed").toBe(0);
    expect(
      stub.callsTo(SLOT_PATH).filter((c) => c.method === "PATCH").length,
      "row untouched",
    ).toBe(0);
  });

  test("row no longer Requested (already confirmed or released) → NO email, NO status change", async () => {
    stub.on(
      SLOT_PATH,
      requestedSlotPage({ Status: { select: { name: "Booked" } } }),
    );
    stubHappyPath(stub);

    const result = await confirmEvalRequest(SLOT_ID, BOOKING_ID);
    expect(result.ok).toBe(false);
    expect(stub.callsTo("api.resend.com").length).toBe(0);
    expect(
      stub.callsTo(SLOT_PATH).filter((c) => c.method === "PATCH").length,
    ).toBe(0);
  });
});
