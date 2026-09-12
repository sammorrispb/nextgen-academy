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
//
// UPDATE 2026-09-03 (Sam): the Wednesday club moved from Rosemary Hills ES
// (Silver Spring) to DuFief ES (North Potomac) — superseding the Wednesday
// line of the 2026-08-13 PDF. Time (4:00–5:00 PM) and session dates are
// unchanged; only the venue moved. DuFief is 15001 DuFief Drive, Gaithersburg
// 20878 by mailing address but North Potomac by community, and `town` is the
// one field that leaves this file, so it reads North Potomac on the calendar.
//
// This move RETIRED the age-floor exception this file used to carry. The
// 5–8 band was granted because Rosemary Hills is a PreK–2 building; DuFief is
// K–5, so the Wednesday club reverts to `ageMin: 7` like the other four and
// NGA's 6–16 rule now has no carve-out anywhere in this program. Re-open one
// only if a partner asks and Sam agrees again — don't infer it from a date.
//
// UPDATE 2026-09-09 (Stef's revised schedule PDF, "Coach Sam — Weekly
// Schedule", handed over by Sam 2026-09-09). Supersedes the 2026-08-13 PDF.
// Session dates are untouched everywhere; exactly two things changed:
//
//   1. EVERY CLUB TIME MOVED. Mon-Thu are now 3:20-4:30 PM; Friday is
//      3:50-5:00 PM. These are 70-minute blocks, not the 60-minute blocks
//      the 2026-08-13 revision published, so the "dismissal + 5-10 min"
//      derivation described above no longer describes them. The partner
//      publishes the times and we copy them; we never compute them.
//      Wednesday moved furthest: 4:00-5:00 PM -> 3:20-4:30 PM.
//
//   2. THE FRIDAY CLUB IS BACK AT SHERWOOD ES (Sandy Spring), 3:50-5:00 PM.
//      This REVERSES the 2026-08-16 move to Olney ES recorded above. The
//      revised PDF postdates that move — it already carries the 2026-09-03
//      DuFief swap — and Sam confirmed 2026-09-09 that the PDF wins. Read
//      the 2026-08-16 paragraph above as history, not as current state.

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
    startTime: "3:20 PM",
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
    startTime: "3:20 PM",
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
    // Key predates the 2026-09-03 move to DuFief ES (the club started life at
    // Rosemary Hills ES, Silver Spring) and is kept so existing calendar blocks
    // update in place on their key — same rule as `olney-mon` and
    // `sandy-spring-fri`.
    key: "silver-spring-wed",
    weekdayLabel: "Wednesday",
    town: "North Potomac, MD",
    schoolName: "DuFief ES",
    startTime: "3:20 PM",
    endTime: "4:30 PM",
    ageMin: 7,
    ageMax: null,
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
      "10 sessions. Was the Tuesday club in the July hold; moved from Rosemary Hills ES (Silver Spring) to DuFief ES (North Potomac) 2026-09-03 with the time unchanged, then retimed 4:00-5:00 PM to 3:20-4:30 PM by Stef's 2026-09-09 PDF; dates unchanged. The 5–8 intro format retired with the move — DuFief is K–5, so this club is 7+ like the others.",
  },
  {
    key: "belmont-thu",
    weekdayLabel: "Thursday",
    town: "Olney, MD",
    schoolName: "Belmont",
    startTime: "3:20 PM",
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
      "10 sessions. Nov 5 club coverage resolved 2026-09-03 — Stef arranged cover for Nov 5–6. The GSA activation (Nov 5–7) vs MVF Fall Session II collision on that date is a separate problem and still open.",
  },
  {
    // Key outlived a round trip: the club started at Sherwood ES (Sandy
    // Spring), moved to Olney ES on 2026-08-16, then moved BACK to Sherwood on
    // 2026-09-09, so the key matches the town again. Kept stable throughout so
    // existing calendar blocks update in place — same rule as `olney-mon`.
    key: "sandy-spring-fri",
    weekdayLabel: "Friday",
    town: "Sandy Spring, MD",
    schoolName: "Sherwood ES",
    startTime: "3:50 PM",
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
      "8 sessions. New fifth club, first announced in the confirmed PDF. Moved to Olney ES 2026-08-16, then moved BACK to Sherwood ES (Sandy Spring) by Stef's 2026-09-09 revised PDF (confirmed by Sam 2026-09-09); dates unchanged throughout. Starts a week+ after the others (9/25); no club 10/16.",
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
