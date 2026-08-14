/**
 * Unified public NGA events feed — the read model behind GET /api/events/feed.
 *
 * WHY THIS EXISTS: the drop-in sessions live in Notion and are already machine-
 * readable via /api/sessions/feed, but camps, the MVF classes, and the Fall 2026
 * season live only in `src/data/*.ts`. Anything downstream that wants "every NGA
 * date" — the Google Calendar mirror (see .claude/skills/calendar-sync), a
 * cross-brand schedule page, an AI scheduler — had to re-read TypeScript source
 * to find them, which is exactly how the calendar drifted out of sync with the
 * 2026-07-21 weekend move. One feed, one shape, one place to look.
 *
 * PUBLIC + UNAUTHENTICATED. Two rules bind every addition here:
 *   - Camp venues are HIDDEN (child-safety policy) — emit `publicArea`, never
 *     `exactLocation`.
 *   - No child PII — no roster names, no age stats, and (unlike the sessions
 *     feed, which the L&D schedule page needs for seat counts) no per-session
 *     registration counts either. Pinned by
 *     e2e/invariant-events-feed-egress.spec.ts.
 *
 * Sessions are rolled up to ONE item per venue-evening (Notion stores one row
 * per ball color — four colors on one evening is one thing a human attends, not
 * four), spanning the earliest start to the latest end. That makes a feed item
 * map 1:1 onto a calendar block.
 *
 * Deliberately NOT included:
 *   - The MVF tournament. It's a Link & Dink event (`MVF_TOURNAMENT.url` points
 *     at the L&D event page) and is owned by the `ld:` key namespace — emitting
 *     it here too would double-create it downstream.
 *   - League seasons. `LEAGUE_SEASONS` carries a start and end date but no
 *     per-session dates and no times, and the venue isn't booked
 *     (`exactLocation` is empty). There is nothing schedulable to emit yet.
 */
import type { NgaSession } from "@/lib/notion-sessions";
import { publicLocation } from "@/lib/session-location";
import { CAMPS, CAMP_OPTIONS, campDays, type Camp } from "@/data/camps";
import { MVF_PROGRAMS, type MvfProgram } from "@/data/mvf";
import {
  FALL_RAIN_DATES,
  FALL_SUNDAYS,
  FALL_START_TIME,
  FALL_END_TIME,
  FALL_VENUE,
} from "@/data/fall-2026";

export type EventFeedSource = "session" | "camp" | "mvf" | "fall";

export interface EventFeedItem {
  source: EventFeedSource;
  /**
   * Stable sync key, `<namespace>:<slug>:<date>`. Downstream mirrors use this
   * to decide create/update/delete, so it must stay stable across runs for the
   * same real-world event.
   */
  key: string;
  title: string;
  /** ISO date-only. */
  date: string;
  /** Display time e.g. "6:00 PM", or null when the time isn't published yet. */
  startTime: string | null;
  endTime: string | null;
  /** True exactly when `startTime` is null — the date is known, the hour isn't. */
  allDay: boolean;
  /** Public-safe venue. Never a hidden camp venue. */
  location: string;
  /** Absolute URL to the public page for this event. */
  url: string;
  /** True when the date is a hold, not a confirmed, bookable session. */
  tentative: boolean;
  status: "Open" | "Full" | "Tentative";
}

export interface EventsFeedInput {
  /** Already-fetched Notion sessions, so this module stays pure/testable. */
  sessions: NgaSession[];
}

function originFrom(siteOrigin?: string): string {
  return (
    siteOrigin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://nextgenpbacademy.com"
  ).replace(/\/$/, "");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Base name with a trailing "— Level" / "- Level" slot suffix stripped. */
function baseTitle(title: string): string {
  const [head] = title.split(/\s*[—–-]\s*/);
  return head?.trim() || title.trim();
}

/**
 * Step an ISO date-only string by whole days. Anchored at noon UTC so it never
 * off-by-ones on Vercel's UTC build servers — the repo-wide date-only hazard.
 * Same technique as `campDays()`.
 */
export function addDaysIso(dateIso: string, days: number): string {
  const ms = new Date(`${dateIso}T12:00:00Z`).getTime() + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Minutes since midnight for a display time like "6:30 PM". Null if unparseable. */
export function timeToMinutes(display: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(display.trim());
  if (!m) return null;
  const hour12 = Number(m[1]);
  const minutes = Number(m[2]);
  if (hour12 < 1 || hour12 > 12 || minutes > 59) return null;
  const pm = m[3].toUpperCase() === "PM";
  const hour24 = (hour12 % 12) + (pm ? 12 : 0);
  return hour24 * 60 + minutes;
}

/**
 * Split a human time range into start/end display strings. Handles both the
 * spaced-dash form camps use ("9:30 AM – 12:30 PM") and the tight form MVF uses
 * with a single trailing meridiem ("6:00–7:00 PM"). Returns null when the label
 * can't be parsed — callers fall back to an all-day item rather than guessing.
 */
export function parseTimeRange(
  label: string,
): { start: string; end: string } | null {
  const parts = label.split(/\s*[–—-]\s*/);
  if (parts.length !== 2) return null;

  const [start0, rawEnd] = parts.map((p) => p.trim());
  let rawStart = start0;
  // "6:00–7:00 PM" — the start borrows the end's meridiem.
  if (!/(AM|PM)$/i.test(rawStart)) {
    const meridiem = /(AM|PM)$/i.exec(rawEnd)?.[1];
    if (!meridiem) return null;
    rawStart = `${rawStart} ${meridiem.toUpperCase()}`;
  }

  const start = normalizeTime(rawStart);
  const end = normalizeTime(rawEnd);
  if (!start || !end) return null;
  return { start, end };
}

function normalizeTime(value: string): string | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!m) return null;
  if (timeToMinutes(`${m[1]}:${m[2]} ${m[3]}`) === null) return null;
  return `${Number(m[1])}:${m[2]} ${m[3].toUpperCase()}`;
}

/**
 * Sessions → one item per venue-evening. Notion holds a row per ball color;
 * a parent (and a calendar) sees one block at one venue. Cancelled/Completed
 * rows are dropped by `fetchUpcomingSessions`, but we re-filter defensively so
 * a caller passing raw rows can't leak a cancelled evening into the feed.
 */
export function buildSessionEvents(
  sessions: NgaSession[],
  origin: string,
): EventFeedItem[] {
  const groups = new Map<string, NgaSession[]>();
  for (const s of sessions) {
    if (s.status !== "Open" && s.status !== "Full") continue;
    const venue = publicLocation(s.location, s.publicArea);
    const groupKey = `${s.date}|${venue}`;
    const arr = groups.get(groupKey) ?? [];
    arr.push(s);
    groups.set(groupKey, arr);
  }

  const out: EventFeedItem[] = [];
  for (const rows of groups.values()) {
    const first = rows[0];
    const venue = publicLocation(first.location, first.publicArea);

    let startTime = first.startTime;
    let endTime = first.endTime;
    for (const s of rows) {
      const start = timeToMinutes(s.startTime);
      const best = timeToMinutes(startTime);
      if (start !== null && best !== null && start < best) startTime = s.startTime;
      const end = timeToMinutes(s.endTime);
      const latest = timeToMinutes(endTime);
      if (end !== null && latest !== null && end > latest) endTime = s.endTime;
    }

    out.push({
      source: "session",
      key: `nga-sess:${slugify(baseTitle(first.title))}:${first.date}`,
      title: baseTitle(first.title),
      date: first.date,
      startTime,
      endTime,
      allDay: false,
      location: venue,
      url: `${origin}/schedule`,
      tentative: false,
      status: rows.every((s) => s.status === "Full") ? "Full" : "Open",
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Camps → one item per camp morning. Public area only, never the exact venue. */
export function buildCampEvents(camps: Camp[], origin: string): EventFeedItem[] {
  const hours = CAMP_OPTIONS[0]?.hours ?? "";
  const range = parseTimeRange(hours);

  return camps.flatMap((camp) =>
    campDays(camp).map((date) => ({
      source: "camp" as const,
      key: `nga-camp:${camp.slug}:${date}`,
      title: `NGA Summer Camp (${camp.publicArea})`,
      date,
      startTime: range?.start ?? null,
      endTime: range?.end ?? null,
      allDay: range === null,
      location: camp.publicArea,
      url: `${origin}/camp/${camp.slug}`,
      tentative: false,
      status: "Open" as const,
    })),
  );
}

/**
 * MVF programs → one item per class date, expanded weekly from `startDate`.
 *
 * The venue is per-program, not per-file: MVF moves the fall sessions between
 * Apple Ridge, Watkins Mill, and North Creek, so a single MVF venue constant
 * would put two thirds of these classes at the wrong courts.
 *
 * `parseTimeRange` returning null still falls back to an all-day item. MVF has
 * published every time for Fall 2026, so that path is unreachable today — it
 * stays because the never-invent-a-time rule outlives this season's data.
 */
export function buildMvfEvents(
  programs: MvfProgram[],
  origin: string,
): EventFeedItem[] {
  const url = `${origin}/montgomery-village-youth-pickleball`;

  return programs.flatMap((program) => {
    const range = parseTimeRange(program.timeLabel);
    const { name, streetAddress, locality, region, postalCode } = program.venue;
    const location = `${name}, ${streetAddress}, ${locality}, ${region} ${postalCode}`;

    return Array.from({ length: program.classCount }, (_, i) => {
      const date = addDaysIso(program.startDate, i * 7);
      const suffix =
        program.classCount > 1 ? ` — class ${i + 1} of ${program.classCount}` : "";
      const tbd = range ? "" : " (time TBD)";
      return {
        source: "mvf" as const,
        key: `mvf:${program.key}:${date}`,
        title: `MVF ${program.title}${suffix}${tbd}`,
        date,
        startTime: range?.start ?? null,
        endTime: range?.end ?? null,
        allDay: range === null,
        location,
        url,
        tentative: false,
        status: "Open" as const,
      };
    });
  });
}

/**
 * Fall 2026 season → one confirmed item per Sunday (Green 1:00–2:30, Yellow
 * 2:30–4:00 back-to-back = one 1–4 PM block a mirror can hold), plus a
 * flagged hold on each rain date — those only run if a Sunday washes out, so
 * they stay `tentative` and downstream surfaces must label them as such.
 */
export function buildFallEvents(origin: string): EventFeedItem[] {
  const shared = (date: string) => ({
    source: "fall" as const,
    key: `nga-fall:sunday:${date}`,
    date,
    startTime: FALL_START_TIME,
    endTime: FALL_END_TIME,
    allDay: false,
    location: FALL_VENUE,
    url: `${origin}/fall`,
  });

  return [
    ...FALL_SUNDAYS.map((date) => ({
      ...shared(date),
      title: "NGA Fall Season — Green & Yellow",
      tentative: false,
      status: "Open" as const,
    })),
    ...FALL_RAIN_DATES.map((date) => ({
      ...shared(date),
      title: "[TENTATIVE] NGA Fall Season — rain date hold",
      tentative: true,
      status: "Tentative" as const,
    })),
  ];
}

/**
 * The whole feed, date-ascending. Pure: takes already-fetched sessions so it's
 * unit-testable without Notion.
 */
export function buildEventsFeed(
  input: EventsFeedInput,
  siteOrigin?: string,
): EventFeedItem[] {
  const origin = originFrom(siteOrigin);

  return [
    ...buildSessionEvents(input.sessions, origin),
    ...buildCampEvents(CAMPS, origin),
    ...buildMvfEvents(MVF_PROGRAMS, origin),
    ...buildFallEvents(origin),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}
