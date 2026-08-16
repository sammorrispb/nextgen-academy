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
// Rosemary Hills club is a PreK–2 school, so EC asked for an intro format
// covering ages 5–8 and Sam agreed (2026-07-23 thread). That narrower/lower
// band belongs to EC's program, so it lives here as a per-club `ageMin` —
// exactly how `MVF_AGE_MIN = 8` narrows in its own file rather than moving an
// academy-wide constant. Do not propagate `ageMin: 5` to any NGA surface.
//
// SCHEDULE CONFIRMED — Stef's Fall 2026 schedule PDF (updated revision,
// 2026-08-13), which supersedes the July hold email in three ways: (1) session
// dates are real and already reconciled against the MCPS 2026–27 calendar
// ("no clubs when MCPS is closed or has an early release" — the gaps in each
// list are those closures, so do NOT "fix" a missing week); (2) the Derwood
// and Silver Spring clubs SWAPPED weekdays vs. the hold (Candlewood/Derwood is
// now Tuesday, Rosemary Hills/Silver Spring now Wednesday); and (3) there is a
// fifth club: Sherwood ES, Fridays — Sam's weekday afternoons are now booked
// Mon–Fri all fall. The updated revision publishes every club's time (each is
// dismissal + 5–10 min: 3:25 dismissal → 3:30–4:30 club, 3:50 → 4:00–5:00),
// replacing the slightly-earlier times from the July email — so nothing here
// ships `startTime: null` any more, though the all-day rule stands for any
// future club whose time isn't published.
//
// UPDATE 2026-08-16 (Sam): the Friday club moved from Sherwood ES (Sandy
// Spring) to Olney ES (Olney), 3:30–4:30 PM — superseding the Friday line of
// the 2026-08-13 PDF. Session dates are unchanged.

/** Registration, payment, insurance and releases all sit with the partner. */
export const EC_PARTNER_NAME = "Enrichment Collective";
export const EC_PARTNER_URL = "https://www.enrichmentcollective.com";

export const EC_REGISTRATION_NOTE =
  "Registration is through and payable to Enrichment Collective, who also carry the insurance and collect the waivers.";

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
   * Copied verbatim from Stef's schedule PDF; gaps are MCPS closures.
   */
  dates: readonly string[];
  notes: string;
}

export const EC_CLUBS: readonly EcClub[] = [
  {
    // Key predates the school being named (the hold called this "Olney") and
    // is kept so existing calendar blocks update in place on their key.
    key: "olney-mon",
    weekdayLabel: "Monday",
    town: "Brookeville, MD",
    schoolName: "Greenwood ES",
    startTime: "3:30 PM",
    endTime: "4:30 PM",
    ageMin: 7,
    ageMax: null,
    status: "confirmed",
    dates: [
      "2026-09-14",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
      "2026-11-09",
      "2026-11-16",
    ],
    notes: "8 sessions. No club 9/21 or 11/2 (MCPS calendar).",
  },
  {
    key: "derwood-tue",
    weekdayLabel: "Tuesday",
    town: "Derwood, MD",
    schoolName: "Candlewood ES",
    startTime: "3:30 PM",
    endTime: "4:30 PM",
    ageMin: 7,
    ageMax: null,
    status: "confirmed",
    dates: [
      "2026-09-15",
      "2026-09-22",
      "2026-09-29",
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
      "2026-11-10",
    ],
    notes:
      "8 sessions. Was the Wednesday club in the July hold; no club 11/3 (Election Day) or 11/17.",
  },
  {
    key: "silver-spring-wed",
    weekdayLabel: "Wednesday",
    town: "Silver Spring, MD",
    schoolName: "Rosemary Hills ES",
    startTime: "4:00 PM",
    endTime: "5:00 PM",
    // PreK–2 school. See the AGE FLOOR note at the top of this file: this is
    // an Enrichment Collective program, and it does not change NGA's 6–16 rule.
    ageMin: 5,
    ageMax: 8,
    status: "confirmed",
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
      "2026-11-18",
    ],
    notes:
      "10 sessions. K–2 school — intro-to-pickleball format for 5–8 year olds. Was the Tuesday club in the July hold.",
  },
  {
    key: "belmont-thu",
    weekdayLabel: "Thursday",
    town: "Olney, MD",
    schoolName: "Belmont",
    startTime: "3:30 PM",
    endTime: "4:30 PM",
    ageMin: 7,
    ageMax: null,
    status: "confirmed",
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
      "2026-11-19",
    ],
    notes:
      "10 sessions. Nov 5 collides with the GSA activation (Nov 5–7) and MVF Fall Session II — needs resolving with Stef.",
  },
  {
    // Key predates the 2026-08-16 move to Olney ES (the club started life at
    // Sherwood ES, Sandy Spring) and is kept so existing calendar blocks
    // update in place on their key — same rule as `olney-mon` above.
    key: "sandy-spring-fri",
    weekdayLabel: "Friday",
    town: "Olney, MD",
    schoolName: "Olney ES",
    startTime: "3:30 PM",
    endTime: "4:30 PM",
    ageMin: 7,
    ageMax: null,
    status: "confirmed",
    dates: [
      "2026-09-25",
      "2026-10-02",
      "2026-10-09",
      "2026-10-23",
      "2026-10-30",
      "2026-11-06",
      "2026-11-13",
      "2026-11-20",
    ],
    notes:
      "8 sessions. New fifth club, first announced in the confirmed PDF; moved from Sherwood ES (Sandy Spring) to Olney ES 2026-08-16, same dates. Starts a week+ after the others (9/25); no club 10/16.",
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
