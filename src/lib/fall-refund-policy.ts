import { FALL_SUNDAYS } from "@/data/fall-2026";

/**
 * Fall 2026 season refund policy.
 *
 * Two axes, because one boolean could not express the real policy:
 *
 *   WHO cancelled (`reason`)
 *     parent_withdrawal → the seat was held all season; no refund.
 *     nga_cancelled     → we did not deliver; prorate the undelivered sessions.
 *
 *   WHEN they registered (`registeredOnIso`)
 *     Before FALL_NO_REFUND_EFFECTIVE_FROM the site showed NO refund terms at
 *     all — not on /fall, not in the form, not in the confirmation email. Those
 *     families bought under the original "full refund until the season starts"
 *     handling and keep it. Terms do not change retroactively once money has
 *     changed hands (Sam, 2026-08-24).
 *     On/after that date the no-refund terms are stated at the point of sale.
 *
 * An UNKNOWN registration date deliberately falls back to the older, more
 * generous rule. Never apply stricter terms to a row we cannot date.
 *
 * A season-wide washout is still not a refund event on its own: the two rain
 * dates (FALL_RAIN_DATES) are the stated remedy. Proration applies when NGA
 * cancels sessions outright and the rain dates cannot cover them.
 *
 * This file DECIDES; cancel-fall.ts only asks. If the policy changes, change it
 * here.
 *
 * Dates are ISO date-only strings compared lexicographically, never Date
 * arithmetic: `new Date(y, m, d)` renders a day early on the UTC build server
 * (repo rule, burned twice 2026-05-24).
 */

export type FallRefundPolicy = "full" | "none" | "prorated";

export type FallCancelReason = "parent_withdrawal" | "nga_cancelled";

/** First Sunday of the season — derived, never re-typed. */
export const FALL_SEASON_START: string = FALL_SUNDAYS[0];

/**
 * Registrations created on/after this date were sold with the no-refund terms
 * visible at checkout. Must never predate the deploy that put those terms on
 * /fall, in FallRegistrationForm, and in the confirmation email — bump it if
 * that deploy slips, so nobody is held to terms they were never shown.
 */
export const FALL_NO_REFUND_EFFECTIVE_FROM = "2026-08-25";

/** Today in Eastern, as `YYYY-MM-DD`. Matches the repo's todayET() pattern. */
export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

export interface FallRefundContext {
  /** ISO date the registration was created. Omit → legacy (generous) rule. */
  registeredOnIso?: string;
  /** Who is cancelling. Defaults to the parent withdrawing. */
  reason?: FallCancelReason;
}

/**
 * Refund owed for a cancellation happening on `todayIso` (ET, `YYYY-MM-DD`).
 * The first Sunday counts as "season started" — a parent who cancels the
 * morning of week 1 has had the seat held for them all along.
 */
export function fallRefundPolicyFor(
  todayIso: string,
  ctx: FallRefundContext = {},
): FallRefundPolicy {
  // NGA failing to deliver is never the family's loss, whatever the terms.
  if (ctx.reason === "nga_cancelled") return "prorated";

  const soldUnderNoRefundTerms =
    ctx.registeredOnIso !== undefined &&
    ctx.registeredOnIso >= FALL_NO_REFUND_EFFECTIVE_FROM;

  if (soldUnderNoRefundTerms) return "none";

  return todayIso < FALL_SEASON_START ? "full" : "none";
}

/**
 * Sessions not yet delivered as of `todayIso`, today INCLUSIVE — a session
 * cancelled on its own morning has not been played, so the family is owed it.
 */
export function fallSessionsRemaining(todayIso: string): number {
  return FALL_SUNDAYS.filter((sunday) => sunday >= todayIso).length;
}

/**
 * Prorated refund in cents for an NGA-side cancellation on `todayIso`.
 * Rounds UP so rounding lands in the parent's favour, and never returns more
 * than they paid.
 */
export function fallProratedRefundCents(
  todayIso: string,
  paidCents: number,
): number {
  const total = FALL_SUNDAYS.length;
  const remaining = fallSessionsRemaining(todayIso);
  if (remaining <= 0) return 0;
  if (remaining >= total) return paidCents;
  return Math.min(paidCents, Math.ceil((paidCents * remaining) / total));
}
