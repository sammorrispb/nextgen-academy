import type { CalendarSessionRow } from "@/lib/notion-sessions";
import { sessionToSlug } from "@/lib/session-slug";
import { isoWeekday } from "@/lib/crew-matching";
import { type CrewDay, CREW_DAYS } from "@/lib/validate-crew-interest";
import { type LeagueBand, LEAGUE_BANDS, bandForAge } from "@/data/leagues";
import {
  FALL_SUNDAYS,
  FALL_RAIN_DATES,
  FALL_YOUTH_BLOCKS,
  FALL_VENUE_SHORT,
  SLOTS_PER_GROUP,
} from "@/data/fall-2026";

/**
 * Pure logic behind /coach/calendar. Kept free of Notion and React so every
 * branch is unit-testable without a dev server (the same split that keeps
 * resolveRefundCents and buildFamilyProfile out of their "use server" callers).
 *
 * Nothing here accepts or returns a child name, a birth year, or a parent
 * contact field — the demand shape carries a derived age and nothing else.
 */

export type CalendarLevel = "Red" | "Orange" | "Green" | "Yellow";

export const CALENDAR_LEVELS: readonly CalendarLevel[] = [
  "Red",
  "Orange",
  "Green",
  "Yellow",
] as const;

export type CalendarStatus =
  | "Open"
  | "Full"
  | "Cancelled"
  | "Completed"
  | "Passed"
  | "Tentative";

export interface CalendarEntry {
  key: string;
  /** ISO date-only (YYYY-MM-DD). */
  date: string;
  /** null when the Notion row has no Level select set. */
  level: CalendarLevel | null;
  title: string;
  /** "6:30 PM – 7:30 PM", or "" when the hour isn't published. */
  timeLabel: string;
  location: string;
  status: CalendarStatus;
  registered: number | null;
  capacity: number | null;
  /** /coach/<slug> for Notion sessions; null for the file-backed fall season. */
  href: string | null;
  source: "session" | "fall";
}

// ── Month-grid math ─────────────────────────────────────────────────────────
// All date work is string math plus Date.UTC. `new Date(y, m, d)` is banned
// repo-wide: it reads the runner's local zone and shifts the day on Vercel.

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Split "YYYY-MM" into numbers. Assumes MONTH_RE has already matched. */
function splitMonth(month: string): { year: number; monthIndex: number } {
  return {
    year: Number(month.slice(0, 4)),
    monthIndex: Number(month.slice(5, 7)) - 1,
  };
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Coerce a ?month= search param to a valid "YYYY-MM". Junk, an out-of-range
 * month, or nothing at all all fall back to the month `todayIso` sits in — a
 * bad URL shows this month rather than an error page.
 */
export function parseMonthParam(
  raw: string | undefined | null,
  todayIso: string,
): string {
  if (raw && MONTH_RE.test(raw)) return raw;
  return monthOf(todayIso);
}

export function shiftMonth(month: string, delta: number): string {
  const { year, monthIndex } = splitMonth(month);
  const total = year * 12 + monthIndex + delta;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${pad2((total % 12) + 1)}`;
}

/** First and last ISO date of the month, inclusive. */
export function monthBounds(month: string): {
  firstIso: string;
  lastIso: string;
} {
  const { year, monthIndex } = splitMonth(month);
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    firstIso: `${month}-01`,
    lastIso: `${month}-${pad2(last.getUTCDate())}`,
  };
}

export interface MonthGridDay {
  iso: string;
  inMonth: boolean;
}

/**
 * Six Sunday-first weeks covering the month, with leading/trailing days from
 * the neighbouring months so every row is a full seven cells. Always 6 rows so
 * the grid doesn't reflow height between months.
 */
export function buildMonthGrid(month: string): MonthGridDay[][] {
  const { year, monthIndex } = splitMonth(month);
  const firstOfMonth = Date.UTC(year, monthIndex, 1);
  const leading = new Date(firstOfMonth).getUTCDay();

  const weeks: MonthGridDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: MonthGridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const offset = w * 7 + d - leading;
      const cell = new Date(firstOfMonth + offset * 86_400_000);
      const iso = cell.toISOString().slice(0, 10);
      row.push({ iso, inMonth: monthOf(iso) === month });
    }
    weeks.push(row);
  }
  return weeks;
}

// ── Entry normalization ─────────────────────────────────────────────────────

function isCalendarLevel(v: unknown): v is CalendarLevel {
  return (CALENDAR_LEVELS as readonly string[]).includes(v as string);
}

function timeLabel(start: string, end: string): string {
  if (!start) return "";
  return end ? `${start} – ${end}` : start;
}

/**
 * Project Notion session rows onto calendar entries. The input type is
 * CalendarSessionRow, which has no `roster` and no `ageStats` — no child field
 * exists to drop here because none was ever read.
 *
 * Not built on EventFeedItem: that shape rolls a venue-evening's four ball
 * colors into ONE block and strips the level suffix from the title, and level
 * is the whole point of this view.
 */
export function sessionsToEntries(
  sessions: CalendarSessionRow[],
): CalendarEntry[] {
  return sessions.map((s) => ({
    key: `nga-sess:${s.id}`,
    date: s.date,
    level: isCalendarLevel(s.level) ? s.level : null,
    title: s.title,
    timeLabel: timeLabel(s.startTime, s.endTime),
    location: s.location || s.publicArea || "",
    status: s.status as CalendarStatus,
    registered: s.registeredCount,
    capacity: s.capacity,
    href: `/coach/${sessionToSlug(s)}`,
    source: "session" as const,
  }));
}

/**
 * The Fall 2026 Sunday season, straight from the season config. Registered is
 * null on purpose: fall seats live only in Stripe checkout metadata and no
 * helper reads them back, so the page shows capacity and says fill is unknown
 * rather than implying an empty group.
 */
export function fallEntriesForMonth(month: string): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  const dates: { iso: string; tentative: boolean }[] = [
    ...FALL_SUNDAYS.map((iso) => ({ iso, tentative: false })),
    ...FALL_RAIN_DATES.map((iso) => ({ iso, tentative: true })),
  ];

  for (const { iso, tentative } of dates) {
    if (monthOf(iso) !== month) continue;
    for (const block of FALL_YOUTH_BLOCKS) {
      entries.push({
        key: `nga-fall:${block.level.toLowerCase()}:${iso}`,
        date: iso,
        level: block.level,
        title: tentative
          ? `Fall season (rain date) — ${block.level}`
          : `Fall season — ${block.level}`,
        timeLabel: timeLabel(block.startTime, block.endTime),
        location: FALL_VENUE_SHORT,
        status: tentative ? "Tentative" : "Open",
        registered: null,
        capacity: SLOTS_PER_GROUP,
        href: null,
        source: "fall",
      });
    }
  }
  return entries;
}

export function groupByDate(
  entries: CalendarEntry[],
): Map<string, CalendarEntry[]> {
  const byDate = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const bucket = byDate.get(e.date);
    if (bucket) bucket.push(e);
    else byDate.set(e.date, [e]);
  }
  for (const bucket of byDate.values()) {
    bucket.sort(
      (a, b) =>
        levelOrder(a.level) - levelOrder(b.level) ||
        a.title.localeCompare(b.title),
    );
  }
  return byDate;
}

function levelOrder(level: CalendarLevel | null): number {
  const i = CALENDAR_LEVELS.indexOf(level as CalendarLevel);
  return i === -1 ? CALENDAR_LEVELS.length : i;
}

// ── Supply vs demand ────────────────────────────────────────────────────────

export type DayLevelCounts = Record<CrewDay, Record<CalendarLevel, number>>;

function emptyDayLevelCounts(): DayLevelCounts {
  return Object.fromEntries(
    CREW_DAYS.map((d) => [
      d,
      Object.fromEntries(CALENDAR_LEVELS.map((l) => [l, 0])) as Record<
        CalendarLevel,
        number
      >,
    ]),
  ) as DayLevelCounts;
}

/**
 * How many groupings actually RUN on each weekday, per level — the supply half
 * of the comparison. Cancelled rows don't count as supply; an unset level lands
 * nowhere (it's still visible on the grid, just not attributable to a column).
 */
export function buildSupplyByDayLevel(entries: CalendarEntry[]): DayLevelCounts {
  const counts = emptyDayLevelCounts();
  for (const e of entries) {
    if (e.status === "Cancelled") continue;
    if (!e.level) continue;
    const day = isoWeekday(e.date);
    if (!day) continue;
    counts[day][e.level] += 1;
  }
  return counts;
}

/**
 * One waiting family, reduced to the only four things this page needs. There
 * is no name, no email, no phone, and no birth year — `age` is already derived.
 */
export interface DemandRow {
  level: CalendarLevel;
  age: number | null;
  days: CrewDay[];
  area: string;
}

export interface LevelDemand {
  total: number;
  bands: Record<LeagueBand, number>;
  minAge: number | null;
  maxAge: number | null;
}

export interface DemandMatrix {
  byDayLevel: DayLevelCounts;
  byLevel: Record<CalendarLevel, LevelDemand>;
  total: number;
  /** Rows that named no preferred day — counted per level, absent from the grid. */
  dayless: number;
  /** Rows with no usable age — counted per level, absent from every band. */
  ageless: number;
}

function emptyBands(): Record<LeagueBand, number> {
  return Object.fromEntries(LEAGUE_BANDS.map((b) => [b.band, 0])) as Record<
    LeagueBand,
    number
  >;
}

/**
 * Fold waiting families into the weekday x level grid plus a per-level age
 * histogram. `dayless` and `ageless` are reported rather than silently
 * dropped: a grid that quietly omits them reads as "nobody wants Tuesday"
 * when it actually means "nobody said".
 */
export function buildDemandMatrix(rows: DemandRow[]): DemandMatrix {
  const byDayLevel = emptyDayLevelCounts();
  const byLevel = Object.fromEntries(
    CALENDAR_LEVELS.map((l) => [
      l,
      { total: 0, bands: emptyBands(), minAge: null, maxAge: null },
    ]),
  ) as Record<CalendarLevel, LevelDemand>;

  let dayless = 0;
  let ageless = 0;

  for (const row of rows) {
    const level = byLevel[row.level];
    if (!level) continue;
    level.total += 1;

    if (row.age === null) {
      ageless += 1;
    } else {
      const band = bandForAge(row.age);
      if (band) level.bands[band] += 1;
      level.minAge = level.minAge === null ? row.age : Math.min(level.minAge, row.age);
      level.maxAge = level.maxAge === null ? row.age : Math.max(level.maxAge, row.age);
    }

    const days = row.days.filter((d) => CREW_DAYS.includes(d));
    if (days.length === 0) {
      dayless += 1;
      continue;
    }
    for (const day of days) byDayLevel[day][row.level] += 1;
  }

  return {
    byDayLevel,
    byLevel,
    total: rows.length,
    dayless,
    ageless,
  };
}
