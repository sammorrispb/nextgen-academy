import type { CancelReason } from "@/lib/email/session-cancelled";

/**
 * Pure helpers for the reconcile-cancelled-sessions cron, which closes the gap
 * where a session marked `Cancelled` BY HAND in Notion (the common weather
 * pull) never refunds its registrants — only the coach "Cancel session, notify
 * all" button (executeSessionCancel) moves the money. The cron sweeps Cancelled
 * session rows and, for any that still have un-refunded Confirmed registrants,
 * fires that same idempotent engine.
 *
 * These are split out (no I/O) so the act/skip decision and reason mapping are
 * unit-testable without a Notion or Stripe round-trip.
 */

/**
 * Map an optional Notion `Cancel Reason` select value to a valid CancelReason
 * (drives the parent email copy). Anything unrecognized — including a blank
 * field, the overwhelmingly common case for a hand-cancelled row — falls back
 * to "other", whose copy reads cleanly without a specific reason.
 */
export function normalizeCancelReason(
  raw: string | null | undefined,
): CancelReason {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "weather") return "weather";
  if (v === "venue") return "venue";
  if (v === "low-enrollment" || v === "low enrollment" || v === "lowenrollment") {
    return "low-enrollment";
  }
  return "other";
}

export interface ReconcileSession {
  /** Exact session title — carries the level suffix, so per-level siblings on a
   * shared date are NOT cross-matched. */
  title: string;
  date: string;
}

/**
 * The Confirmed drop-ins belonging to one cancelled session. Matched by exact
 * date + title — the SAME key executeSessionCancel uses to pick its roster, so
 * this pre-check and the engine always agree on which rows are in scope.
 */
export function rosterForSession<
  T extends { sessionDate: string; sessionTitle: string },
>(drops: T[], session: ReconcileSession): T[] {
  return drops.filter(
    (d) => d.sessionDate === session.date && d.sessionTitle === session.title,
  );
}

/**
 * True when at least one Confirmed registrant has NOT yet been sent the
 * cancellation comms (Cancellation Notified === false) — i.e. the refund + email
 * fan-out still has work to do. Once every row is flagged (or the rows have
 * flipped to Refunded and dropped out of the Confirmed query), this returns
 * false and the cron leaves the session alone, so it never re-hits Stripe.
 */
export function sessionNeedsCancelFanout(
  roster: { cancellationNotified: boolean }[],
): boolean {
  return roster.some((r) => !r.cancellationNotified);
}
