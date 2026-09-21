// NGA Winter Youth League at The Pickl Park, Frederick MD.
//
// A NEW product (Sam, 2026-09-21): NGA sells this one on the NGA site —
// invoice-based signup, same pattern as lessons and the Monday Girls drop-in.
// Not to be confused with the retired Pickl Park fall Saturday (data in
// picklpark-2026.ts / picklpark-leagues-2026.ts), which The Pickl Park sells
// itself through PodPlay and which NGA must never sell or advertise.
//
// Two tracks, back to back on Saturday afternoons:
//   10U Foundations — learn and improve: coached fundamentals, drills, guided play
//   11–14 Game Time — for kids who know the basics and want to play: weekly
//                     matches, rotating partners, season standings
//
// SEASON: 6 Saturdays, Oct 17 – Nov 21, 2026. Halloween (Oct 31) plays —
// Sam's call, 2026-09-21. Indoors, so every week runs and no makeup is held.
//
// PRICING SET BY SAM 2026-09-21: $225 for 6 weeks ($37.50/session).
//
// Co-branding approved by Amar (Pickl Park owner), 2026-09-21 — this page may
// name and show the venue's public address. That is the venue's own business
// address, not a child-safety exposure.

export const PICKL_PARK_WINTER_LEAGUE_PRICE_USD = 225;
export const PICKL_PARK_WINTER_LEAGUE_KIND = "pickl-park-winter-league";
export const PICKL_PARK_WINTER_LEAGUE_TITLE = "Winter Youth League";
export const PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL = "October 17 – November 21, 2026";
export const PICKL_PARK_WINTER_LEAGUE_VENUE =
  "The Pickl Park, 355 Ballenger Center Dr, Frederick, MD";
export const PICKL_PARK_WINTER_LEAGUE_VENUE_SHORT = "The Pickl Park";
export const PICKL_PARK_WINTER_LEAGUE_PUBLIC_AREA = "Frederick, MD";
export const PICKL_PARK_WINTER_LEAGUE_SESSIONS = 6;

/** The six Saturdays — Oct 31 (Halloween) plays, Sam 2026-09-21. */
export const PICKL_PARK_WINTER_LEAGUE_SATURDAYS: readonly string[] = [
  "2026-10-17",
  "2026-10-24",
  "2026-10-31",
  "2026-11-07",
  "2026-11-14",
  "2026-11-21",
];

/** Roster target per track — informational for now; no hard cap wired up. */
export const PICKL_PARK_WINTER_LEAGUE_TRACK_SEATS = 16;

export interface PicklParkWinterLeagueTrack {
  track: "foundations-10u" | "game-time-11-14";
  label: string;
  ageLabel: string;
  /** "Saturdays 2:00–3:00 PM" — composed once so no surface re-derives it. */
  timeLabel: string;
  blurb: string;
}

export const PICKL_PARK_WINTER_LEAGUE_TRACKS: readonly PicklParkWinterLeagueTrack[] = [
  {
    track: "foundations-10u",
    label: "Foundations — 10U",
    ageLabel: "Ages 10 and under",
    timeLabel: "Saturdays 2:00–3:00 PM",
    blurb:
      "Learn and improve: coached fundamentals, fun drills, and guided play every week. No experience needed — we have loaner paddles.",
  },
  {
    track: "game-time-11-14",
    label: "Game Time — Ages 11–14",
    ageLabel: "Ages 11–14",
    timeLabel: "Saturdays 3:00–4:30 PM",
    blurb:
      "For kids who know the basics and want to play: weekly matches, rotating partners, and a season standings race — coached competition, not just open play.",
  },
];

export function findPicklParkWinterLeagueTrack(
  track: string,
): PicklParkWinterLeagueTrack | undefined {
  return PICKL_PARK_WINTER_LEAGUE_TRACKS.find((t) => t.track === track);
}
