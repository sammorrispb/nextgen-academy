/**
 * Goal-framed seat display: show how many players are IN (filling the meter),
 * never how many seats are open. The meter's target is the session's full
 * build-out (maxCourts × 4), not the currently-open capacity — a soft-launched
 * session reads "1 of 8 in" from the first signup instead of "3 of 4 spots
 * left" that re-bases to 8 when the next court auto-opens.
 */
export function fillGoal(s: { capacity: number; maxCourts?: number }): number {
  return Math.max(s.capacity, (s.maxCourts ?? 0) * 4);
}

export function fillLabel(registered: number, goal: number): string {
  if (goal <= 0) return "";
  const r = Math.min(Math.max(0, registered), goal);
  if (r >= goal) return `Full — ${goal} of ${goal} in`;
  if (r === 0) return `0 of ${goal} in — be the first`;
  const toGo = goal - r;
  if (toGo <= 3) return `${r} of ${goal} in — ${toGo} to go`;
  return `${r} of ${goal} in`;
}

/** Plain-text meter for email text parts: ▰▰▰▱▱▱▱▱ */
export function fillBar(registered: number, goal: number): string {
  if (goal <= 0) return "";
  const r = Math.min(Math.max(0, registered), goal);
  return "▰".repeat(r) + "▱".repeat(goal - r);
}
