// Enrichment Collective after-school clubs — "Coach Sam" fall 2026.
//
// PARTNER-RUN, like `mvf.ts`: Enrichment Collective contracts with school
// PTAs/PTSAs, owns registration and payment, and carries the general liability
// insurance plus the assumption-of-risk / photo / enrollment releases. Nothing
// here touches NGA Stripe, and **the NGA waiver gate does not apply** — those
// families never pass through an NGA checkout. Sam is a 1099 contractor to EC.
//
// PUBLIC SCHEDULE, PRIVATE ADDRESS, NO ROSTER (Sam, 2026-09-19).
//
// This program used to be absent from every public surface. That rule was
// written when the only thing we could have published was our OWN restatement
// of a recurring time and place where identified young children gather —
// the `camps.ts` `exactLocation` risk, one step earlier, because here the
// venue IS an elementary school.
//
// What changed is not our appetite for risk; it is the factual premise. The
// partner ALREADY publishes a per-club registration page, openly and
// unauthenticated, at `enrichmentcollective.com/register/<school>/<term>/
// pickleball`. Linking it republishes nothing Enrichment Collective has not
// already published itself, and a parent cannot enrol without reaching that
// page regardless. So the boundary moves from "the program is invisible" to
// the three fields it was always really about:
//
//   PUBLIC  -> weekday, `schoolName`, `town`, session dates, display times,
//              and `registrationUrl`. Enough for a parent to register; all of
//              it already public at the destination we link to.
//   PRIVATE -> `exactLocation` (the street address) stays calendar-only, same
//              class of data as `camps.ts` `exactLocation`. A school name is a
//              searchable institution; a street address is a doorstep.
//   NEVER   -> any roster. There is no child in this file and there must not
//              be one: EC owns enrolment, so NGA never holds these names.
//
// The events feed is a SEPARATE decision and the answer there is still no
// (Sam, 2026-09-19): `/api/events/feed` is machine-readable, unauthenticated
// and mirrored onward, and a marketing page a parent reads is not the same
// surface as a syndication endpoint. `e2e/invariant-events-feed-egress.spec.ts`
// still enforces that, and now also pins `exactLocation` out of every public
// render while allowing the school name through.
//
// Any NEW consumer inherits the PUBLIC set by default — opt into
// `exactLocation` deliberately, never by copying a line from the calendar path.
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

// UPDATE 2026-09-12 (Stef, by text to Sam): THE WEDNESDAY CLUB STARTS 9/30,
// NOT 9/16. DuFief was a late addition to the season. Stef's words: "They
// were a late addition I took a gamble would be better enrolled than RHES
// and I was right but we extended enrollment by 2 weeks." That two-week
// enrollment extension pushed the first session back, so 2026-09-16 and
// 2026-09-23 are dropped from `silver-spring-wed`, which now runs 8
// sessions. The Google Calendar mirror was corrected the same day — both
// blocks deleted by key, so a later `/calendar-sync` must not re-add them.
//
// This is a DATE change, the first one in this file. Every revision above
// says "session dates are untouched"; do not pattern-match this one as
// another time/venue edit, and do not read 9/16 and 9/23 as an MCPS-closure
// gap — they are a later start, not a school closure.
//
// STILL OPEN: whether EC adds 12/2 and 12/9 at the back end to restore this
// club to 10 sessions, or it simply runs 8. Stef said in the same thread she
// had not written compensations yet, so it is still movable. Do NOT add
// those two dates on inference — only once Stef states them.
//
// Stef confirmed in the same message that the FRIDAY club starts 9/25,
// because MCPS is closed Fri 9/18. That already matches `sandy-spring-fri`
// as written here — a confirmation, not a change.

/** Registration, payment, insurance and releases all sit with the partner. */
export const EC_PARTNER_NAME = "Enrichment Collective";
export const EC_PARTNER_URL = "https://www.enrichmentcollective.com";

export const EC_REGISTRATION_NOTE =
  "Registration is through and payable to Enrichment Collective, who also carry the insurance and collect the waivers.";

export interface EcClub {
  key: string;
  weekdayLabel: string;
  /** Broad area. Fallback label when `exactLocation` is unset. */
  town: string;
  /** Named only where Stef has named it — never invent one. */
  schoolName: string | null;
  /**
   * Precise venue: school name + street address. PRIVATE CALENDAR ONLY.
   * Same class of data as `camps.ts` `exactLocation`, under the same rule —
   * it must never reach a public surface. Null falls back to `town`.
   */
  exactLocation: string | null;
  /**
   * The partner's own public registration page for THIS club. Public-safe by
   * construction: Enrichment Collective already publishes it at
   * `enrichmentcollective.com/register/<school>/<term>/pickleball`, so linking
   * it republishes nothing the partner has not.
   */
  registrationUrl: string;
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
    registrationUrl:
      "https://www.enrichmentcollective.com/register/greenwood/2026-sep/pickleball",
    exactLocation:
      "Greenwood Elementary School, 3336 Gold Mine Rd, Brookeville, MD 20833",
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
    registrationUrl:
      "https://www.enrichmentcollective.com/register/candlewood/2026-sep/pickleball",
    exactLocation:
      "Candlewood Elementary School, 7210 Osprey Dr, Rockville, MD 20855",
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
    registrationUrl:
      "https://www.enrichmentcollective.com/register/dufief/2026-sep/pickleball",
    exactLocation:
      "DuFief Elementary School, 15001 DuFief Dr, Gaithersburg, MD 20878",
    startTime: "3:20 PM",
    endTime: "4:30 PM",
    ageMin: 7,
    ageMax: null,
    status: "confirmed",
    dates: [
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
      "8 sessions, 9/30 through 11/18. Starts 9/30, not 9/16 — see the 2026-09-12 update in the header. Was the Tuesday club in the July hold; moved from Rosemary Hills ES (Silver Spring) to DuFief ES (North Potomac) 2026-09-03 with the time unchanged, then retimed 4:00-5:00 PM to 3:20-4:30 PM by Stef's 2026-09-09 PDF; dates unchanged then, and changed 2026-09-12. The 5–8 intro format retired with the move — DuFief is K–5, so this club is 7+ like the others.",
  },
  {
    key: "belmont-thu",
    weekdayLabel: "Thursday",
    town: "Olney, MD",
    schoolName: "Belmont ES",
    registrationUrl:
      "https://www.enrichmentcollective.com/register/belmont/2026-sep/pickleball",
    exactLocation:
      "Belmont Elementary School, 19528 Olney Mill Rd, Olney, MD 20832",
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
    registrationUrl:
      "https://www.enrichmentcollective.com/register/sherwood/2026-sep/pickleball",
    exactLocation:
      "Sherwood Elementary School, 1401 Olney-Sandy Spring Rd, Sandy Spring, MD 20860",
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

/**
 * Calendar title for one club. PRIVATE CALENDAR ONLY — names the school,
 * falling back to the town where Stef has not named one.
 * Never render this on a public surface; see the header.
 */
export function ecClubTitle(club: EcClub): string {
  const tbd = club.startTime === null ? " (time TBD)" : "";
  const prefix = club.status === "hold" ? "[HOLD] " : "";
  const where = club.schoolName ?? club.town.replace(/,\s*MD$/, "");
  return `${prefix}Coach Sam club — ${where} (${club.weekdayLabel.slice(0, 3)})${tbd}`;
}

/**
 * Calendar location for one club. PRIVATE CALENDAR ONLY — the full street
 * address, falling back to the town where no exact venue is recorded.
 * Never render this on a public surface; see the header.
 */
export function ecClubLocation(club: EcClub): string {
  return club.exactLocation ?? club.town;
}

/**
 * PUBLIC venue label for one club — school name plus town, never the street
 * address. `exactLocation` is the one field that stays calendar-only; see the
 * header. Falls back to the town alone where Stef has not named a school.
 */
export function ecClubPublicVenue(club: EcClub): string {
  return club.schoolName ? `${club.schoolName}, ${club.town}` : club.town;
}

/**
 * The clubs a public surface may render: confirmed only, and only those whose
 * remaining sessions have not all passed. A `hold` is an internal maybe — it
 * must never be advertised as something a parent can register for.
 *
 * `todayIso` is injected rather than read from the clock so the caller owns the
 * timezone. Date-only ISO strings compare lexicographically, which sidesteps
 * the `new Date(y, m, d)` UTC-build-server footgun this repo documents.
 */
export function isEcClubPublic(club: EcClub, todayIso: string): boolean {
  return (
    club.status === "confirmed" && club.dates.some((date) => date >= todayIso)
  );
}

export function ecPublicClubs(todayIso: string): readonly EcClub[] {
  return EC_CLUBS.filter((club) => isEcClubPublic(club, todayIso));
}

/** Sessions still to come for one club, ascending. */
export function ecRemainingDates(
  club: EcClub,
  todayIso: string,
): readonly string[] {
  return club.dates.filter((date) => date >= todayIso);
}
