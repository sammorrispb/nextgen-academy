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
// DATES CONFIRMED 2026-08-13 from EC's published "Fall 2026 After School
// Enrichment Clubs" schedule (Stef's PDF): five clubs now (Friday added),
// every time published, every session date written out. Per EC's footer the
// dates already follow the MCPS 2026–27 calendar (no clubs on closures/early
// release) — which is why some weeks are skipped (e.g. no Mon 9/21, no
// Tue 11/3, no Fri 10/16).
//
// KEY STABILITY: the Mon–Thu keys predate this confirmation and are named for
// the towns of the ORIGINAL July hold schedule, but the day→school mapping
// changed when EC finalized (Tuesday is now Candlewood/Derwood; Wednesday is
// now RHES/Silver Spring). The keys are the calendar-mirror identity and the
// sync updates blocks in place on them, so they deliberately keep their old
// names — the school/town FIELDS are the truth, not the key text.

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
    // Key predates the confirmed schedule (see KEY STABILITY above) —
    // Greenwood ES sits in Brookeville, on the Olney border.
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
    notes:
      "8 sessions. Dismissal 3:25 PM. No club 9/21 or 11/2 (MCPS calendar).",
  },
  {
    // Key predates the confirmed schedule — Tuesday is now Candlewood ES in
    // Derwood, not the Silver Spring K–2 school (that club moved to Wednesday).
    key: "silver-spring-tue",
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
    notes: "8 sessions. Dismissal 3:25 PM. No club 11/3 (Election Day).",
  },
  {
    // Key predates the confirmed schedule — Wednesday is now RHES (as EC
    // abbreviates it) in Silver Spring. Believed to be the K–2 school the
    // 5–8 intro format was agreed for (2026-07-23 thread) — the AGE FLOOR
    // note at the top of this file applies; confirm the band with Stef.
    key: "derwood-wed",
    weekdayLabel: "Wednesday",
    town: "Silver Spring, MD",
    schoolName: "RHES",
    startTime: "4:00 PM",
    endTime: "5:00 PM",
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
      "10 sessions. Dismissal 3:50 PM. Ends 5:00 PM — abuts the Wood Wednesday 5–6 PM NGA block; travel makes a 5:00 Wood start impossible on club days.",
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
      "10 sessions. Dismissal 3:25 PM. Nov 5 still collides with the GSA activation (Nov 5–7) and MVF Fall Session II — resolve with Stef.",
  },
  {
    key: "sherwood-fri",
    weekdayLabel: "Friday",
    town: "Silver Spring, MD",
    schoolName: "Sherwood ES",
    startTime: "4:00 PM",
    endTime: "5:00 PM",
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
      "8 sessions — added in EC's confirmed schedule (2026-08-13). Dismissal 3:50 PM. No club 10/16 (MCPS calendar); starts 9/25, not 9/18.",
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
