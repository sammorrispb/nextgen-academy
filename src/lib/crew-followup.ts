/**
 * Pure follow-up scheduling logic for un-crewed Crew Interest submissions.
 * Kept dependency-free so it unit-tests without a dev server (see
 * e2e/crew-followup-logic.spec.ts). The cron (/api/cron/crew-followup) maps the
 * returned stage to an action:
 *
 *   "nudge"    — day 3+: internal digest to Sam (the row + candidate matches +
 *                whether any open session fits). Flips "Nudge Sent".
 *   "reengage" — day 7+: parent re-engagement email with matching open
 *                sessions. Flips "Reengagement Sent" (and "Nudge Sent", so a
 *                stale nudge never fires after the bigger touch already went).
 *   "none"     — nothing due (too fresh, or both touches already sent).
 *
 * Re-engagement wins when both are due (e.g. a cron gap meant the row was never
 * touched and is already 7+ days old) — the parent email is the higher-value
 * action and the nudge digest is most useful only around day 3.
 */

export const NUDGE_AFTER_DAYS = 3;
export const REENGAGE_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type FollowupStage = "none" | "nudge" | "reengage";

export interface FollowupRowState {
  createdTime: string;
  nudgeSent: boolean;
  reengagementSent: boolean;
}

/** Whole days elapsed since an ISO timestamp (floored, never negative). */
export function daysSince(isoTimestamp: string, now: Date = new Date()): number {
  const created = new Date(isoTimestamp).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((now.getTime() - created) / DAY_MS));
}

export function crewFollowupStage(
  row: FollowupRowState,
  now: Date = new Date(),
): FollowupStage {
  const age = daysSince(row.createdTime, now);
  if (!row.reengagementSent && age >= REENGAGE_AFTER_DAYS) return "reengage";
  if (!row.nudgeSent && age >= NUDGE_AFTER_DAYS) return "nudge";
  return "none";
}
