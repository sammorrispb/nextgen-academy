/**
 * Seat status for a season group, framed by what's LEFT rather than by the cap.
 *
 * Deliberately different from `fill-meter.ts`, which publishes the goal ("3 of
 * 8 in") for drop-in sessions where the build-out is the point. Here the group
 * cap is a court-booking decision that moves — the Fall 2026 season already
 * changed venue mid-registration — and every rendered copy of that number is a
 * place it can go stale. So the label narrows as the group fills and never
 * names the denominator.
 *
 * `null` in means the roster count is unknown (Notion unavailable); `null` out
 * means render nothing, because a fabricated status is worse than none.
 *
 * `fullLabel` lets a surface keep its own wording for the full state — the
 * weekly newsletter points at the season's sub list, which is the real thing a
 * family joins, rather than the generic waitlist.
 */
export function seatStatusLabel(
  remaining: number | null,
  opts?: { fullLabel?: string },
): string | null {
  if (remaining === null) return null;
  // Clamp rather than trust: the count comes from a live roster a human can
  // add rows to past the cap.
  const left = Math.max(0, remaining);
  if (left === 0) return opts?.fullLabel ?? "Full — join the waitlist";
  if (left === 1) return "Last spot";
  if (left <= 3) return "Filling up";
  return "Spots open";
}
