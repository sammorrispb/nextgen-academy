import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the lib under test (read at call time).
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_DROPINS_DB_ID = "dropins-db";
process.env.NOTION_SESSIONS_DB_ID = "sessions-db";
process.env.RESEND_API_KEY = "re_test";
process.env.NEXT_PUBLIC_SITE_URL = "https://nextgenpbacademy.com";

import { settleRefundedRow } from "../src/lib/session-cancel";
import type { DropInRegistration } from "../src/lib/notion-dropins";

// REGRESSION PIN — a settled refund must leave the roster row in its terminal
// Refunded state, written by THIS engine rather than assumed from a webhook.
//
// The stranding bug (found live 2026-08-02 on a real $20 registration):
// executeSessionCancel refunded via Stripe, emailed the parent, flipped
// `Cancellation Notified`, and then relied entirely on the charge.refunded
// webhook to flip the row Status to "Refunded". But refundOne() returns
// "already" when Stripe reports the charge was ALREADY refunded — and an
// already-refunded charge emits NO new charge.refunded event. So the webhook
// never fired, the row sat at "Confirmed" forever, and because the flag was now
// true, sessionNeedsCancelFanout() reported the session fully handled. The
// reconcile cron skipped it permanently: money moved, row lied, no self-healing
// and no alert. It reproduced twice before being caught by hand.
//
// The fix makes settlement local + idempotent, so correctness never depends on
// an event Stripe may never send. These specs run fully offline — settlement
// rides Notion/Resend (both fetch-based), never the Stripe SDK (which uses
// node http and would escape FetchStub).

const PI = "pi_settle_probe";
const DROPIN_ROW_ID = "row-settle-1";

function dropInPage(overrides: { status?: string; notified?: boolean } = {}) {
  return {
    id: DROPIN_ROW_ID,
    url: `https://notion.so/${DROPIN_ROW_ID}`,
    properties: {
      "Stripe Checkout Session ID": { rich_text: [{ plain_text: "cs_settle_probe" }] },
      "Stripe Payment Intent ID": { rich_text: [{ plain_text: PI }] },
      Status: { select: { name: overrides.status ?? "Confirmed" } },
      "Parent Email": { email: "parent@example.com" },
      "Parent Phone": { phone_number: "" }, // empty → no Twilio path (off-fetch)
      "Parent Name": { rich_text: [{ plain_text: "Lauren Parent" }] },
      "Child First Name": { rich_text: [{ plain_text: "Kid" }] },
      "Session Title": { rich_text: [{ plain_text: "Ridgeview Monday Evening — Yellow" }] },
      "Session Date": { date: { start: "2026-08-10" } },
      "Session Start Time": { rich_text: [{ plain_text: "6:30 PM" }] },
      "Amount Paid": { number: 20 },
      "Cancellation Notified": { checkbox: overrides.notified ?? false },
    },
  };
}

/** Minimal input row — settlement re-reads the authoritative row from Notion,
 * so only the PI + amount are consumed from this object. */
function inputRow(): DropInRegistration {
  return {
    id: DROPIN_ROW_ID,
    stripePaymentIntentId: PI,
    amountPaidUsd: 20,
  } as DropInRegistration;
}

function seed(stub: FetchStub, page = dropInPage()) {
  stub
    .on("/databases/dropins-db/query", { results: [page], has_more: false })
    // No matching session row → decrement is skipped, isolating the Status
    // flip. The decrement itself is the shared cancelDropIn engine's, already
    // pinned by invariant-cancel-dropin-trigger-parity.
    .on("/databases/sessions-db/query", { results: [], has_more: false })
    .on("api.resend.com", { id: "email_test" })
    .on("/pages/", { id: DROPIN_ROW_ID, properties: {} });
}

// cancelDropIn calls revalidatePath, which throws outside a Next request scope
// — AFTER the Notion writes. Settle either way and assert on captured calls.
async function settle<T>(p: Promise<T>) {
  return p.then(
    () => undefined,
    () => undefined,
  );
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

/** Notion PATCHes to the drop-in row that set Status to the given value. */
function statusWrites(value: string) {
  return stub.calls.filter(
    (c) =>
      c.method === "PATCH" &&
      c.url.includes(`/pages/${DROPIN_ROW_ID}`) &&
      c.body.includes(`"Status"`) &&
      c.body.includes(`"${value}"`),
  );
}

test('an "already refunded" charge still writes the terminal Refunded state', async () => {
  seed(stub);

  await settle(settleRefundedRow(inputRow(), "already"));

  // THE BUG: before the fix nothing wrote this, because an already-refunded
  // charge emits no charge.refunded webhook to do it for us.
  expect(statusWrites("Refunded")).toHaveLength(1);
});

test("a freshly created refund settles locally too, not just via the webhook", async () => {
  seed(stub);

  await settle(settleRefundedRow(inputRow(), "ok"));

  expect(statusWrites("Refunded")).toHaveLength(1);
});

test("a FAILED refund never marks the row Refunded", async () => {
  seed(stub);

  await settle(settleRefundedRow(inputRow(), "error"));

  // No money moved — claiming Refunded here would strand a real unrefunded
  // charge behind a row that says it was handled.
  expect(statusWrites("Refunded")).toHaveLength(0);
});

test("a row with no payment intent is never marked Refunded", async () => {
  seed(stub);

  await settle(settleRefundedRow(inputRow(), "no_pi"));

  expect(statusWrites("Refunded")).toHaveLength(0);
});

test("settlement is idempotent — an already-Refunded row is left alone", async () => {
  seed(stub, dropInPage({ status: "Refunded", notified: true }));

  await settle(settleRefundedRow(inputRow(), "already"));

  expect(statusWrites("Refunded")).toHaveLength(0);
});

test("settlement sends the parent NO second email once the broadcast notified them", async () => {
  // Cancellation Notified already true — the session-wide broadcast covered
  // this parent, so cancelDropIn's per-row confirmation must stay suppressed.
  seed(stub, dropInPage({ notified: true }));

  await settle(settleRefundedRow(inputRow(), "already"));

  expect(statusWrites("Refunded")).toHaveLength(1);
  expect(stub.calls.filter((c) => c.url.includes("api.resend.com"))).toHaveLength(0);
});

test("broadcastOne settles on BOTH return paths, not just the emailed one", () => {
  const src = readFileSync(
    join(process.cwd(), "src/lib/session-cancel.ts"),
    "utf8",
  );

  // The already-notified early return is exactly the path Lauren's row took on
  // its second pass. If it returns without settling, a stranded row can never
  // self-heal on a re-run — the failure mode this pin exists to prevent.
  const earlyReturn = src.match(
    /if \(row\.cancellationNotified\) \{[\s\S]*?return outcome;/,
  );
  expect(earlyReturn, "early-return branch not found — refactor this pin").not.toBeNull();
  expect(earlyReturn![0]).toContain("settleRefundedRow");

  // ...and the main path settles after the flag is set (so the per-row
  // confirmation email stays suppressed and the parent gets exactly one).
  const flagThenSettle = /markDropInFlag\(row\.id, "Cancellation Notified"\)[\s\S]*?settleRefundedRow/;
  expect(flagThenSettle.test(src)).toBe(true);
});
