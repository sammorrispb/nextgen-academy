import { getStripe } from "@/lib/stripe";
import { MONDAY_GIRLS_GROUP } from "@/data/monday-girls-2026";
import {
  createMondayGirlsMaybe,
  getMondayGirlsPage,
  setMondayGirlsPageStatus,
} from "@/lib/notion-monday-girls-registrations";
import { sendMondayGirlsCancellationEmail } from "@/lib/cancel-monday-girls";

/**
 * The writes behind /admin/monday-girls: remove a player, and keep a "maybe"
 * list. Gauntlet-reviewed 2026-09-16 (plan: ~/.claude/plans/mg-remove-maybes-v2.md).
 *
 * REMOVAL RECORDS; IT NEVER REFUNDS. Refunds stay a deliberate act in the Stripe
 * Dashboard. An admin page that issues refunds needs idempotency keys, a
 * flip/revert protocol and a double-click story — all for one or two removals a
 * season. So there are exactly two modes:
 *   - `already_refunded`: read what Stripe did (a PARTIAL refund counts — the
 *     prorated Dashboard refund is the documented procedure) and record Refunded
 *     with Stripe's amount. Nothing refunded → refused.
 *   - `none`: the family withdrew with no refund → Cancelled, no Stripe call.
 *
 * The parent email is opt-in per removal: Sam usually told the family himself.
 * When it goes, it carries Stripe's amount, so a refunded family never gets the
 * "isn't refundable" copy.
 */

export type RemoveMode = "already_refunded" | "none";

export type RefundReadResult =
  | { status: "ok"; amountRefundedCents: number }
  | { status: "failed"; message: string };

/**
 * How much of a Payment Intent's charge has been refunded. Injectable because
 * the Stripe SDK rides node http, which the specs' FetchStub cannot see; the
 * fake in the spec deliberately has no way to create a refund.
 */
export type RefundReader = (paymentIntentId: string) => Promise<RefundReadResult>;

const stripeRefundReader: RefundReader = async (paymentIntentId) => {
  try {
    const pi = await getStripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = pi.latest_charge;
    if (!charge || typeof charge === "string") {
      return { status: "failed", message: "Stripe returned no charge for this payment" };
    }
    return { status: "ok", amountRefundedCents: charge.amount_refunded ?? 0 };
  } catch (err) {
    return { status: "failed", message: err instanceof Error ? err.message : String(err) };
  }
};

export type RemoveResult =
  | {
      ok: true;
      pageId: string;
      status: "Refunded" | "Cancelled";
      refundedUsd: number;
      /** Only meaningful when notifyParent was true. */
      emailSent: boolean;
    }
  | {
      ok: false;
      reason:
        | "config_missing"
        | "not_found"
        | "wrong_database"
        | "query_failed"
        | "not_a_registration"
        | "already_done"
        | "refunded_row"
        | "no_payment_intent"
        | "not_refunded"
        | "stripe_failed"
        | "update_failed";
      message: string;
    };

const REGISTRATION_STATUSES = new Set(["Confirmed", "Refunded", "Cancelled"]);

function lookupFailure(status: string, message?: string): RemoveResult & { ok: false } {
  switch (status) {
    case "config_missing":
      return { ok: false, reason: "config_missing", message: "Roster database isn't configured." };
    case "not_found":
      return { ok: false, reason: "not_found", message: "That registration isn't in Notion any more." };
    case "wrong_database":
      return {
        ok: false,
        reason: "wrong_database",
        message: "That page isn't in the Monday Girls roster — nothing was changed.",
      };
    default:
      return {
        ok: false,
        reason: "query_failed",
        message: `Couldn't read the roster (${message ?? "Notion error"}) — nothing was changed.`,
      };
  }
}

export async function removeMondayGirlsPlayer(
  input: { pageId: string; mode: RemoveMode; notifyParent: boolean },
  deps: { readRefund?: RefundReader } = {},
): Promise<RemoveResult> {
  const readRefund = deps.readRefund ?? stripeRefundReader;

  const found = await getMondayGirlsPage(input.pageId);
  if (found.status !== "ok") {
    return lookupFailure(found.status, "message" in found ? found.message : undefined);
  }
  const row = found.page;

  if (!REGISTRATION_STATUSES.has(row.status)) {
    return {
      ok: false,
      reason: "not_a_registration",
      message: `This row is "${row.status || "blank"}", not a registration.`,
    };
  }

  let target: "Refunded" | "Cancelled";
  let refundedUsd = 0;

  if (input.mode === "none") {
    if (row.status === "Cancelled") {
      return { ok: false, reason: "already_done", message: "Already marked Cancelled." };
    }
    if (row.status === "Refunded") {
      return {
        ok: false,
        reason: "refunded_row",
        message: "This family was refunded — it stays Refunded, not Cancelled.",
      };
    }
    target = "Cancelled";
  } else {
    if (row.status === "Refunded") {
      return { ok: false, reason: "already_done", message: "Already marked Refunded." };
    }
    if (!row.stripePaymentIntentId) {
      return {
        ok: false,
        reason: "no_payment_intent",
        message:
          "No Stripe payment on this row (a $0 or hand-added registration) — use 'Withdrew, no refund'.",
      };
    }
    const read = await readRefund(row.stripePaymentIntentId);
    if (read.status !== "ok") {
      return {
        ok: false,
        reason: "stripe_failed",
        message: `Couldn't check Stripe (${read.message}) — nothing was changed.`,
      };
    }
    if (read.amountRefundedCents <= 0) {
      return {
        ok: false,
        reason: "not_refunded",
        message:
          "Stripe shows no refund on this payment yet. Refund it in the Stripe Dashboard first, then mark it here.",
      };
    }
    target = "Refunded";
    refundedUsd = read.amountRefundedCents / 100;
  }

  if (!(await setMondayGirlsPageStatus(row.pageId, target))) {
    return {
      ok: false,
      reason: "update_failed",
      message: "Notion didn't accept the change — the row is unchanged. Try again.",
    };
  }

  const emailSent = input.notifyParent
    ? await sendMondayGirlsCancellationEmail(row, refundedUsd)
    : false;

  return { ok: true, pageId: row.pageId, status: target, refundedUsd, emailSent };
}

/* ---------- maybes -------------------------------------------------------- */

export interface MaybeInput {
  parentName: string;
  childFirstName: string;
  parentEmail?: string;
  parentPhone?: string;
}

export type MaybeResult =
  | { ok: true; pageId: string }
  | {
      ok: false;
      reason:
        | "invalid"
        | "create_failed"
        | "config_missing"
        | "not_found"
        | "wrong_database"
        | "query_failed"
        | "not_a_maybe"
        | "update_failed";
      message: string;
    };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addMondayGirlsMaybe(input: MaybeInput): Promise<MaybeResult> {
  const parentName = String(input.parentName ?? "").trim();
  const childFirstName = String(input.childFirstName ?? "").trim();
  const parentEmail = String(input.parentEmail ?? "").trim().toLowerCase();

  if (!parentName || parentName.length > 100) {
    return { ok: false, reason: "invalid", message: "Parent name is required." };
  }
  if (!childFirstName || childFirstName.length > 50) {
    return { ok: false, reason: "invalid", message: "Child first name is required." };
  }
  if (parentEmail && !EMAIL_RE.test(parentEmail)) {
    return { ok: false, reason: "invalid", message: "That email doesn't look right." };
  }

  const res = await createMondayGirlsMaybe({
    parentName,
    childFirstName,
    parentEmail,
    group: MONDAY_GIRLS_GROUP,
  });
  return res.ok
    ? { ok: true, pageId: res.pageId }
    : { ok: false, reason: "create_failed", message: `Couldn't add to Notion (${res.message}).` };
}

/** Maybe → Dismissed. Never Cancelled: that status means a family withdrew. */
export async function dismissMondayGirlsMaybe(pageId: string): Promise<MaybeResult> {
  const found = await getMondayGirlsPage(pageId);
  if (found.status !== "ok") {
    const { message } = lookupFailure(found.status, "message" in found ? found.message : undefined);
    return { ok: false, reason: found.status, message };
  }
  if (found.page.status !== "Maybe") {
    return {
      ok: false,
      reason: "not_a_maybe",
      message: "That row is a registration, not a maybe — nothing was changed.",
    };
  }
  return (await setMondayGirlsPageStatus(pageId, "Dismissed"))
    ? { ok: true, pageId }
    : { ok: false, reason: "update_failed", message: "Notion didn't accept the change." };
}
