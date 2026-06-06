/**
 * Per-venue parking guidance, shown on the schedule + session pages next to
 * the (satellite) map. Keyed by a distinctive substring of the Notion
 * `Location` string, matched the same way as `inferCity` in venue-lookup.ts.
 *
 * Tips are written from the venue's satellite view + on-the-ground knowledge.
 * Keep them short and parent-facing: where to park, and the walk to the courts.
 * A venue with no entry simply hides the parking block — never guess parking
 * for a venue we haven't actually scouted (wrong parking directions are worse
 * than none).
 */

export interface VenueParking {
  /** 1–2 sentences: where to park and how to reach the courts. */
  tip: string;
  /** true while the tip is written from satellite view but not yet confirmed
   *  on the ground. Surfaced internally; not shown to parents. */
  draft?: boolean;
}

const PARKING_TIPS: Record<string, VenueParking> = {
  westland: {
    tip: "Park in the main Westland MS lot off the school entrance (Massachusetts Ave side). The tennis courts are at the north end of the campus near Westbard Ave — about a 3–5 minute walk past the baseball and soccer fields, so give yourself a few extra minutes.",
    draft: true,
  },
};

export function getParkingTip(
  location: string | null | undefined,
): VenueParking | null {
  if (!location) return null;
  const lower = location.toLowerCase();
  // Longest key first so a more specific venue name wins over a short one.
  const keys = Object.keys(PARKING_TIPS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.includes(key)) return PARKING_TIPS[key];
  }
  return null;
}
