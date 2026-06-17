import type {
  CrewLevel,
  CrewDay,
  CrewSubLevel,
} from "./validate-crew-interest";

/**
 * Pure crew-matching engine. Two jobs, both deterministic and dependency-free
 * so they unit-test without a dev server (see e2e/crew-matching.spec.ts):
 *
 *  1. crew↔crew — given an un-crewed Crew Interest submission and the pool of
 *     other open submissions, find families that could form a crew together.
 *     Match rule (locked 2026-06-17): same ball color, age within ±3 years,
 *     at least one shared preferred day, and an overlapping preferred area.
 *  2. crew↔session — given a family's preferences, surface the open sessions
 *     that already fit (same level + a preferred weekday + area overlap), used
 *     in the welcome email and the 7-day re-engagement nudge.
 *
 * Area is free-text, so overlap is a loose normalized substring check and an
 * empty area on either side is treated as a wildcard (don't exclude a family
 * just because they skipped the optional "near where?" field).
 */

export const AGE_GAP_MAX = 3;

const WEEKDAY_CODES: CrewDay[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

const SUB_LEVEL_ORDINAL: Record<CrewSubLevel, number> = {
  Low: 0,
  Mid: 1,
  High: 2,
};

export function ageFromBirthYear(
  year: number,
  now: Date = new Date(),
): number | null {
  if (!Number.isFinite(year) || year <= 0) return null;
  return now.getUTCFullYear() - year;
}

/**
 * Map an ISO date (YYYY-MM-DD) to its CrewDay code. Anchored at noon UTC so the
 * weekday never slips across the date line on a UTC build server (the
 * never-`new Date(y,m,d)` rule).
 */
export function isoWeekday(iso: string): CrewDay | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return WEEKDAY_CODES[d.getUTCDay()] ?? null;
}

export function normalizeArea(area: string | null | undefined): string {
  return (area ?? "").trim().toLowerCase();
}

/**
 * Loose area overlap: equal, or one normalized string contains the other.
 * Empty on either side = wildcard (matches anything) so the optional location
 * field never narrows a family out of a match.
 */
export function areaOverlap(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeArea(a);
  const nb = normalizeArea(b);
  if (!na || !nb) return true;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function sharedDays(a: CrewDay[], b: CrewDay[]): CrewDay[] {
  const setB = new Set(b);
  return a.filter((d) => setB.has(d));
}

export interface CrewCandidate {
  /** Notion page id (or any stable id) — used to exclude self from the pool. */
  id: string;
  childFirstName: string;
  childBirthYear: number;
  childLevel: CrewLevel;
  childSubLevel?: CrewSubLevel | null;
  preferredDays: CrewDay[];
  preferredArea: string;
}

export interface CrewMatch {
  candidate: CrewCandidate;
  sharedDays: CrewDay[];
  ageGap: number;
  /** Higher = stronger match. Sort key for the internal digest. */
  score: number;
}

/**
 * Hard match gate between two submissions: same level, age within ±3, ≥1 shared
 * day, overlapping area. Sub-level is NOT a gate (only ranks) so a low-Green and
 * mid-Green still surface as a possible crew.
 */
export function isCandidateMatch(
  a: CrewCandidate,
  b: CrewCandidate,
  now: Date = new Date(),
): boolean {
  if (a.id === b.id) return false;
  if (a.childLevel !== b.childLevel) return false;

  const ageA = ageFromBirthYear(a.childBirthYear, now);
  const ageB = ageFromBirthYear(b.childBirthYear, now);
  if (ageA === null || ageB === null) return false;
  if (Math.abs(ageA - ageB) > AGE_GAP_MAX) return false;

  if (sharedDays(a.preferredDays, b.preferredDays).length === 0) return false;
  if (!areaOverlap(a.preferredArea, b.preferredArea)) return false;

  return true;
}

function subLevelCloseness(
  a: CrewSubLevel | null | undefined,
  b: CrewSubLevel | null | undefined,
): number {
  if (!a || !b) return 0;
  // 2 when identical, 1 when adjacent (Low↔Mid / Mid↔High), 0 when far apart.
  return 2 - Math.abs(SUB_LEVEL_ORDINAL[a] - SUB_LEVEL_ORDINAL[b]);
}

/**
 * Rank every pool member that hard-matches `target`. Score rewards more shared
 * days, a tighter age gap, and a closer sub-level — so the strongest potential
 * crew floats to the top of Sam's digest.
 */
export function findCandidateMatches(
  target: CrewCandidate,
  pool: CrewCandidate[],
  now: Date = new Date(),
): CrewMatch[] {
  const targetAge = ageFromBirthYear(target.childBirthYear, now);
  const matches: CrewMatch[] = [];
  for (const c of pool) {
    if (!isCandidateMatch(target, c, now)) continue;
    const shared = sharedDays(target.preferredDays, c.preferredDays);
    const cAge = ageFromBirthYear(c.childBirthYear, now);
    const ageGap =
      targetAge !== null && cAge !== null ? Math.abs(targetAge - cAge) : 99;
    const score =
      shared.length * 10 +
      (AGE_GAP_MAX - ageGap) * 3 +
      subLevelCloseness(target.childSubLevel, c.childSubLevel);
    matches.push({ candidate: c, sharedDays: shared, ageGap, score });
  }
  return matches.sort((x, y) => y.score - x.score);
}

export interface SessionPreferences {
  level: CrewLevel;
  days: CrewDay[];
  area: string;
}

/** Structural subset of NgaSession needed for matching — keeps this lib pure. */
export interface MatchableSession {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  level: CrewLevel | null;
  location: string;
  publicArea: string;
  status: string;
  spotsLeft: number;
}

/**
 * Open sessions that fit a family's preferences: Open + has a seat, same level,
 * lands on a preferred weekday, and overlaps their area. Sorted soonest-first.
 */
export function matchSessionsForPreferences<T extends MatchableSession>(
  pref: SessionPreferences,
  sessions: T[],
): T[] {
  const dayset = new Set(pref.days);
  return sessions
    .filter((s) => {
      if (s.status !== "Open" || s.spotsLeft <= 0) return false;
      if (s.level !== pref.level) return false;
      const wd = isoWeekday(s.date);
      if (!wd || !dayset.has(wd)) return false;
      return areaOverlap(pref.area, s.location || s.publicArea);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
