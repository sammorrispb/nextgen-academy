import type { NgaSession, SessionLevel } from "@/lib/notion-sessions";

const LEVEL_ORDER: Record<SessionLevel, number> = {
  Red: 0,
  Orange: 1,
  Green: 2,
  Yellow: 3,
};

export function levelRank(level: NgaSession["level"]): number {
  return level !== null && level in LEVEL_ORDER
    ? LEVEL_ORDER[level]
    : Object.keys(LEVEL_ORDER).length;
}

/** Red → Orange → Green → Yellow, unknown/no-level last. Stable. */
export function sortByLevel(sessions: NgaSession[]): NgaSession[] {
  return [...sessions].sort((a, b) => levelRank(a.level) - levelRank(b.level));
}

// Same date + time window + venue ⇒ same physical slot. Venue keys off
// location (publicArea fallback for rows where Location isn't filled yet),
// never the title — venue renames ("Olney…" → "Redland…") must not split or
// merge groups.
export function groupKey(s: NgaSession): string {
  const venue = (s.location || s.publicArea).trim().toLowerCase();
  return `${s.date}|${s.startTime}|${s.endTime}|${venue}`;
}

export type ScheduleItem =
  | { kind: "single"; session: NgaSession }
  | { kind: "group"; key: string; sessions: NgaSession[] };

/**
 * Bucket one day's sessions into render items: ≥2 sessions sharing a slot
 * (typically the four all-levels Tuesday courts) collapse into a group,
 * preserving first-appearance order of the buckets and the caller's
 * within-bucket order (pass level-sorted input).
 */
export function groupSessions(daySessions: NgaSession[]): ScheduleItem[] {
  const buckets = new Map<string, NgaSession[]>();
  for (const s of daySessions) {
    const key = groupKey(s);
    const arr = buckets.get(key) ?? [];
    arr.push(s);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([key, sessions]) =>
    sessions.length === 1
      ? { kind: "single" as const, session: sessions[0] }
      : { kind: "group" as const, key, sessions },
  );
}

export function aggregateSeats(sessions: NgaSession[]): {
  spotsLeft: number;
  capacity: number;
  allFull: boolean;
} {
  const spotsLeft = sessions.reduce((n, s) => n + s.spotsLeft, 0);
  const capacity = sessions.reduce((n, s) => n + s.capacity, 0);
  return { spotsLeft, capacity, allFull: spotsLeft === 0 };
}
