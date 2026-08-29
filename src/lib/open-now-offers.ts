import {
  FALL_SEASON_LABEL,
  FALL_SUNDAYS,
  FALL_VENUE_SHORT,
  FALL_PUBLIC_AREA,
} from "@/data/fall-2026";
import {
  FALL_SEASON_GROUPS,
  FALL_SEASON_PRICE_USD,
} from "@/data/fall-season-2026";
import { LEAGUE_SEASONS } from "@/data/leagues";

/**
 * What a parent can act on TODAY — shared by the empty-state offer block and
 * the waitlist confirmation email so the two can never drift.
 *
 * Every card is derived from its own data file and gates itself off when that
 * thing closes, so this can't advertise a season that has ended or a league
 * whose deadline has passed. Pure and date-injected: no `new Date()` in here,
 * so the specs pin the boundaries instead of the clock.
 */

export interface OpenNowOffer {
  /** Site-relative path; email callers prefix their own origin. */
  href: string;
  eyebrow: string;
  title: string;
  detail: string;
  cta: string;
}

export function buildOpenNowOffers(
  todayIso: string,
  fallRegistrationOpen: boolean,
): OpenNowOffer[] {
  const offers: OpenNowOffer[] = [
    {
      href: "/free-evaluation",
      eyebrow: "Always open",
      title: "Free 30-minute evaluation",
      detail:
        "We'll hit with your player, place them on the Red/Orange/Green/Yellow ladder, and tell you exactly where they'd start. No cost, no commitment.",
      cta: "Book a free evaluation",
    },
  ];

  // Same gate /fall and the weekly newsletter read: the env flag AND the
  // season's own last Sunday, so the card retires itself.
  const lastSunday = FALL_SUNDAYS[FALL_SUNDAYS.length - 1];
  if (fallRegistrationOpen && todayIso <= lastSunday) {
    const groupLine = FALL_SEASON_GROUPS.map(
      (g) => `${g.label} ${g.timeLabel}`,
    ).join(" · ");
    offers.push({
      href: "/fall",
      eyebrow: "Registering now",
      title: "Fall Sunday season",
      detail: `Six Sundays, ${FALL_SEASON_LABEL}, at ${FALL_VENUE_SHORT} in ${FALL_PUBLIC_AREA}. ${groupLine}. $${FALL_SEASON_PRICE_USD} for the season.`,
      cta: "See the season",
    });
  }

  // League enrollment ships dark (checkout-league 503s until its price env is
  // set), so this points at the interest form on /league and never quotes a
  // price. Drops off once the registration deadline has passed.
  const league = LEAGUE_SEASONS.find((s) => todayIso <= s.registrationDeadline);
  if (league) {
    offers.push({
      href: "/league",
      eyebrow: "Forming now",
      title: league.title,
      detail:
        "League play for kids who want real matches on a schedule. Tell us about your player and we'll be in touch as the roster comes together.",
      cta: "Tell us about your player",
    });
  }

  return offers;
}

/** Reads the same public flag `/fall` does. */
export function fallRegistrationOpen(): boolean {
  return process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN === "true";
}
