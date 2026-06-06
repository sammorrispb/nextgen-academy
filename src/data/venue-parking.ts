/**
 * Canonical NGA venue reference — court math + parking guidance.
 *
 * COURT MATH (important): NGA books *tennis* courts from CUPF, but plays
 * *pickleball*. One rentable tennis court fits TWO pickleball courts — one on
 * each side of a portable net. So:
 *     pickleball courts = tennis courts × 2
 *     player capacity   = pickleball courts × 4   (NGA caps 4 players / court)
 *                       = tennis courts × 8
 * When you book N tennis courts in ActiveMontgomery, the session's real
 * capacity is N × 8 players — set the Notion "Court count" to the *pickleball*
 * count (2 × tennis) so the Capacity formula (courts × 4) lands right.
 *
 * Parking tips are shown to parents next to the (satellite) map; keyed by a
 * substring of the Notion `Location` string (same match style as venue-lookup).
 * A venue with no entry hides the parking block — never guess parking for a
 * venue we haven't scouted. `draft` = satellite-derived, confirm on first visit.
 * Court counts marked `confirmCount` are estimates pending Sam's verification.
 */

export const PICKLEBALL_COURTS_PER_TENNIS_COURT = 2; // one each side of the net
export const PLAYERS_PER_PICKLEBALL_COURT = 4;

export interface Venue {
  /** Pickleball-lined tennis courts rentable here (0 = nothing to rent). */
  tennisCourts: number;
  /** Parking guidance shown to parents. */
  tip: string;
  /** true = parking tip is satellite-derived, not yet confirmed on the ground. */
  draft?: boolean;
  /** true = tennisCourts is an estimate from satellite, confirm before relying. */
  confirmCount?: boolean;
  /** Planning context (not shown to parents). */
  note?: string;
}

/** Pickleball courts playable on the rentable tennis courts (tennis × 2). */
export function pickleballCourts(v: Venue): number {
  return v.tennisCourts * PICKLEBALL_COURTS_PER_TENNIS_COURT;
}

/** Max players if every pickleball court is filled (pickleball courts × 4). */
export function playerCapacity(v: Venue): number {
  return pickleballCourts(v) * PLAYERS_PER_PICKLEBALL_COURT;
}

// Keys are matched as substrings of the Notion Location string (lowercased).
const VENUES: Record<string, Venue> = {
  // ── High schools (active rotation) ──
  gaithersburg: {
    tennisCourts: 8, // 16 pickleball courts → 64 cap
    tip: "Enter off Education Blvd and park in the large main lot — the tennis courts (8) sit at the west edge of the lot by the stadium field, a short walk from your car. This is also where summer camp meets.",
  },
  "walter johnson": {
    tennisCourts: 6, // → 12 pickleball → 48 cap
    confirmCount: true,
    tip: "From Rockledge Dr, pull into the main school lot — the tennis courts are on the east side by the softball field, a short walk across the lot. Skip the West Parking Garage and medical lots across Rockledge Dr; those aren't the school's.",
  },
  sherwood: {
    tennisCourts: 6, // → 12 pickleball → 48 cap
    confirmCount: true,
    tip: "Closest parking is the lot just north of the tennis courts (lower-center of the campus) — the courts are right at its edge. Enter off Olney–Sandy Spring Rd; if that lot's full, the front lots are a 3–4 minute walk.",
  },

  // ── Middle schools (CUPF pickleball-lined; satellite-derived, confirm on first visit) ──
  westland: {
    tennisCourts: 3, // → 6 pickleball → 24 cap
    confirmCount: true,
    tip: "Park in the main Westland MS lot off the school entrance (Massachusetts Ave side). The tennis courts are at the north end of the campus near Westbard Ave — about a 3–5 minute walk past the baseball and soccer fields, so give yourself a few extra minutes.",
    draft: true,
  },
  redland: {
    tennisCourts: 4, // → 8 pickleball → 32 cap
    confirmCount: true,
    tip: "Park in the main lot off Muncaster Mill Rd at the front of the school. The tennis courts (4) are behind the building at the north end by the track — head around the building to reach them, about a 3–4 minute walk.",
    draft: true,
  },
  frost: {
    tennisCourts: 4, // CUPF lists 4; satellite looked closer to 3 — confirm
    confirmCount: true,
    tip: "Park in the front entrance loop or the lot off Scott Dr. The tennis courts sit just northwest of the main entrance — a short 1–2 minute walk. Heads up: the campus is shared with the Maryland School for Jewish Education.",
    draft: true,
  },
  sligo: {
    tennisCourts: 4, // → 8 pickleball → 32 cap
    confirmCount: true,
    tip: "Enter off Dennis Ave and park in the school lot. The tennis courts (4) are at the northeast corner of the campus near the Sligo Creek Trail — walk toward the back-right of the building, about 3–4 minutes.",
    draft: true,
  },
  ridgeview: {
    tennisCourts: 2, // → 4 pickleball → 16 cap (smallest of the candidates)
    tip: "Park in the main lot off Raven Rock Dr on the southeast side of the school. The 2 tennis courts are at the north end of the campus by the ball fields — a 4–5 minute walk around the building, so arrive a few minutes early.",
    draft: true,
  },

  // ── Free public option (not a CUPF rental) ──
  wood: {
    tennisCourts: 0, // nothing rentable here
    note: "Earle B. Wood MS sits next to 6 dedicated, lit public pickleball courts (Bauer Drive / Earle B. Wood Park, parks dept). They're FREE and high-traffic but NOT reservable — first-come only. Usable Mt-Zion-style for a free public session (~24 cap across 6 courts) and great for visibility, but you can't guarantee court availability.",
    tip: "Park in the lot off Bauer Dr by the Bauer Drive Community Recreation Center. The 6 public pickleball courts are on the east side of the campus — a short walk. Expect other players; courts are first-come.",
    draft: true,
  },
};

/** Returns the venue record whose key matches the location string, or null. */
export function getVenue(location: string | null | undefined): Venue | null {
  if (!location) return null;
  const lower = location.toLowerCase();
  // Longest key first so a more specific venue name wins over a short one.
  const keys = Object.keys(VENUES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.includes(key)) return VENUES[key];
  }
  return null;
}

/** Parking-only accessor kept for callers that just need the tip. */
export function getParkingTip(
  location: string | null | undefined,
): Pick<Venue, "tip" | "draft"> | null {
  return getVenue(location);
}
