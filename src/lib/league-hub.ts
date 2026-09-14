// The "Running now" cards on /league (AEO audit, 2026-09-13).
//
// /league was the page most likely to be cited for "youth pickleball league"
// in Montgomery or Frederick County, and it described only the PLANNED
// fixed-roster league — an interest list. The enrollable seasons had no league
// page at all. This builds one card per youth league or season that actually
// runs, straight from the season data files, so each card retires on its own
// last date without a hand edit.
//
// Rules (pinned by e2e/league-hub.spec.ts):
//   • every card names who takes registration — three programs are registered
//     off this site, and an assistant must never invent a checkout here;
//   • no card quotes a price — the linked page does, and a second copy only
//     goes stale (Pickl Park and MVF set their own).
// Pure and date-injected: no clock, no env.

import {
  FALL_PUBLIC_AREA,
  FALL_SEASON_LABEL,
  FALL_SUNDAYS,
  FALL_VENUE_SHORT,
  FALL_YOUTH_BLOCKS,
} from "@/data/fall-2026";
import { FALL_SEASON_TITLE } from "@/data/fall-season-2026";
import { MVF_AGE_MAX, MVF_AGE_MIN, upcomingMvfPrograms } from "@/data/mvf";
import {
  PICKLPARK_PUBLIC_AREA,
  PICKLPARK_SATURDAYS,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_VENUE_SHORT,
} from "@/data/picklpark-2026";
import { PICKLPARK_LEAGUES } from "@/data/picklpark-leagues-2026";
import { picklParkLeaguesOpen } from "@/lib/picklpark-registration-window";

export interface LeagueHubCard {
  key: string;
  title: string;
  /** Human dates + day/time. */
  when: string;
  /** First date (ISO) for a <time dateTime>. */
  startsOn: string;
  where: string;
  ages: string;
  levels: string;
  registrar: string;
  href: string;
  external: boolean;
}

export function buildLeagueHubCards(
  todayIso: string,
  flags: { fallRegistrationOpen: boolean },
): LeagueHubCard[] {
  const cards: LeagueHubCard[] = [];

  if (todayIso <= FALL_SUNDAYS[FALL_SUNDAYS.length - 1]) {
    cards.push({
      key: "fall",
      title: FALL_SEASON_TITLE,
      when: `Sundays, ${FALL_SEASON_LABEL}`,
      startsOn: FALL_SUNDAYS[0],
      where: `${FALL_VENUE_SHORT}, ${FALL_PUBLIC_AREA}`,
      ages: "Placed by skill",
      levels: FALL_YOUTH_BLOCKS.map((b) => `${b.level} Ball`).join(" and "),
      registrar: flags.fallRegistrationOpen
        ? "Next Gen — on this site"
        : "Next Gen — registration closed",
      href: "/fall",
      external: false,
    });
  }

  if (picklParkLeaguesOpen(todayIso)) {
    for (const league of PICKLPARK_LEAGUES) {
      cards.push({
        key: `picklpark-${league.slug}`,
        title: league.title,
        when: `Saturdays ${league.timeLabel}, ${PICKLPARK_SEASON_LABEL}`,
        startsOn: PICKLPARK_SATURDAYS[0],
        where: `${PICKLPARK_VENUE_SHORT} (indoors), ${PICKLPARK_PUBLIC_AREA}`,
        ages: league.ageLabel,
        levels: league.levelLabel,
        registrar: "The Pickl Park",
        href: league.signupUrl,
        external: true,
      });
    }
  }

  for (const program of upcomingMvfPrograms(todayIso)) {
    cards.push({
      key: `mvf-${program.key}`,
      title: `MVF Youth Pickleball — ${program.title}`,
      when: `Thursdays ${program.timeLabel}, ${program.dateLabel}`,
      startsOn: program.startDate,
      where: `${program.venue.name}, ${program.venue.locality}, MD`,
      ages: `Ages ${MVF_AGE_MIN}–${MVF_AGE_MAX}`,
      levels: program.levelLabel,
      registrar: "Montgomery Village Foundation",
      href: "/montgomery-village-youth-pickleball",
      external: false,
    });
  }

  return cards;
}
