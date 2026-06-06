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

// Keys are matched as substrings of the Notion Location string (lowercased).
const PARKING_TIPS: Record<string, VenueParking> = {
  // ── High schools (active rotation) ──
  gaithersburg: {
    tip: "Enter off Education Blvd and park in the large main lot — the tennis courts (8) sit at the west edge of the lot by the stadium field, a short walk from your car. This is also where summer camp meets.",
  },
  "walter johnson": {
    tip: "From Rockledge Dr, pull into the main school lot — the tennis courts are on the east side by the softball field, a short walk across the lot. Skip the West Parking Garage and medical lots across Rockledge Dr; those aren't the school's.",
  },
  sherwood: {
    tip: "Closest parking is the lot just north of the tennis courts (lower-center of the campus) — the courts are right at its edge. Enter off Olney–Sandy Spring Rd; if that lot's full, the front lots are a 3–4 minute walk.",
  },

  // ── Middle schools (candidates — satellite-derived, confirm on first visit) ──
  westland: {
    tip: "Park in the main Westland MS lot off the school entrance (Massachusetts Ave side). The tennis courts are at the north end of the campus near Westbard Ave — about a 3–5 minute walk past the baseball and soccer fields, so give yourself a few extra minutes.",
    draft: true,
  },
  redland: {
    tip: "Park in the main lot off Muncaster Mill Rd at the front of the school. The tennis courts (4) are behind the building at the north end by the track — head around the building to reach them, about a 3–4 minute walk.",
    draft: true,
  },
  frost: {
    tip: "Park in the front entrance loop or the lot off Scott Dr. The tennis courts sit just northwest of the main entrance — a short 1–2 minute walk. Heads up: the campus is shared with the Maryland School for Jewish Education.",
    draft: true,
  },
  sligo: {
    tip: "Enter off Dennis Ave and park in the school lot. The tennis courts (4) are at the northeast corner of the campus near the Sligo Creek Trail — walk toward the back-right of the building, about 3–4 minutes.",
    draft: true,
  },
  ridgeview: {
    tip: "Park in the main lot off Raven Rock Dr on the southeast side of the school. The 2 tennis courts are at the north end of the campus by the ball fields — a 4–5 minute walk around the building, so arrive a few minutes early.",
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
