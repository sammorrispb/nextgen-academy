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
 * CUPF HALF-RULE: `tennisCourts` below is the venue's PHYSICAL court count, but
 * CUPF only rents half the courts at a school — the rest stay open for public
 * walk-on play. So the most you can actually reserve at a venue is
 * `floor(tennisCourts / 2)`: 3 at Wood, 4 at Gaithersburg, 1 at Ridgeview.
 * Capacity helpers below deliberately compute against the physical count (what
 * the venue holds), NOT the bookable half — size a session off the half.
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
  /**
   * Pickleball-lined tennis courts AT this venue (0 = nothing to rent). This is
   * the physical count, not the bookable half — see the CUPF half-rule above.
   */
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
    note: "Fall 2026 season venue as of 2026-08-27 (Sundays, Sept 20 – Oct 25, 1–4 PM), moved here when Wood MS became unavailable. NGA reserves ONE of the 6 school tennis courts per session via CUPF — two pickleball courts, 8 players a group — so the seat count did NOT change with the move. Room to grow to 3 courts under the half-rule (6 pickleball, 24 a group): change `FALL_TENNIS_COURTS_PER_SESSION` in `fall-2026.ts` and the seats follow. Also hosts the Sunday-evening weekly drop-ins, so the parking tip here is road-tested rather than satellite-derived.",
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
  // Two DIFFERENT court clusters share this address, and conflating them is the
  // mistake this entry used to make: it recorded the park's courts, reported
  // nothing rentable, and sent parents to the wrong lot. The school's 6 tennis
  // courts (east side of campus) are the CUPF rental — that's what NGA permits
  // for the Saturday sessions and what the Aug camp ran on. The 6 dedicated
  // public pickleball courts to the north are Bauer Drive Local Park (parks
  // dept): free, lit, busy, and NOT reservable. See `note`.
  wood: {
    tennisCourts: 6, // physical; CUPF permits half → 3 bookable → 6 pickleball
    confirmCount: true,
    tip: "Enter off Bauer Dr and park in the main Earle B. Wood MS lot. Our tennis courts are on the east side of the campus, past the building — a 3–4 minute walk. Don't head for the pickleball courts up by the Bauer Drive Community Recreation Center; those are the public park's, not ours.",
    note: "STILL A LIVE VENUE — Saturday drop-in sessions and the August back-to-school camp run here; do not treat this entry as retired. It is no longer the Fall 2026 season venue: the season moved to Walter Johnson HS on 2026-08-27 when Wood became unavailable for those Sundays. NGA reserves ONE of the 6 school tennis courts per session via CUPF — two pickleball courts, 8 players — with room to grow to 3 (see the half-rule note above): 6 pickleball courts, 24 players a group. Separately, Bauer Drive Local Park to the north has 6 dedicated, lit public pickleball courts: FREE and high-traffic but NOT reservable, first-come only. Usable Mt-Zion-style for a free public session (~24 cap) and great for visibility, but you can't guarantee availability there.",
    draft: true,
  },

  // ── Commercial partner facilities (NOT CUPF; the court math above doesn't apply) ──
  // The only entry here that isn't a school. `tennisCourts: 0` is literal, not
  // a placeholder: there are no tennis courts to halve or double, because the
  // courts ARE pickleball courts booked per court per hour. Seat counts for
  // anything at this venue derive from PICKLPARK_PICKLEBALL_COURTS in
  // picklpark-2026.ts, never from pickleballCourts()/playerCapacity() here —
  // both would read 0 and both are unused outside the CUPF venues.
  //
  // It earns an entry purely for the parking tip: this is a brand-new venue in
  // a county where no NGA family has ever been, so a first-time parent gets
  // the one paragraph they actually need.
  "pickl park": {
    tennisCourts: 0,
    tip: "The Pickl Park has its own lot at 355 Ballenger Center Dr — pull in and park anywhere; check-in is straight through the main doors. It's off Ballenger Creek Pike in the Ballenger Center complex, so follow the building numbers rather than the shopping-center signs.",
    draft: true,
    note: "Commercial indoor pickleball club, 8 courts, Frederick MD. NGA's first venue outside Montgomery County (Saturday season + Open Court hour, from 2026-09-12). Courts are booked per court per hour under the standing Pickl Park arrangement — nothing here comes from CUPF, so the half-rule and the tennis→pickleball doubling are both irrelevant. Parking tip is satellite/website-derived; confirm on the first Saturday.",
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
