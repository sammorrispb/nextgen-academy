import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route (auth + db ids are read at call time).
process.env.COACH_SIGNING_SECRET = "test-signing-secret";
process.env.ADMIN_ALLOWLIST = "admin@example.com";
process.env.SESSION_OPS_SECRET = "test-session-ops-secret";
process.env.NOTION_API_KEY = "ntn_test_key";
process.env.NOTION_DROPINS_DB_ID = "db-dropins-test";
process.env.NOTION_SESSIONS_DB_ID = "db-sessions-test";
process.env.RESEND_API_KEY = "re_test_dummy";
process.env.NEXT_PUBLIC_SITE_URL = "https://nextgenpbacademy.com";
// NB: deliberately NOT setting STRIPE_SECRET_KEY — these rosters are empty, so
// executeSessionCancel never reaches getStripe(). Building the Stripe SDK here
// would cache its process-global singleton and break sibling specs that assert
// getStripe() throws on an unset key (invariant-referral-reward-idempotency).

import { POST as cancelAllLevels } from "../src/app/api/admin/sessions/cancel-all-levels/route";
import { createAdminSessionValue } from "../src/lib/admin-auth";

const DATE = "2026-06-16";
const COOKIE = createAdminSessionValue("admin@example.com");

function sessionRow(
  id: string,
  title: string,
  level: string,
  status: string,
) {
  return {
    id,
    properties: {
      Session: { title: [{ plain_text: title }] },
      Level: { select: { name: level } },
      "Start time": { rich_text: [{ plain_text: "6:00 PM" }] },
      Status: { select: { name: status } },
    },
  };
}

// 4 Redland-Tuesday level rows (Orange already Cancelled) + 1 unrelated
// same-date session that MUST never be swept into the group cancel.
const SESSION_ROWS = {
  results: [
    sessionRow("red-row", "Redland Tuesday Evening — Red", "Red", "Open"),
    sessionRow("green-row", "Redland Tuesday Evening — Green", "Green", "Open"),
    sessionRow("yellow-row", "Redland Tuesday Evening — Yellow", "Yellow", "Open"),
    sessionRow("orange-row", "Redland Tuesday Evening — Orange", "Orange", "Cancelled"),
    sessionRow("gburg-row", "Gaithersburg HS", "", "Open"),
  ],
  has_more: false,
  next_cursor: null,
};

// Empty rosters: this spec pins the ORCHESTRATOR (which rows get the engine,
// which are skipped, which are off-limits), not the per-row refund/email path
// (executeSessionCancel owns that, pinned by its own specs). Empty rosters keep
// the run fully offline AND Stripe-free — see the STRIPE_SECRET_KEY note above.
const DROPINS = { results: [], has_more: false, next_cursor: null };

function seed(stub: FetchStub) {
  stub
    .on("/databases/db-sessions-test/query", SESSION_ROWS)
    .on("/databases/db-dropins-test/query", DROPINS)
    .on("api.resend.com", { id: "email_test" })
    .on("/pages/", { id: "x", properties: {} });
}

function req(
  auth: { cookie?: string; bearer?: string },
  body: Record<string, unknown> = { date: DATE, reason: "venue" },
): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth.cookie !== undefined) headers.cookie = `nga_admin=${auth.cookie}`;
  if (auth.bearer !== undefined) headers.authorization = `Bearer ${auth.bearer}`;
  return new NextRequest("http://localhost/api/admin/sessions/cancel-all-levels", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Page IDs that got a Status-flip PATCH (setSessionStatus → Cancelled). */
function statusFlippedIds(stub: FetchStub): string[] {
  return stub.calls
    .filter((c) => c.method === "PATCH" && c.url.includes("/pages/"))
    .filter((c) => {
      try {
        return Boolean(JSON.parse(c.body).properties?.Status);
      } catch {
        return false;
      }
    })
    .map((c) => c.url.replace(/^.*\/pages\//, ""));
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("cancel-all-levels — Bearer gate (fail closed)", () => {
  test("no auth → 401, zero downstream calls", async () => {
    seed(stub);
    const res = await cancelAllLevels(req({}));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong Bearer → 401, zero downstream calls", async () => {
    seed(stub);
    const res = await cancelAllLevels(req({ bearer: "nope" }));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("fails closed: unset SESSION_OPS_SECRET rejects even an empty guess", async () => {
    seed(stub);
    const original = process.env.SESSION_OPS_SECRET;
    try {
      delete process.env.SESSION_OPS_SECRET;
      const res = await cancelAllLevels(req({ bearer: "" }));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    } finally {
      process.env.SESSION_OPS_SECRET = original;
    }
  });
});

// revalidatePath throws outside a Next request scope (AFTER the engine's work
// completes), so we assert on the captured triggers — the real fan-out — not on
// the post-revalidate response. Same convention as the cancel-dropin parity spec.
test("fires the per-level engine on every non-terminal level row", async () => {
  seed(stub);
  const res = await cancelAllLevels(req({ bearer: "test-session-ops-secret" }));
  const body = await res.json();

  // Enumeration is reliable (computed before the engine runs): 4 Tuesday rows
  // matched, the already-Cancelled Orange one skipped, the other 3 acted on.
  expect(body.matched).toBe(4);
  expect(body.skipped).toBe(1);
  expect(body.cancelled + body.failed).toBe(3);

  // The roster was fetched once per non-terminal level row (per-row engine run).
  expect(stub.callsTo("/databases/db-dropins-test/query").length).toBe(3);

  // Exactly the three OPEN level rows were flipped to Cancelled — never the
  // already-cancelled Orange row (skipped), and never (blast-radius) the
  // unrelated Gaithersburg row.
  expect(statusFlippedIds(stub).sort()).toEqual(["green-row", "red-row", "yellow-row"]);
});

test("blast-radius: an unrelated same-date session is never touched", async () => {
  seed(stub);
  await cancelAllLevels(req({ bearer: "test-session-ops-secret" }));
  expect(stub.calls.some((c) => c.url.includes("/pages/gburg-row"))).toBe(false);
  // The terminal Orange row is matched but skipped — also never written.
  expect(stub.calls.some((c) => c.url.includes("/pages/orange-row"))).toBe(false);
});

test("admin cookie path fires the identical fan-out (UI parity)", async () => {
  seed(stub);
  await cancelAllLevels(req({ cookie: COOKIE }));
  expect(statusFlippedIds(stub).sort()).toEqual(["green-row", "red-row", "yellow-row"]);
});

// ── F1: the default prefix guard is derived from the DATE's weekday, so a
// wrong-date call can only ever be a safe no-op — never a wrong-date refund. ──
test.describe("weekday-scoped default prefixes (F1)", () => {
  test("a Wednesday date can only match Wednesday-family rows: Tuesday rows on it are NOT swept", async () => {
    // Same Redland-Tuesday rows, but the caller asks for 2026-06-17 — a
    // WEDNESDAY. Default prefixes are now the Wednesday family (Westland), so
    // nothing matches: no refunds, no status flips, matched 0.
    seed(stub);
    const res = await cancelAllLevels(
      req({ bearer: "test-session-ops-secret" }, { date: "2026-06-17", reason: "venue" }),
    );
    const body = await res.json();
    expect(body.matched).toBe(0);
    expect(body.cancelled).toBe(0);
    expect(statusFlippedIds(stub)).toEqual([]);
    expect(stub.callsTo("/databases/db-dropins-test/query").length).toBe(0); // no engine run
  });

  test("a weekend date (no template family at all) is a safe no-op", async () => {
    seed(stub);
    const res = await cancelAllLevels(
      req({ bearer: "test-session-ops-secret" }, { date: "2026-06-20", reason: "venue" }), // Saturday
    );
    const body = await res.json();
    expect(body.matched).toBe(0);
    expect(statusFlippedIds(stub)).toEqual([]);
  });

  test("explicit caller-supplied titlePrefixes still override the weekday default", async () => {
    // The coach button passes the base title explicitly — that path must keep
    // working even when the date's weekday wouldn't match by default.
    seed(stub);
    await cancelAllLevels(
      req(
        { bearer: "test-session-ops-secret" },
        { date: "2026-06-17", reason: "venue", titlePrefixes: ["Redland Tuesday Evening"] },
      ),
    );
    expect(statusFlippedIds(stub).sort()).toEqual(["green-row", "red-row", "yellow-row"]);
  });
});
