/**
 * Suppress drop-in comms for sessions that have been cancelled.
 *
 * Why this exists: the comms crons (24h reminder, post-session) select rows by
 * the DROP-IN row's own Status === "Confirmed". But cancelling a session flips
 * only the SESSION row to "Cancelled" (see setSessionStatus / session-cancel.ts)
 * — the per-drop-in rows are flipped to "Refunded" asynchronously by each Stripe
 * `charge.refunded` webhook, and not at all when a session is cancelled by hand
 * in Notion (the common weather pull). That left a window where a Confirmed
 * drop-in still pointed at a Cancelled session, and the reminder cron mailed
 * "your player is on the court tomorrow" after the session was already pulled.
 *
 * This is a pure cross-reference: given the candidate drop-ins and the day's
 * session rows (with their Status), partition out anything whose session is
 * Cancelled. Matched by Session Row ID when present (exact) and by
 * title+start-time otherwise (legacy rows written before Session Row ID
 * stamping). Title carries the level suffix, so per-level siblings that share a
 * start time are NOT cross-suppressed.
 */

export interface SuppressionSession {
  id: string;
  title: string;
  startTime: string;
  status: string;
}

export interface SuppressionDropIn {
  /** Notion page ID of the session row (empty on pre-2026-06-12 rows). */
  sessionRowId?: string;
  sessionTitle: string;
  sessionStartTime: string;
}

function sessionKey(title: string, startTime: string): string {
  return `${(title ?? "").trim().toLowerCase()}|${(startTime ?? "").trim().toLowerCase()}`;
}

/**
 * Split `dropIns` into rows safe to send vs. rows whose session is Cancelled.
 * Favors suppression: a row matching a Cancelled session by EITHER its Session
 * Row ID or its title+start-time is held back — skipping a reminder is far
 * cheaper than mailing one for a session that no longer exists.
 */
export function partitionByCancelledSession<T extends SuppressionDropIn>(
  dropIns: T[],
  sessions: SuppressionSession[],
): { send: T[]; suppressed: T[] } {
  const cancelled = sessions.filter((s) => s.status === "Cancelled");
  const cancelledIds = new Set(cancelled.map((s) => s.id).filter(Boolean));
  const cancelledKeys = new Set(
    cancelled.map((s) => sessionKey(s.title, s.startTime)),
  );

  const send: T[] = [];
  const suppressed: T[] = [];
  for (const row of dropIns) {
    const byId = !!row.sessionRowId && cancelledIds.has(row.sessionRowId);
    const byKey = cancelledKeys.has(
      sessionKey(row.sessionTitle, row.sessionStartTime),
    );
    if (byId || byKey) suppressed.push(row);
    else send.push(row);
  }
  return { send, suppressed };
}
