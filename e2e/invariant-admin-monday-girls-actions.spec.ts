import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// /admin/monday-girls gained its first WRITES (2026-09-16): mark a player
// removed, and keep a "maybe" list. Gauntlet-reviewed; the shape these tests pin:
//
//  1. Removal RECORDS, it never refunds. Refunds stay a deliberate act in the
//     Stripe Dashboard. `already_refunded` reads what Stripe did (partial counts)
//     and records Refunded with STRIPE's amount; `none` records Cancelled with
//     no Stripe call at all.
//  2. Admin COOKIE only — no Bearer path — and a strict body allowlist: a typo
//     is a 400 with zero calls, never a default.
//  3. The parent email is opt-in per removal, and carries Stripe's amount so a
//     refunded family never reads "this one isn't refundable".
//  4. A "maybe" is a minimal row (parent name, child first name, optional
//     contact) that never counts as a registration, and every write first
//     proves the page belongs to THIS database.
//
// Stripe rides the SDK's node http client, which FetchStub cannot see, so the
// engine takes an injectable charge reader — the camp-reminder-run precedent.
//
//   npx playwright test e2e/invariant-admin-monday-girls-actions.spec.ts --project=desktop

process.env.COACH_SIGNING_SECRET = "test-signing-secret";
process.env.ADMIN_ALLOWLIST = "admin@example.com";
process.env.SESSION_OPS_SECRET = "test-ops-secret";

import { createAdminSessionValue } from "../src/lib/admin-auth";
import {
  removeMondayGirlsPlayer,
  addMondayGirlsMaybe,
  dismissMondayGirlsMaybe,
  type RefundReader,
} from "../src/lib/admin-monday-girls-actions";
import { POST as removeRoute } from "../src/app/api/admin/monday-girls/remove/route";
import { POST as maybeRoute } from "../src/app/api/admin/monday-girls/maybe/route";
import { cancelMondayGirlsByPaymentIntent } from "../src/lib/cancel-monday-girls";
import {
  splitMondayGirlsRoster,
  toAdminMondayGirlsPlayer,
  countConfirmed,
} from "../src/lib/admin-monday-girls-roster";
import {
  fetchMondayGirlsRoster,
  type MondayGirlsRosterRow,
} from "../src/lib/notion-monday-girls-registrations";
import { describeRemoveOutcome } from "../src/lib/admin-monday-girls-outcome";

const DB = "e54eb6b233be4bca8e5775fb55fcbe6a";
const DB_DASHED = "e54eb6b2-33be-4bca-8e57-75fb55fcbe6a";
const OTHER_DB = "557f01d8-e4c6-47d9-a67b-f0817dd8724f";
const PAGE = "page-laila";
const PARENT_EMAIL = "parent@example.com";

const stub = new FetchStub();

test.beforeEach(() => {
  stub.reset();
  stub.install();
  process.env.NOTION_API_KEY = "secret_test";
  process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID = DB;
  process.env.RESEND_API_KEY = "re_test";
});
test.afterEach(() => stub.uninstall());

function page(status: string, opts: { db?: string; pi?: string } = {}) {
  return {
    id: PAGE,
    created_time: "2026-09-14T12:00:00.000Z",
    parent: { type: "database_id", database_id: opts.db ?? DB_DASHED },
    properties: {
      "Parent Name": { title: [{ plain_text: "Pat Parent" }] },
      "Parent Email": { email: PARENT_EMAIL },
      "Child First Name": { rich_text: [{ plain_text: "Mia" }] },
      Group: { select: { name: "Girls Beginner" } },
      Status: { select: { name: status } },
      "Amount Paid": { number: 225 },
      "Stripe Checkout Session ID": { rich_text: [{ plain_text: "cs_live_x" }] },
      "Stripe Payment Intent ID": {
        rich_text: opts.pi === "" ? [] : [{ plain_text: opts.pi ?? "pi_x" }],
      },
    },
  };
}

/** GET returns the page; PATCH echoes success. */
function stubPage(status: string, opts: { db?: string; pi?: string } = {}) {
  stub.onDynamic(`/pages/${PAGE}`, (c) =>
    c.method === "PATCH" ? { status: 200, json: { id: PAGE } } : { status: 200, json: page(status, opts) },
  );
}

const patches = () => stub.callsTo(`/pages/${PAGE}`).filter((c) => c.method === "PATCH");
const patchedStatus = (c: RecordedFetch) =>
  (JSON.parse(c.body) as { properties: { Status: { select: { name: string } } } }).properties.Status
    .select.name;
const parentEmails = () =>
  stub.callsTo("api.resend.com").filter((c) => c.body.includes(PARENT_EMAIL));

/** A recording fake of the Stripe charge read. It has NO refund method at all. */
function reader(result: Awaited<ReturnType<RefundReader>>) {
  const seen: string[] = [];
  const fn: RefundReader = async (pi) => {
    seen.push(pi);
    return result;
  };
  return { fn, seen };
}

/* ---------- removal engine ----------------------------------------------- */

test.describe("removeMondayGirlsPlayer — records, never refunds", () => {
  test("already_refunded + a PARTIAL refund → Refunded, with Stripe's amount", async () => {
    stubPage("Confirmed");
    stub.on("api.resend.com", { id: "email_1" });
    const r = reader({ status: "ok", amountRefundedCents: 18750 });
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "already_refunded", notifyParent: true },
      { readRefund: r.fn },
    );
    expect(res).toMatchObject({ ok: true, status: "Refunded", refundedUsd: 187.5, emailSent: true });
    expect(r.seen).toEqual(["pi_x"]);
    expect(patches().map(patchedStatus)).toEqual(["Refunded"]);
    // The parent is told the real amount, never the no-refund copy.
    const [email] = parentEmails();
    expect(email.body).toContain("187.50");
    expect(email.body).not.toContain("isn't refundable");
  });

  test("already_refunded when Stripe shows nothing refunded → refused, row untouched", async () => {
    stubPage("Confirmed");
    const r = reader({ status: "ok", amountRefundedCents: 0 });
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "already_refunded", notifyParent: false },
      { readRefund: r.fn },
    );
    expect(res).toMatchObject({ ok: false, reason: "not_refunded" });
    expect(patches()).toHaveLength(0);
  });

  test("already_refunded with no Payment Intent on the row → no_payment_intent, no Stripe read", async () => {
    stubPage("Confirmed", { pi: "" });
    const r = reader({ status: "ok", amountRefundedCents: 22500 });
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "already_refunded", notifyParent: false },
      { readRefund: r.fn },
    );
    expect(res).toMatchObject({ ok: false, reason: "no_payment_intent" });
    expect(r.seen).toHaveLength(0);
    expect(patches()).toHaveLength(0);
  });

  test("a Stripe read failure is a visible failure, not a flip", async () => {
    stubPage("Confirmed");
    const r = reader({ status: "failed", message: "stripe down" });
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "already_refunded", notifyParent: false },
      { readRefund: r.fn },
    );
    expect(res).toMatchObject({ ok: false, reason: "stripe_failed" });
    expect(patches()).toHaveLength(0);
  });

  test("a Cancelled row that was later refunded can still be marked Refunded", async () => {
    stubPage("Cancelled");
    const r = reader({ status: "ok", amountRefundedCents: 5000 });
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "already_refunded", notifyParent: false },
      { readRefund: r.fn },
    );
    expect(res).toMatchObject({ ok: true, status: "Refunded" });
    expect(patches().map(patchedStatus)).toEqual(["Refunded"]);
  });

  test("none → Cancelled with ZERO Stripe reads", async () => {
    stubPage("Confirmed");
    const r = reader({ status: "ok", amountRefundedCents: 0 });
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "none", notifyParent: false },
      { readRefund: r.fn },
    );
    expect(res).toMatchObject({ ok: true, status: "Cancelled", refundedUsd: 0 });
    expect(r.seen).toHaveLength(0);
    expect(patches().map(patchedStatus)).toEqual(["Cancelled"]);
  });

  test("notifyParent=false → no email addressed to the parent", async () => {
    stubPage("Confirmed");
    const r = reader({ status: "ok", amountRefundedCents: 22500 });
    await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "already_refunded", notifyParent: false },
      { readRefund: r.fn },
    );
    expect(parentEmails()).toHaveLength(0);
  });

  test("notifyParent=true but the send fails → ok with emailSent false (visible, not silent)", async () => {
    stubPage("Confirmed");
    stub.on("api.resend.com", { message: "nope" }, 500);
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "none", notifyParent: true },
      { readRefund: reader({ status: "ok", amountRefundedCents: 0 }).fn },
    );
    expect(res).toMatchObject({ ok: true, emailSent: false });
  });

  test("a row already in the requested state → already_done, nothing written", async () => {
    stubPage("Refunded");
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "already_refunded", notifyParent: true },
      { readRefund: reader({ status: "ok", amountRefundedCents: 22500 }).fn },
    );
    expect(res).toMatchObject({ ok: false, reason: "already_done" });
    expect(patches()).toHaveLength(0);
    expect(parentEmails()).toHaveLength(0);
  });

  test("a Refunded row can't be re-labelled Cancelled (money moved)", async () => {
    stubPage("Refunded");
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "none", notifyParent: false },
      { readRefund: reader({ status: "ok", amountRefundedCents: 0 }).fn },
    );
    expect(res).toMatchObject({ ok: false });
    expect(patches()).toHaveLength(0);
  });

  test("a Maybe row is not a registration and can't be removed this way", async () => {
    stubPage("Maybe");
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "none", notifyParent: false },
      { readRefund: reader({ status: "ok", amountRefundedCents: 0 }).fn },
    );
    expect(res).toMatchObject({ ok: false, reason: "not_a_registration" });
    expect(patches()).toHaveLength(0);
  });

  test("a page from ANOTHER database is refused before any write", async () => {
    stubPage("Confirmed", { db: OTHER_DB });
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "none", notifyParent: false },
      { readRefund: reader({ status: "ok", amountRefundedCents: 0 }).fn },
    );
    expect(res).toMatchObject({ ok: false, reason: "wrong_database" });
    expect(patches()).toHaveLength(0);
  });

  test("not found, Notion down and env unset are three different answers", async () => {
    const deps = { readRefund: reader({ status: "ok", amountRefundedCents: 0 }).fn };
    const input = { pageId: PAGE, mode: "none" as const, notifyParent: false };

    stub.on(`/pages/${PAGE}`, { object: "error" }, 404);
    expect(await removeMondayGirlsPlayer(input, deps)).toMatchObject({ reason: "not_found" });

    stub.reset();
    stub.on(`/pages/${PAGE}`, { object: "error" }, 500);
    expect(await removeMondayGirlsPlayer(input, deps)).toMatchObject({ reason: "query_failed" });

    stub.reset();
    delete process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID;
    expect(await removeMondayGirlsPlayer(input, deps)).toMatchObject({ reason: "config_missing" });
    expect(stub.calls).toHaveLength(0);
  });

  test("a failed status write is reported, and no parent email goes out", async () => {
    stub.onDynamic(`/pages/${PAGE}`, (c) =>
      c.method === "PATCH" ? { status: 500, json: {} } : { status: 200, json: page("Confirmed") },
    );
    const res = await removeMondayGirlsPlayer(
      { pageId: PAGE, mode: "none", notifyParent: true },
      { readRefund: reader({ status: "ok", amountRefundedCents: 0 }).fn },
    );
    expect(res).toMatchObject({ ok: false, reason: "update_failed" });
    expect(parentEmails()).toHaveLength(0);
  });
});

/* ---------- maybes -------------------------------------------------------- */

test.describe("maybes — minimal, never a registration", () => {
  test("add writes ONLY the allowlisted properties with Status Maybe", async () => {
    stub.on(`/v1/pages`, { id: "page-new" });
    const res = await addMondayGirlsMaybe({
      parentName: "Casey Parent",
      childFirstName: "Kay",
      parentEmail: "casey@example.com",
      parentPhone: "",
      // Extra fields a caller might send must never reach Notion.
      ...({
        childBirthYear: 2017,
        allergies: "SENTINEL_ALLERGY",
        emergencyName: "SENTINEL_EMERGENCY",
      } as object),
    } as Parameters<typeof addMondayGirlsMaybe>[0]);
    expect(res).toMatchObject({ ok: true });
    const [post] = stub.calls.filter((c) => c.method === "POST");
    expect(stub.calls.every((c) => c.url.includes("api.notion.com"))).toBe(true);
    const body = JSON.parse(post.body) as {
      parent: { database_id: string };
      properties: Record<string, { select?: { name: string } }>;
    };
    expect(body.parent.database_id).toBe(DB);
    expect(Object.keys(body.properties).sort()).toEqual(
      ["Child First Name", "Group", "Parent Email", "Parent Name", "Status"].sort(),
    );
    expect(body.properties.Status.select?.name).toBe("Maybe");
    expect(post.body).not.toContain("SENTINEL");
    expect(post.body).not.toContain("2017");
  });

  test("add refuses an empty parent or child name, and a malformed email, with zero calls", async () => {
    for (const bad of [
      { parentName: " ", childFirstName: "Kay" },
      { parentName: "Casey", childFirstName: "" },
      { parentName: "Casey", childFirstName: "Kay", parentEmail: "not-an-email" },
    ]) {
      const res = await addMondayGirlsMaybe(bad);
      expect(res).toMatchObject({ ok: false, reason: "invalid" });
    }
    expect(stub.calls).toHaveLength(0);
  });

  test("dismiss flips Maybe → Dismissed (never Cancelled)", async () => {
    stubPage("Maybe");
    const res = await dismissMondayGirlsMaybe(PAGE);
    expect(res).toMatchObject({ ok: true });
    expect(patches().map(patchedStatus)).toEqual(["Dismissed"]);
  });

  test("dismiss refuses a real registration and a page from another DB", async () => {
    stubPage("Confirmed");
    expect(await dismissMondayGirlsMaybe(PAGE)).toMatchObject({ ok: false, reason: "not_a_maybe" });
    stub.reset();
    stubPage("Maybe", { db: OTHER_DB });
    expect(await dismissMondayGirlsMaybe(PAGE)).toMatchObject({ ok: false, reason: "wrong_database" });
    expect(patches()).toHaveLength(0);
  });

  test("the admin projection keeps maybes out of seats, money and the roster", () => {
    const base: MondayGirlsRosterRow = {
      pageId: "a",
      parentName: "P",
      parentEmail: "p@example.com",
      parentPhone: "",
      childFirstName: "A",
      childBirthYear: null,
      group: "Girls Beginner",
      status: "Confirmed",
      amountPaidUsd: 225,
      allergies: "",
      emergencyName: "",
      emergencyPhone: "",
      smsConsent: false,
      stripeCheckoutSessionId: "cs",
      registeredOnIso: "2026-09-08",
    };
    const players = [
      base,
      { ...base, pageId: "m", status: "Maybe", amountPaidUsd: 0 },
      { ...base, pageId: "d", status: "Dismissed", amountPaidUsd: 0 },
      { ...base, pageId: "r", status: "Refunded" },
    ].map(toAdminMondayGirlsPlayer);
    const { registrations, maybes } = splitMondayGirlsRoster(players);
    expect(registrations.map((p) => p.pageId)).toEqual(["a", "r"]);
    expect(maybes.map((p) => p.pageId)).toEqual(["m"]);
    expect(countConfirmed(registrations)).toBe(1);
  });
});

/* ---------- roster read paginates --------------------------------------- */

test("the roster read follows has_more instead of stopping at 100", async () => {
  stub.onDynamic(`/databases/${DB}/query`, (c) => {
    const cursor = (JSON.parse(c.body) as { start_cursor?: string }).start_cursor;
    return cursor
      ? { status: 200, json: { results: [page("Confirmed")], has_more: false } }
      : { status: 200, json: { results: [page("Confirmed")], has_more: true, next_cursor: "c2" } };
  });
  const res = await fetchMondayGirlsRoster();
  expect(res.status).toBe("ok");
  if (res.status === "ok") expect(res.rows).toHaveLength(2);
});

/* ---------- webhook: partial refund after a removal ---------------------- */

test.describe("charge.refunded partial branch", () => {
  function stubLookup(status: string) {
    stub.on(`/databases/${DB}/query`, { results: [page(status)] });
    stub.on("api.resend.com", { id: "email_1" });
  }

  test("row already Refunded (Sam recorded it) → no 'STILL ENROLLED' alert", async () => {
    stubLookup("Refunded");
    const res = await cancelMondayGirlsByPaymentIntent("pi_x", {
      fullyRefunded: false,
      amountRefundedUsd: 187.5,
    });
    expect(res).toMatchObject({ ok: true, idempotent: true });
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });

  test("row Cancelled → still alerts, because money moved on a withdrawn seat", async () => {
    stubLookup("Cancelled");
    await cancelMondayGirlsByPaymentIntent("pi_x", { fullyRefunded: false, amountRefundedUsd: 50 });
    expect(stub.callsTo("api.resend.com").length).toBeGreaterThan(0);
  });
});

/* ---------- routes: gate + strict body ---------------------------------- */

function req(path: string, opts: { cookie?: string; bearer?: string; body?: unknown }): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.cookie !== undefined) headers.cookie = `nga_admin=${opts.cookie}`;
  if (opts.bearer !== undefined) headers.authorization = `Bearer ${opts.bearer}`;
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body ?? {}),
  });
}

test.describe("admin Monday Girls routes", () => {
  const admin = () => createAdminSessionValue("admin@example.com");
  const REMOVE = "/api/admin/monday-girls/remove";
  const MAYBE = "/api/admin/monday-girls/maybe";
  const goodRemove = { pageId: PAGE, mode: "none", notifyParent: false };

  test("no cookie → 401 with zero calls, on both routes", async () => {
    expect((await removeRoute(req(REMOVE, { body: goodRemove }))).status).toBe(401);
    expect((await maybeRoute(req(MAYBE, { body: { action: "dismiss", pageId: PAGE } }))).status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("the Bearer ops secret does NOT open these routes", async () => {
    expect((await removeRoute(req(REMOVE, { bearer: "test-ops-secret", body: goodRemove }))).status).toBe(401);
    expect(
      (await maybeRoute(req(MAYBE, { bearer: "test-ops-secret", body: { action: "dismiss", pageId: PAGE } }))).status,
    ).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("a malformed body is a 400 with zero calls — never a default", async () => {
    for (const body of [
      "not json",
      { pageId: PAGE, notifyParent: false },
      { pageId: PAGE, mode: "full", notifyParent: false },
      { pageId: PAGE, mode: "NONE", notifyParent: false },
      { pageId: PAGE, mode: "prorated", notifyParent: false },
      { pageId: "  ", mode: "none", notifyParent: false },
      { pageId: PAGE, mode: "none", notifyParent: "false" },
      { pageId: PAGE, mode: "none" },
    ]) {
      const res = await removeRoute(req(REMOVE, { cookie: admin(), body }));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    for (const body of ["nope", { action: "delete", pageId: PAGE }, { action: "dismiss" }]) {
      expect((await maybeRoute(req(MAYBE, { cookie: admin(), body }))).status).toBe(400);
    }
    expect(stub.calls).toHaveLength(0);
  });

  test("an authorized removal that fails returns non-2xx with the reason", async () => {
    stubPage("Confirmed", { db: OTHER_DB });
    const res = await removeRoute(req(REMOVE, { cookie: admin(), body: goodRemove }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await res.json()).toMatchObject({ reason: "wrong_database" });
  });
});

/* ---------- what the operator reads -------------------------------------- */


test.describe("describeRemoveOutcome — failures are loud, a missed email is not a green check", () => {
  test("a non-2xx shows the route's own message in red", () => {
    const v = describeRemoveOutcome(false, { error: "Stripe shows no refund on this payment yet." }, false);
    expect(v).toEqual({ tone: "error", text: "Stripe shows no refund on this payment yet." });
  });

  test("an unreadable body is still an error, never silence", () => {
    expect(describeRemoveOutcome(false, null, false).tone).toBe("error");
    expect(describeRemoveOutcome(true, { ok: false }, false).tone).toBe("error");
  });

  test("asked to email the parent but it didn't send → warn, and says so", () => {
    const v = describeRemoveOutcome(true, { ok: true, status: "Refunded", refundedUsd: 225, emailSent: false }, true);
    expect(v.tone).toBe("warn");
    expect(v.text).toContain("did NOT send");
  });

  test("success states the real refunded amount", () => {
    const v = describeRemoveOutcome(true, { ok: true, status: "Refunded", refundedUsd: 187.5, emailSent: false }, false);
    expect(v).toEqual({ tone: "ok", text: "Marked Refunded ($187.50 back per Stripe)." });
  });
});
