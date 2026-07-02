import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE importing the route — the route + its libs read these at call time.
// NOTION_PLAYER_CRM_DB_ID drives the Player CRM db that setEvalDate queries
// (the CANONICAL env name — the legacy NOTION_DB_ID is deliberately set to a
// poison value below and must never be consulted for CRM targeting);
// NOTION_EVAL_SLOTS_DB_ID drives the slots db. Open Brain env is deliberately
// absent so nothing shadow-egresses.
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_PLAYER_CRM_DB_ID = "lead-db";
// Poison canary: if ANY code path still honors the legacy env for CRM
// targeting, a call to /databases/legacy-db/... surfaces (and, being
// unstubbed for queries, fails loudly).
process.env.NOTION_DB_ID = "legacy-db";
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
//
// Hardening additions (code-review findings on PR #244):
//  - F1: the slotId page must live IN the Eval Slots db — a page from any
//    other database the integration can read returns the SAME generic
//    slot_taken 409 (no existence oracle), and a non-UUID slotId never
//    reaches Notion at all.
//  - F3/F4: claim ownership is verified via a per-claim Booking Id token
//    (not email), and release-after-failed-confirmation is CONDITIONAL on
//    the row still holding OUR Booking Id.
//  - F5: a past slot can never be claimed (generic 409).
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];
const PARENT_EMAIL = "egress-eval-parent@example.com";
const CHILD_FIRST = "Egressevalkid";
// Canary values for fields that must NEVER cross the wire.
const CANARY_LAST_NAME = "Egresslastname";
const CANARY_AGE = "canary-age-9";
const INTRUDER_EMAIL = "other-parent-won-race@example.com";
const ADMIN_INBOXES = ["sam.morris2131@gmail.com", "nextgenacademypb@gmail.com"];

// Notion page ids are UUIDs — validate-eval-book rejects anything else before
// a single Notion call is made (F1 format gate).
const SLOT_ID = "11111111-1111-4111-8111-111111111111";
const SLOT_PATH = `/v1/pages/${SLOT_ID}`;

const SLOT_TAKEN_BODY = {
  error:
    "That time was just booked by another family. Pick another open time below.",
};

function bookingBody(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    slotId: SLOT_ID,
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

// Notion page fixture for the slot row. `parent.database_id` matters now: the
// claim path verifies db membership (F1). Dates are far-future so the F5
// past-slot gate never trips on the happy paths.
function slotPage(
  over: Record<string, unknown> = {},
  parentDbId = "eval-slots-db",
) {
  return {
    id: SLOT_ID,
    object: "page",
    archived: false,
    in_trash: false,
    parent: { type: "database_id", database_id: parentDbId },
    properties: {
      Slot: { title: [{ plain_text: "2036-07-10 5:30 PM — Cabin John MS" }] },
      Status: { select: { name: "Open" } },
      Date: {
        date: {
          start: "2036-07-10T17:30:00.000-04:00",
          end: "2036-07-10T18:00:00.000-04:00",
        },
      },
      Location: { select: { name: "Cabin John MS" } },
      "Parent Email": { email: PARENT_EMAIL },
      ...over,
    },
  };
}

const stub = new FetchStub();

// Convert Notion WRITE-shape properties (what a PATCH body carries) into
// READ-shape (what a GET returns) so a responder can act like the real Notion:
// the verify re-read must see the Booking Id the claim PATCH just wrote.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toReadShape(props: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value && Array.isArray(value.rich_text)) {
      out[key] = {
        rich_text: value.rich_text.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => ({ plain_text: r?.text?.content ?? "" }),
        ),
      };
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Slot responder that reflects the last claim PATCH back on subsequent reads
 * — a faithful single-row Notion. */
function reflectingSlotRule(base = slotPage(), path = SLOT_PATH) {
  return () => {
    const patches = stub
      .callsTo(path)
      .filter((c) => c.method === "PATCH");
    if (patches.length === 0) return base;
    const written = (
      JSON.parse(patches[patches.length - 1].body) as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties: Record<string, any>;
      }
    ).properties;
    return {
      ...base,
      properties: { ...base.properties, ...toReadShape(written) },
    };
  };
}

// CRM + Resend rules shared by most tests (register the slot rule FIRST so it
// wins over the generic /v1/pages rule).
function stubDownstream() {
  stub
    .on("/databases/lead-db/query", { results: [{ id: "lead-1" }] })
    .on("api.notion.com/v1/pages", { id: "patched" })
    .on("api.resend.com", { id: "email_test" });
}

function stubHappyPath(pageOver: Record<string, unknown> = {}) {
  stub.on(SLOT_PATH, reflectingSlotRule(slotPage(pageOver)));
  stubDownstream();
}

function slotPatches(): RecordedFetch[] {
  return stub.callsTo(SLOT_PATH).filter((c) => c.method === "PATCH");
}

test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("eval-book route — egress invariants", () => {
  test("(a) booking egress reaches ONLY Notion + Resend (and never the legacy CRM db)", async () => {
    stubHappyPath();
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(200);

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
      expect(call.url).not.toContain("open-brain");
      // F8: legacy NOTION_DB_ID must no longer steer any CRM call.
      expect(call.url, "legacy NOTION_DB_ID consulted").not.toContain(
        "legacy-db",
      );
    }
    // The Eval-Date stamp hit the CANONICAL CRM db.
    expect(
      stub.callsTo("/databases/lead-db/query").length,
      "CRM stamp queries the canonical db",
    ).toBeGreaterThan(0);
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

    // The slot-claim write carries exactly the approved child fields (plus the
    // booking bookkeeping: Status / parent contact / Booked At / Booking Id).
    const patches = slotPatches();
    expect(patches.length).toBe(1);
    const props = (
      JSON.parse(patches[0].body) as {
        properties: Record<string, unknown>;
      }
    ).properties;
    const childKeys = Object.keys(props).filter(
      (k) =>
        ![
          "Status",
          "Parent Name",
          "Parent Email",
          "Parent Phone",
          "Booked At",
          "Booking Id",
        ].includes(k),
    );
    expect(childKeys.sort()).toEqual(["Child First Name", "Level"]);
    expect(patches[0].body).toContain(CHILD_FIRST);
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

    expect(slotPatches().length, "a Booked slot is never overwritten").toBe(0);
    expect(stub.callsTo("api.resend.com").length, "no emails on slot_taken").toBe(0);
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

// ── F1: db-membership gate + no existence oracle ─────────────────────────

test.describe("eval-book — slotId hardening (F1)", () => {
  test("non-UUID slotId → 400 with ZERO Notion calls (format gate before any egress)", async () => {
    stubHappyPath();
    for (const bad of ["slot-1", "../../v1/users", "11112222", ""]) {
      const res = await POST(req(bookingBody({ slotId: bad })));
      expect(res.status, `slotId ${JSON.stringify(bad)} must 400`).toBe(400);
    }
    expect(stub.calls.length, "malformed slotId never reaches Notion").toBe(0);
  });

  test("32-hex (no dashes) slotId is accepted as a valid Notion id format", async () => {
    const bare = SLOT_ID.replace(/-/g, "");
    stub.on(
      `/v1/pages/${bare}`,
      reflectingSlotRule(slotPage(), `/v1/pages/${bare}`),
    );
    stubDownstream();
    const res = await POST(req(bookingBody({ slotId: bare })));
    expect(res.status).toBe(200);
  });

  test("page from a FOREIGN database → the SAME generic slot_taken 409 (no oracle), zero writes, zero emails", async () => {
    // A real page id the integration can read, but parented in some OTHER db.
    stub.on(
      SLOT_PATH,
      slotPage({}, "aaaabbbbccccddddeeeeffff00001111"),
    );
    stubDownstream();

    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(409);
    expect(await res.json(), "response is byte-identical to the taken path").toEqual(
      SLOT_TAKEN_BODY,
    );
    expect(slotPatches().length, "no write to a foreign page").toBe(0);
    expect(stub.callsTo("api.resend.com").length).toBe(0);

    // ...and the genuine taken path returns the exact same shape (oracle
    // check: an attacker can't distinguish "not ours" from "taken").
    stub.reset();
    stub.install();
    stubHappyPath({ Status: { select: { name: "Booked" } } });
    const taken = await POST(req(bookingBody()));
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual(SLOT_TAKEN_BODY);
  });

  test("db-membership compare is dash-insensitive (Notion mixes both forms)", async () => {
    // Env says "eval-slots-db"; the page reports the same id without dashes.
    stub.on(
      SLOT_PATH,
      reflectingSlotRule(slotPage({}, "evalslotsdb")),
    );
    stubDownstream();
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(200);
  });
});

// ── F5: past slots can't be claimed ──────────────────────────────────────

test.describe("eval-book — past-slot gate (F5)", () => {
  test("slot whose Date is in the past → generic 409, no PATCH, no emails", async () => {
    stubHappyPath({
      Date: {
        date: {
          start: "2020-07-10T17:30:00.000-04:00",
          end: "2020-07-10T18:00:00.000-04:00",
        },
      },
    });
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(SLOT_TAKEN_BODY);
    expect(slotPatches().length, "a past slot is never claimed").toBe(0);
    expect(stub.callsTo("api.resend.com").length).toBe(0);
  });
});

// ── F3/F4: booking-token protocol ────────────────────────────────────────

test.describe("eval-book — booking-token race protocol (F3/F4)", () => {
  test("claim PATCH writes a per-claim UUID Booking Id; admin notify email carries slot id + booking id", async () => {
    stubHappyPath();
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(200);

    const patches = slotPatches();
    expect(patches.length).toBe(1);
    const props = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      JSON.parse(patches[0].body) as { properties: Record<string, any> }
    ).properties;
    const bookingId: string =
      props["Booking Id"]?.rich_text?.[0]?.text?.content ?? "";
    expect(
      bookingId,
      "claim writes a UUID Booking Id token",
    ).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    // The admin notification is the reconciliation record for any residual
    // race — it must carry BOTH ids.
    const admin = stub
      .callsTo("api.resend.com")
      .find((c) => c.body.includes("method=REQUEST"));
    expect(admin, "admin booking notification sent").toBeTruthy();
    expect(admin!.body, "admin email carries the slot id").toContain(SLOT_ID);
    expect(admin!.body, "admin email carries the booking id").toContain(
      bookingId,
    );
  });

  test("verify re-read shows ANOTHER claim's Booking Id → 409, nothing emailed (email match is NOT trusted)", async () => {
    // Static row: Status Open (pre-check passes, PATCH fires) but every read
    // returns a FOREIGN Booking Id — and, adversarially, OUR parent email.
    // An implementation that verifies by email would wrongly win here and
    // send a confirmation for a slot another family holds.
    stub.on(
      SLOT_PATH,
      slotPage({
        "Booking Id": { rich_text: [{ plain_text: "intruder-booking-token" }] },
        "Parent Email": { email: PARENT_EMAIL },
      }),
    );
    stubDownstream();

    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(SLOT_TAKEN_BODY);
    expect(stub.callsTo("api.resend.com").length, "loser path sends nothing").toBe(0);
  });

  test("legacy race shape (verify shows another parent, no Booking Id) still loses → 409, intruder never mailed", async () => {
    stub.on(
      SLOT_PATH,
      slotPage({ "Parent Email": { email: INTRUDER_EMAIL } }),
    );
    stubDownstream();
    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(409);
    expect(stub.callsTo("api.resend.com").length).toBe(0);
    for (const call of stub.calls) {
      if (call.url.includes("api.resend.com")) {
        expect(call.body).not.toContain(INTRUDER_EMAIL);
      }
    }
  });

  test("confirmation failure after a won claim → CONDITIONAL release fires (Booking Id is ours): row reopened + token cleared", async () => {
    stub.on(SLOT_PATH, reflectingSlotRule());
    stub
      .on("/databases/lead-db/query", { results: [{ id: "lead-1" }] })
      .on("api.notion.com/v1/pages", { id: "patched" })
      .on("api.resend.com", { name: "application_error", message: "boom" }, 500);

    const res = await POST(req(bookingBody()));
    expect(res.status).toBe(502);

    const patches = slotPatches();
    expect(patches.length, "claim PATCH + release PATCH").toBe(2);
    const release = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      JSON.parse(patches[1].body) as { properties: Record<string, any> }
    ).properties;
    expect(release.Status?.select?.name, "row reopened").toBe("Open");
    expect(release["Booking Id"]?.rich_text, "token cleared").toEqual([]);
    expect(release["Parent Email"]?.email).toBeNull();
  });

  test("confirmation failure but the row now holds ANOTHER booking → release LEAVES the row (their booking stands)", async () => {
    // Sequenced reads: pre-check sees Open, verify sees OUR claim (we won),
    // release re-read sees a residual-race winner's Booking Id. The release
    // must NOT clear their booking — and their family hears nothing.
    let gets = 0;
    stub.on(SLOT_PATH, (call: RecordedFetch) => {
      if (call.method === "PATCH") return { id: SLOT_ID };
      gets++;
      if (gets === 1) return slotPage();
      if (gets === 2) {
        const patch = slotPatches()[0];
        const written = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          JSON.parse(patch.body) as { properties: Record<string, any> }
        ).properties;
        return {
          ...slotPage(),
          properties: { ...slotPage().properties, ...toReadShape(written) },
        };
      }
      return slotPage({
        Status: { select: { name: "Booked" } },
        "Booking Id": {
          rich_text: [{ plain_text: "residual-race-winner-token" }],
        },
        "Parent Email": { email: INTRUDER_EMAIL },
      });
    });
    stub
      .on("/databases/lead-db/query", { results: [{ id: "lead-1" }] })
      .on("api.notion.com/v1/pages", { id: "patched" })
      .on("api.resend.com", { name: "application_error", message: "boom" }, 500);

    const res = await POST(req(bookingBody()));
    // OUR family still hears "not booked — try again" (true for them).
    expect(res.status).toBe(502);

    const patches = slotPatches();
    expect(patches.length, "ONLY the claim PATCH — no clearing write").toBe(1);
    for (const p of patches) {
      const props = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        JSON.parse(p.body) as { properties: Record<string, any> }
      ).properties;
      expect(props.Status?.select?.name, "never reopens a foreign booking").not.toBe(
        "Open",
      );
    }
    // The other family is never emailed anything from our request.
    for (const call of stub.callsTo("api.resend.com")) {
      expect(call.body).not.toContain(INTRUDER_EMAIL);
    }
  });
});
