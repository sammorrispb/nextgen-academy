import { type Camp } from "@/data/camps";

/**
 * Pure date/venue helpers for the Friday-before-camp reminder. Kept free of
 * env + network so they unit-test offline (e2e/camp-reminder.spec.ts) and never
 * touch the slop-free webhook. All date math anchors at noon UTC and steps by
 * whole days so it never off-by-ones on Vercel's UTC build servers (the
 * date-only hazard) — mirrors campDays() in src/data/camps.ts.
 */

/** Add whole days to an ISO date-only string, returning ISO date-only. */
export function addDaysIso(iso: string, days: number): string {
  const ms = new Date(`${iso}T12:00:00Z`).getTime();
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The reminder fires the Friday before a Monday camp — 3 days out. Given an ET
 * "today" (YYYY-MM-DD), return the camp whose startDate is exactly today + 3
 * days, or null. Most Fridays return null (no camp the next Monday); only the
 * Friday before each camp week matches. Returns null on any non-Friday→Monday
 * gap too, so a mis-scheduled run is a safe no-op rather than a wrong-week send.
 */
export function upcomingCampForReminder(
  todayIso: string,
  camps: Camp[],
): Camp | null {
  const target = addDaysIso(todayIso, 3);
  return camps.find((camp) => camp.startDate === target) ?? null;
}

/** "Monday, June 29" — UTC-anchored so it never off-by-ones on a UTC server. */
export function formatCampDayLong(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** Short weekday, e.g. "Monday" — for the subject line. */
export function formatCampWeekday(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${iso}T12:00:00Z`));
}

/**
 * The "Where" block, resolved from camps.ts exactLocation — identical shape to
 * emailCampParent in the webhook (the exact venue is a closed post-payment
 * surface and NEVER travels through Stripe metadata). Falls back to the broad
 * public area if a camp has no exact venue set yet.
 */
export function resolveCampWhere(camp: Camp): string {
  return camp.exactLocation
    ? `Gaithersburg High School — outdoor courts\n${camp.exactLocation.replace(/^Gaithersburg HS,\s*/, "")}`
    : `${camp.publicArea || "Gaithersburg, MD"} — we'll email the exact site before camp starts.`;
}
