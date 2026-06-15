/**
 * Stripe idempotency key for an off-session crew-reservation charge.
 *
 * crew-autoreserve charges a saved card once per (commit, session). Its only
 * pre-existing duplicate guard is an eventually-consistent Notion roster lookup,
 * which has a write→read race window: a same-day cron re-run (Vercel retry or an
 * overlapping invocation) can pass the guard before the first run's roster row is
 * visible and charge the card a second $20 for the same week. A deterministic key
 * per (commit, session) makes the duplicate `paymentIntents.create` a no-op at
 * Stripe (keys are deduped for 24h), so the race cannot double-charge.
 */
export function crewChargeIdempotencyKey(
  commitId: string,
  sessionId: string,
): string {
  return `crew-autoreserve-${commitId}-${sessionId}`;
}
