/**
 * Convert a session's ET wall-clock start (date + "h:mm AM/PM") to a UTC epoch
 * and compute how many hours from `now` it starts. Used by the hourly
 * pre-event cron to fire the coach briefing ~24h before each start.
 *
 * The ET offset is derived per-date via Intl (handles EDT/EST), so this stays
 * correct across the DST boundary without a tz library.
 */

/** ET UTC-offset in minutes for a given calendar date (e.g. -240 EDT, -300 EST). */
export function etOffsetMinutes(dateIso: string): number {
  const d = new Date(`${dateIso}T12:00:00Z`);
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return -240; // sane EDT default
  const hours = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  return hours * 60 + Math.sign(hours) * mins;
}

/** Parse "4:30 PM" → { h: 16, m: 30 }; returns null if unparseable. */
export function parseStartTime(startTime: string): { h: number; m: number } | null {
  const m = (startTime || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 1 || h > 12 || min > 59) return null;
  const pm = /pm/i.test(m[3]);
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return { h, m: min };
}

/**
 * Format a session's ET wall-clock (date + "h:mm AM/PM") as a Schema.org-valid
 * ISO 8601 datetime with explicit ET offset, e.g. "2026-05-30T10:00:00-04:00".
 * The naive `${date}T${startTime}` concatenation produces "2026-05-30T10:00 AM"
 * which Google's Rich Results validator rejects as invalid for SportsEvent.
 */
export function formatSessionDateTimeIso(
  dateIso: string,
  startTime: string,
): string | null {
  const t = parseStartTime(startTime);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  const offsetMin = etOffsetMinutes(dateIso);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const offH = String(Math.floor(abs / 60)).padStart(2, "0");
  const offM = String(abs % 60).padStart(2, "0");
  const h = String(t.h).padStart(2, "0");
  const m = String(t.m).padStart(2, "0");
  return `${dateIso}T${h}:${m}:00${sign}${offH}:${offM}`;
}

/** UTC epoch ms for a session's ET start, or null if the start time is unparseable. */
export function sessionStartUtcMs(dateIso: string, startTime: string): number | null {
  const t = parseStartTime(startTime);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  const [y, mo, d] = dateIso.split("-").map(Number);
  const offsetMin = etOffsetMinutes(dateIso);
  // wall-clock ET → UTC: subtract the (negative) offset.
  return Date.UTC(y, mo - 1, d, t.h, t.m) - offsetMin * 60000;
}

/** Hours from `now` until the session start. Negative once it's begun. */
export function hoursUntilStart(
  dateIso: string,
  startTime: string,
  now: Date = new Date(),
): number | null {
  const startMs = sessionStartUtcMs(dateIso, startTime);
  if (startMs == null) return null;
  return (startMs - now.getTime()) / 3_600_000;
}

/**
 * Should the 24h pre-event briefing fire on this tick? True when the start is
 * still in the future and within the next 24h. With an hourly cron + a
 * sent-flag, this fires once, ~23–24h before start.
 */
export function isWithinPreEventWindow(
  dateIso: string,
  startTime: string,
  now: Date = new Date(),
): boolean {
  const h = hoursUntilStart(dateIso, startTime, now);
  return h != null && h > 0 && h <= 24;
}

/** UTC epoch ms for a session's ET end, or null if the end time is unparseable. */
export function sessionEndUtcMs(dateIso: string, endTime: string): number | null {
  return sessionStartUtcMs(dateIso, endTime);
}

/**
 * True once a session's END time has passed in ET. Drives the auto-lifecycle:
 * a finished session drops off the public schedule the moment its end time
 * passes — not at midnight — so a 10–11am slot disappears at 11am, not 24h
 * later. A bad/unparseable end string returns false (fail-open) so we never
 * hide a live session on a typo.
 */
export function isSessionEnded(
  dateIso: string,
  endTime: string,
  now: Date = new Date(),
): boolean {
  const endMs = sessionEndUtcMs(dateIso, endTime);
  if (endMs == null) return false;
  return endMs <= now.getTime();
}

/** A session that has ended → "Completed" if anyone registered, else "Passed". */
export function lifecycleStatusFor(
  registeredCount: number,
): "Completed" | "Passed" {
  return registeredCount > 0 ? "Completed" : "Passed";
}

/**
 * Money-correctness gate: a session is NOT registerable when its status is a
 * terminal one (Cancelled/Completed/Passed) OR its ET end time has already
 * passed. Used to reject checkout for ended sessions reached via a stale
 * /schedule/[slug] deep-link between cron ticks. Fail-open end-time parsing
 * (isSessionEnded) means a typo'd time only ever leaves a session open, never
 * wrongly blocks a live one.
 */
export function isSessionClosed(
  status: string,
  dateIso: string,
  endTime: string,
  now: Date = new Date(),
): boolean {
  return (
    status === "Cancelled" ||
    status === "Completed" ||
    status === "Passed" ||
    isSessionEnded(dateIso, endTime, now)
  );
}
