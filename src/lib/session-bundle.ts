import type { NgaSession } from "@/lib/notion-sessions";

/** Discounted price (USD) for booking both 1-hour slots in one checkout. */
export const BUNDLE_PRICE_USD = 35;

/**
 * Two consecutive 1-hour slots at the same venue/day form a bookable
 * "two-hour bundle." We pair them structurally — same date + same location,
 * different row, and time-adjacent (one slot's end time equals the other's
 * start time) — because the Notion session model has no explicit Early/Late
 * pairing field.
 *
 * Returns the adjacent slot (early or late) for the given session, or null if
 * there's no clean pair. Both slots must be bookable (Open with seats) for the
 * bundle to be offered — that gating lives at the call site, not here.
 */
export function findSiblingSlot(
  session: Pick<NgaSession, "id" | "date" | "location" | "startTime" | "endTime">,
  sessions: ReadonlyArray<
    Pick<NgaSession, "id" | "date" | "location" | "startTime" | "endTime" | "status">
  >,
): NgaSession | null {
  const norm = (t: string) => (t ?? "").trim().toLowerCase();
  const match = sessions.find(
    (s) =>
      s.id !== session.id &&
      s.status !== "Cancelled" &&
      s.date === session.date &&
      norm(s.location) === norm(session.location) &&
      (norm(s.startTime) === norm(session.endTime) ||
        norm(s.endTime) === norm(session.startTime)),
  );
  return (match as NgaSession) ?? null;
}

/**
 * Order a session and its sibling chronologically (early first), so a bundle
 * always books and renders as "early → late" regardless of which slot the
 * parent started from.
 */
export function orderSlots(
  a: Pick<NgaSession, "startTime" | "endTime">,
  b: Pick<NgaSession, "startTime" | "endTime">,
): boolean {
  // True if `a` is the earlier slot (its end == b's start).
  const norm = (t: string) => (t ?? "").trim().toLowerCase();
  return norm(a.endTime) === norm(b.startTime);
}
