import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route — the route + its libs read these at call time.
// NOTION_DB_ID drives the Player CRM db that setEvalDate queries (legacy env
// name honored by playerCrmDbId()); NOTION_EVAL_SLOTS_DB_ID drives the slots db.
// Open Brain env is deliberately absent so nothing shadow-egresses.
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_DB_ID = "lead-db";
process.env.NOTION_EVAL_SLOTS_DB_ID = "eval-slots-db";
process.env.RESEND_API_KEY = "re_test";
delete process.env.OPEN_BRAIN_INGEST_URL;
delete process.env.LEAD_INGEST_TOKEN;

import { POST } from "../src/app/api/eval-book/route";

// Eval self-scheduling egress invariant (admin-reduction roadmap Phase 1a —
// minor-PII surface, full IPAV). The booking path may reach ONLY:
//   - api.notion.com (slot claim + verify, CRM Eval-Date stamp), and
//   - api.resend.com (parent confirmation + admin booking notification).
// Recipients may be ONLY the booking parent + the two admin inboxes — never
// another parent's address (the claim-race loser path must go dark, not
// mis-mail). Child data crossing the wire is FIRST NAME + LEVEL only — any
// extra child field a client sneaks into the payload must be dropped at the
// validation boundary, not forwarded. Rate limiting must be wired (shared
// src/lib/rate-limit.ts) so the public route can't be used as a Notion/Resend
// amplifier.
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];
const PARENT_EMAIL = "egress-eval-parent@example.com";
const CHILD_FIRST = "Egressevalkid";
// Canary values for fields that must NEVER cross the wire.
const CANARY_LAST_NAME = "Egresslastname";
const CANARY_AGE = "canary-age-9";
const INTRUDER_EMAIL = "other-parent-won-race@example.com";
const ADMIN_INBOXES = ["sam.morris2131@gmail.com", "nextgenacademypb@gmail.com"];

function bookingBody(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    slotId: "slot-1",
    parentName: "Egress Parent",
    email: PARENT_EMAIL,
    phone: "301-555-0142",
    childFirstName: CHILD_FIRST,
    level: "Green",
    // Canaries — NOT part of the booking contract; must be ignored, not sent.
    childLastName: CANARY_LAST_NAME,
    childAge: CANARY_AGE,
    ...over,
  });
}

let ipCounter = 0;
function req(payload: string, ip?: string): NextRequest {
  // Distinct IP per request unless the test pins one — the route module keeps
  // ONE in-memory limiter across this spec file.
  const forwardedFor = ip ?? `10.0.0.${++ipCounter}`;
  return new NextRequest("http://localhost/api/eval-book", {
    method: "POST",
    body: payload,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": forwardedFor,
    },
  });
}

// Notion page fixture for the slot row. One static rule serves the pre-check
// GET, the claim PATCH response, and the verify GET.
function slotPage(over: Record<string, unknown> = {}) {
  return {
    id: "slot-1",
    object: "page",
    archived: false,
    in_trash: false,
    properties: {
      Slot: { title: [{ plain_text: "2026-07-10 5:30 PM — Cabin John MS" }] },
      Status: { select: { name: "Open" } },
      Date: {
        date: {
          start: "2026-07-10T17:30:00.000-04:00",
          end: "2026-07-10T18:00:00.000-04:00",
        },
      },
      Location: { select: { name: "Cabin John MS" } },
      "Parent Email": { email: PARENT_EMAIL },
      ...over,
    },
  };
}

const stub = new FetchStub();

function stubHappyPath(pageOver: Record<string, unknown> = {}) {
  stub
    // Slot row — FIRST so it wins over the generic /v1/pages rule below.
    .on("/v1/pages/slot-1", slotPage(pageOver))
    // Player CRM lookup for the Eval-Date stamp.
    .on("/databases/lead-db/query", { results: [{ id: "lead-1" }] })
    // Eval-Date PATCH on the CRM row.
    .on("api.notion.com/v1/pages", { id: "patched" })
    .on("api.resend.com", { id: "email_test" });
}

test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("eval-book route — egress invariants", () => {
  test("(a) booking egress reaches ONLY Notion + Resend", async () => {
    stubHappyPath();
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(200);

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
      expect(call.url).not.toContain("open-brain");
    }
  });

  test("(b) email recipients = the booking parent + admin inboxes ONLY", async () => {
    stubHappyPath();
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(200);

    const emails = stub.callsTo("api.resend.com");
    // Exactly two sends: parent confirmation + admin booking notification.
    expect(emails.length).toBe(2);

    const allowedRecipients = [PARENT_EMAIL, ...ADMIN_INBOXES];
    const parentToCounts: string[] = [];
    for (const call of emails) {
      const body = JSON.parse(call.body) as Record<string, unknown>;
      for (const field of ["to", "cc", "bcc"] as const) {
        const v = body[field];
        if (v === undefined || v === null) continue;
        const list = Array.isArray(v) ? v : [v];
        for (const addr of list) {
          expect(
            allowedRecipients,
            `unexpected ${field} recipient ${String(addr)}`,
          ).toContain(String(addr));
        }
      }
      const to = Array.isArray(body.to) ? body.to : [body.to];
      if (to.includes(PARENT_EMAIL)) parentToCounts.push(call.url);
    }
    // The parent is the direct recipient of exactly ONE email (their
    // confirmation); the notification goes to the admin inboxes.
    expect(parentToCounts.length).toBe(1);
  });

  test("(c) child data crossing the wire = first name + level ONLY (canaries dropped)", async () => {
    stubHappyPath();
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(200);

    for (const call of stub.calls) {
      expect(call.body, `canary last name leaked to ${call.url}`).not.toContain(
        CANARY_LAST_NAME,
      );
      expect(call.body, `canary age leaked to ${call.url}`).not.toContain(
        CANARY_AGE,
      );
    }

    // The slot-claim write carries exactly the approved child fields.
    const slotPatches = stub
      .callsTo("/v1/pages/slot-1")
      .filter((c) => c.method === "PATCH");
    expect(slotPatches.length).toBe(1);
    const props = (
      JSON.parse(slotPatches[0].body) as {
        properties: Record<string, unknown>;
      }
    ).properties;
    const childKeys = Object.keys(props).filter(
      (k) => !["Status", "Parent Name", "Parent Email", "Parent Phone", "Booked At"].includes(k),
    );
    expect(childKeys.sort()).toEqual(["Child First Name", "Level"]);
    expect(slotPatches[0].body).toContain(CHILD_FIRST);
  });

  test("(d) rate limit wired: 6th request from one IP → 429 with zero downstream calls", async () => {
    stubHappyPath();
    const IP = "10.9.9.9";
    for (let i = 0; i < 5; i++) {
      await POST(req(bookingBody(), IP));
    }
    const before = stub.calls.length;
    const res = await POST(req(bookingBody(), IP));
    expect(res.status).toBe(429);
    expect(stub.calls.length, "no egress after the limiter trips").toBe(before);
  });

  test("already-Booked slot (ISR staleness) → 409, NO overwrite PATCH, NO emails", async () => {
    stubHappyPath({ Status: { select: { name: "Booked" } } });
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(409);

    const slotPatches = stub
      .callsTo("/v1/pages/slot-1")
      .filter((c) => c.method === "PATCH");
    expect(slotPatches.length, "a Booked slot is never overwritten").toBe(0);
    expect(stub.callsTo("api.resend.com").length, "no emails on slot_taken").toBe(0);
  });

  test("claim-race loser (verify re-read shows another parent) → 409, nothing emailed", async () => {
    // Status reads Open (pre-check passes, PATCH fires) but the row's Parent
    // Email reads as ANOTHER parent — simulating a concurrent claimer winning
    // between our write and our verify re-read. The loser path must return
    // slot_taken and go completely dark on email.
    stubHappyPath({ "Parent Email": { email: INTRUDER_EMAIL } });
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(409);

    expect(stub.callsTo("api.resend.com").length, "loser path sends nothing").toBe(0);
    for (const call of stub.calls) {
      if (call.url.includes("api.resend.com")) {
        expect(call.body).not.toContain(INTRUDER_EMAIL);
      }
    }
  });

  test("validation failure → 400, zero downstream calls", async () => {
    stubHappyPath();
    const res = await POST(req(bookingBody({ childFirstName: "" })));
    expect(res.status).toBe(400);
    expect(stub.calls.length).toBe(0);
  });

  test("JSON ack never echoes child PII", async () => {
    stubHappyPath();
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(CHILD_FIRST);
    expect(text).not.toContain(PARENT_EMAIL);
  });
});
