// Enrichment Collective after-school clubs — "Coach Sam" fall 2026.
//
// PARTNER-RUN, like `mvf.ts`: Enrichment Collective contracts with school
// PTAs/PTSAs, owns registration and payment, and carries the general liability
// insurance plus the assumption-of-risk / photo / enrollment releases. Nothing
// here touches NGA Stripe, and **the NGA waiver gate does not apply** — those
// families never pass through an NGA checkout. Sam is a 1099 contractor to EC.
//
// NOT A PUBLIC SURFACE. These clubs are deliberately absent from
// `GET /api/events/feed`, `/schedule`, the sitemap, and every page. Publishing a
// precise recurring time and place where identified young children gather is the
// same risk `camps.ts` mitigates by hiding `exactLocation` — applied one step
// earlier, because here the venue IS an elementary school. The exclusion is
// enforced by `e2e/invariant-events-feed-egress.spec.ts`, not by memory.
// The only consumer is the Google Calendar mirror (`skills/calendar-sync.md`),
// which reads this file directly and emits town-only calendar blocks.
//
// AGE FLOOR — the one documented exception. NGA's own rule is 6–16 strict, no
// under-6 on-ramp, and it is unchanged: every NGA form still starts at 6. The
// Tuesday club is a K–2 school, so EC asked for an intro format covering ages
// 5–8 and Sam agreed (2026-07-23 thread). That narrower/lower band belongs to
// EC's program, so it lives here as a per-club `ageMin` — exactly how
// `MVF_AGE_MIN = 8` narrows in its own file rather than moving an academy-wide
// constant. Do not propagate `ageMin: 5` to any NGA surface.
//
// DATES ARE HOLDS, NOT CONFIRMED. Stef has confirmed the days, times and towns;
// exact session dates are still "coming asap" and the Thursday time is
// unannounced. `EC_CLUBS[].dates` is a PROJECTED 9-week window (mid-Sept →
// second week of November, per Stef's description) so Sam's afternoons are
// blocked and can't be double-booked. They are NOT reconciled against the MCPS
// 2026–27 closure calendar — Nov 3 is Election Day and is commonly a closure.
// Replace each `dates` array with Stef's real dates and flip `status` to
// "confirmed" when they land; the calendar sync updates in place on the key.

/** Registration, payment, insurance and releases all sit with the partner. */
export const EC_PARTNER_NAME = "Enrichment Collective";
export const EC_PARTNER_URL = "https://www.enrichmentcollective.com";

export const EC_REGISTRATION_NOTE =
  "Registration is through and payable to Enrichment Collective, who also carry the insurance and collect the waivers.";

export const EC_HOLD_NOTE =
  "Projected dates — Enrichment Collective hasn't confirmed the session calendar yet, and these aren't checked against MCPS closures.";

export interface EcClub {
  key: string;
  weekdayLabel: string;
  /** Broad area. This is the ONLY location that ever leaves this file. */
  town: string;
  /** Named only where Stef has named it — never invent one. */
  schoolName: string | null;
  /** Display time, or null when the partner hasn't announced it. */
  startTime: string | null;
  endTime: string | null;
  ageMin: number;
  /** Null where no maximum was stated. */
  ageMax: number | null;
  status: "hold" | "confirmed";
  /**
   * Session dates, ISO date-only, WRITTEN OUT rather than computed from a
   * weekday — date arithmetic on a UTC build server is the documented repo
   * footgun, and a school-term calendar is a hand-checked decision anyway.
   */
  dates: readonly string[];
  notes: string;
}

export const EC_CLUBS: readonly EcClub[] = [
  {
    key: "olney-mon",
    weekdayLabel: "Monday",
    town: "Olney, MD",
    schoolName: null,
    startTime: "3:20 PM",
    endTime: "4:30 PM",
    ageMin: 7,
    ageMax: null,
    status: "hold",
    dates: [
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
    ],
    notes: "School not yet named by Enrichment Collective.",
  },
  {
    key: "silver-spring-tue",
    weekdayLabel: "Tuesday",
    town: "Silver Spring, MD",
    schoolName: null,
    startTime: "3:50 PM",
    endTime: "5:00 PM",
    // K–2 school. See the AGE FLOOR note at the top of this file: this is an
    // Enrichment Collective program, and it does not change NGA's 6–16 rule.
    ageMin: 5,
    ageMax: 8,
    status: "hold",
    dates: [
      "2026-09-15",
      "2026-09-22",
      "2026-09-29",
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
      "2026-11-03",
      "2026-11-10",
    ],
    notes:
      "K–2 school — intro-to-pickleball format for 5–8 year olds. Nov 3 is Election Day; verify against the MCPS calendar.",
  },
  {
    key: "derwood-wed",
    weekdayLabel: "Wednesday",
    town: "Derwood, MD",
    schoolName: null,
    startTime: "3:20 PM",
    endTime: "4:30 PM",
    ageMin: 7,
    ageMax: null,
    status: "hold",
    dates: [
      "2026-09-16",
      "2026-09-23",
      "2026-09-30",
      "2026-10-07",
      "2026-10-14",
      "2026-10-21",
      "2026-10-28",
      "2026-11-04",
      "2026-11-11",
    ],
    notes: "School not yet named by Enrichment Collective.",
  },
  {
    key: "belmont-thu",
    weekdayLabel: "Thursday",
    town: "Olney, MD",
    schoolName: "Belmont",
    // Stef confirmed the day ("hold Thursdays for Belmont") but not the hour.
    // Null keeps the calendar block all-day instead of inventing a time.
    startTime: null,
    endTime: null,
    ageMin: 7,
    ageMax: null,
    status: "hold",
    dates: [
      "2026-09-17",
      "2026-09-24",
      "2026-10-01",
      "2026-10-08",
      "2026-10-15",
      "2026-10-22",
      "2026-10-29",
      "2026-11-05",
      "2026-11-12",
    ],
    notes:
      "Time not yet announced. Nov 5 collides with the GSA activation (Nov 5–7) and MVF Fall Session II — needs resolving with Stef.",
  },
];

export function findEcClub(key: string): EcClub | undefined {
  return EC_CLUBS.find((c) => c.key === key);
}

/** Calendar title for one club. Town only — never the school name. */
export function ecClubTitle(club: EcClub): string {
  const tbd = club.startTime === null ? " (time TBD)" : "";
  const prefix = club.status === "hold" ? "[HOLD] " : "";
  return `${prefix}Coach Sam club — ${club.town.replace(/,\s*MD$/, "")} (${club.weekdayLabel.slice(0, 3)})${tbd}`;
}
