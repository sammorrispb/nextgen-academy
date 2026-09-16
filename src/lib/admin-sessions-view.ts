// Pure view helpers for /admin/sessions — what the operator sees first.
//
// The page read every upcoming Sessions row whatever its Status, so after the
// 2026-08-23 blackout the list was fifteen Cancelled rows that looked live (the
// collapsed day header carries no status). Cancelled rows are deliberately NOT
// deleted from Notion — `ensureWeeklyTemplates` relies on them for row-family
// idempotency — so the fix is in the view: hide them by default, keep them one
// click away. Camps get the same treatment: a finished camp is history, but its
// roster is still where a late refund happens, so it collapses rather than goes.

/** A day whose every row is Cancelled — nothing on it is offered. */
export function isCancelledDay(rows: { status: string }[]): boolean {
  return rows.length > 0 && rows.every((r) => r.status === "Cancelled");
}

/** Split date-grouped rows into days still on offer and fully-cancelled days. */
export function partitionDays<T extends { rows: { status: string }[] }>(
  groups: T[],
): { active: T[]; cancelled: T[] } {
  const active: T[] = [];
  const cancelled: T[] = [];
  for (const g of groups) (isCancelledDay(g.rows) ? cancelled : active).push(g);
  return { active, cancelled };
}

/**
 * A camp is current until its last possible day — the makeup Friday when it has
 * one. ISO date strings compare lexically, so no Date construction (UTC build
 * servers shift `new Date(y, m, d)` by a day).
 */
export function partitionCamps<T extends { endDate: string; makeupDate?: string }>(
  camps: T[],
  todayIso: string,
): { current: T[]; past: T[] } {
  const current: T[] = [];
  const past: T[] = [];
  for (const c of camps) {
    const lastDay = c.makeupDate && c.makeupDate > c.endDate ? c.makeupDate : c.endDate;
    (lastDay >= todayIso ? current : past).push(c);
  }
  return { current, past };
}
