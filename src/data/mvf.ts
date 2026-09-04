// MVF (Montgomery Village Foundation) youth pickleball programs — marketing
// data only. Registration is through and payable to MVF via their
// ActiveCommunities portal, NOT NGA Stripe, so unlike `camps.ts` there are no
// priceEnvVar fields and no checkout coupling. Every program here links out to
// its own MVF activity page.
//
// 2026-08-08: MVF opened enrollment (2026-08-07) and published the full Fall
// 2026 lineup, which differs from the pre-Rec-Guide placeholders this file used
// to carry in three ways worth remembering:
//   1. Each fall session is TWO separate MVF activities, one per skill bracket,
//      registered independently — not one class with brackets inside it.
//   2. The venue MOVES. Only the Aug 27 intro is at Apple Ridge; both fall
//      sessions are at North Creek (see the 2026-08-27 note below — the Rec
//      Guide had Fall I at Watkins Mill). `venue` is therefore per-program —
//      there is no single MVF venue constant any more.
//   3. Times are published, so nothing here ships `timeLabel: null`.
//
// Prices are MVF's. Their portal API returns no fee to an unauthenticated
// caller, but the published 2026 Fall Recreation Guide
// (montgomeryvillage.com download id 937, p. 15) carries them — every price,
// activity number, venue, date and time below was verified against it
// 2026-08-09. If MVF changes a fee, this file is the only place to fix it.
//
// 2026-08-27 (Marnovan Alvero, MVF) — SUPERSEDES the Rec Guide on Fall I's
// venue, and is the newer source of the two. **North Creek is the default**
// while the court-renovation timeline is unresolved; if renovations begin
// mid-session MVF relocates Thursday youth classes to Watkins Mill. So the
// Rec-Guide-verified `WATKINS_MILL` is now the CONTINGENCY, not the plan —
// it stays exported and named in the fall copy for exactly that reason, and
// must not be deleted as "unused". MVF's note covered Session I explicitly;
// Session II was already North Creek and was not re-confirmed, so it is
// unchanged here. Anything published from this file should tell families to
// confirm with MVF before heading out, because the venue can still move.
//
// This correction took 7 days to land: the note arrived 08-27, the calendar
// was hand-patched, and this file kept saying Watkins Mill until 2026-09-03 —
// so /calendar-sync was reading a stale venue out of the feed and trying to
// "fix" the correct calendar back to the wrong court. When a partner moves a
// venue, this file is the fix; a calendar edit alone silently rots.
//
// 2026-08-25: MVF renamed all five activities with a "Youth Pickleball" prefix
// and the portal's URL slugs changed to match (activity IDs and numbers are
// unchanged). activityName + registerUrl below were re-verified against the
// live portal API that day; dates, times, venues and ages all still match.

export const MVF_AGE_MIN = 8;
export const MVF_AGE_MAX = 16;

/** Browse-all entry point into MVF's registration portal. */
export const MVF_REGISTRATION_SEARCH_URL =
  "https://anc.apm.activecommunities.com/montgomeryvillage/activity/search?onlineSiteId=0&activity_select_param=2&drop_in=0&activity_keyword=youth%20pickleball&viewMode=list";

export const MVF_REGISTRATION_NOTE =
  "Registration is open now and runs through the Montgomery Village Foundation — you register and pay on MVF's site, not ours. Each class below is its own MVF activity, so register for the bracket and session you want. Heads up: MVF raises registration fees by 10% starting three days before each session's first class, so registering early saves a little too.";

export const MVF_VENUE_FOOTNOTE =
  "The venue changes between sessions — check the location on each class before you register.";

export interface MvfVenue {
  /** Court name as MVF publishes it to parents. */
  name: string;
  /** MVF recreation area / community center the courts sit in. */
  center: string;
  streetAddress: string;
  locality: string;
  region: string;
  postalCode: string;
}

export const APPLE_RIDGE: MvfVenue = {
  name: "Apple Ridge Pickleball Courts",
  center: "Apple Ridge Recreation Area",
  streetAddress: "10101 Apple Ridge Road",
  locality: "Montgomery Village",
  region: "MD",
  postalCode: "20886",
};

/**
 * CONTINGENCY venue, not a scheduled one. No program points here as of
 * 2026-09-03 — MVF named it as where Thursday fall classes relocate if the
 * North Creek court renovation starts mid-session. Kept exported and
 * referenced in the fall copy on purpose; do not prune as unused.
 */
export const WATKINS_MILL: MvfVenue = {
  name: "Watkins Mill Pickleball Courts",
  center: "Watkins Mill Recreation Area",
  streetAddress: "19501 Club Lake Road",
  locality: "Montgomery Village",
  region: "MD",
  postalCode: "20886",
};

export const NORTH_CREEK: MvfVenue = {
  name: "North Creek Pickleball Courts",
  center: "North Creek Community Center",
  streetAddress: "20125 Arrowhead Road",
  locality: "Montgomery Village",
  region: "MD",
  postalCode: "20886",
};

export interface MvfPrice {
  /** e.g. "per class", "resident", "non-resident" */
  label: string;
  usd: number;
}

export interface MvfProgram {
  key: string;
  title: string;
  /**
   * MVF's own activity title. Parents match on this in the portal, so it is
   * quoted verbatim even though it uses MVF's Beginner/Advanced wording rather
   * than our Red/Orange/Green/Yellow labels.
   */
  activityName: string;
  /** MVF activity number, e.g. "1205.435". The other thing parents match on. */
  activityNumber: string;
  /** Deep link to this activity on MVF's registration portal. */
  registerUrl: string;
  /** Ball colors this class covers, in our labels — never Beginner/Pro synonyms. */
  levelLabel: string;
  venue: MvfVenue;
  /** Human date label, e.g. "Sept 3 – Oct 8, 2026". */
  dateLabel: string;
  /** ISO date-only. Same as endDate for the single intro class. */
  startDate: string;
  endDate: string;
  classCount: number;
  timeLabel: string;
  prices: MvfPrice[];
  /** Suffix after each price, e.g. "class" or "session". */
  priceUnit: string;
  description: string;
}

export const MVF_PROGRAMS: MvfProgram[] = [
  {
    key: "intro",
    title: "Youth Pickleball Intro Class",
    activityName: "Youth Pickleball Intro Class Fall (ages 8 to 16)",
    activityNumber: "1005.434",
    registerUrl:
      "https://apm.activecommunities.com/montgomeryvillage/Activity_Search/youth-pickleball-intro-class-fall-ages-8-to-16/5792",
    levelLabel: "All levels",
    venue: APPLE_RIDGE,
    dateLabel: "Thursday, August 27, 2026",
    startDate: "2026-08-27",
    endDate: "2026-08-27",
    classCount: 1,
    timeLabel: "6:00–7:00 PM",
    prices: [{ label: "per class", usd: 8 }],
    priceUnit: "class",
    description:
      "Kids learn the pickleball basics — rallying, serve and return, scoring — and get into real games. All skills welcome; courts are grouped by skill and age. We also assess your child's bracket for the fall sessions: Red/Orange or Green/Yellow.",
  },
  {
    key: "fall-1-beginner",
    title: "Fall Session I — Red / Orange",
    activityName: "Youth Pickleball Fall I Beginner (ages 8 to 16)",
    activityNumber: "1205.435",
    registerUrl:
      "https://apm.activecommunities.com/montgomeryvillage/Activity_Search/youth-pickleball-fall-i-beginner-ages-8-to-16/5790",
    levelLabel: "Red / Orange",
    venue: NORTH_CREEK,
    dateLabel: "Sept 3 – Oct 8, 2026",
    startDate: "2026-09-03",
    endDate: "2026-10-08",
    classCount: 6,
    timeLabel: "5:30–6:30 PM",
    prices: [
      { label: "resident", usd: 90 },
      { label: "non-resident", usd: 100 },
    ],
    priceUnit: "session",
    description:
      "For players still learning to rally and get into games. Structured, fun, focused sessions with routines that build confidence through rallying with like-skilled kids.",
  },
  {
    key: "fall-1-advanced",
    title: "Fall Session I — Green / Yellow",
    activityName: "Youth Pickleball Fall I Advanced (ages 8 to 16)",
    activityNumber: "1205.436",
    registerUrl:
      "https://apm.activecommunities.com/montgomeryvillage/Activity_Search/youth-pickleball-fall-i-advanced-ages-8-to-16/9360",
    levelLabel: "Green / Yellow",
    venue: NORTH_CREEK,
    dateLabel: "Sept 3 – Oct 8, 2026",
    startDate: "2026-09-03",
    endDate: "2026-10-08",
    classCount: 6,
    timeLabel: "6:30–7:30 PM",
    prices: [
      { label: "resident", usd: 90 },
      { label: "non-resident", usd: 100 },
    ],
    priceUnit: "session",
    description:
      "For players who already play games and are ready to work on strategy — stacking points together, controlling the kitchen line, and playing smarter doubles.",
  },
  {
    key: "fall-2-beginner",
    title: "Fall Session II — Red / Orange",
    activityName: "Youth Pickleball Fall II Beginner (ages 8 to 16)",
    activityNumber: "1205.440",
    registerUrl:
      "https://apm.activecommunities.com/montgomeryvillage/Activity_Search/youth-pickleball-fall-ii-beginner-ages-8-to-16/9361",
    levelLabel: "Red / Orange",
    venue: NORTH_CREEK,
    dateLabel: "Oct 15 – Nov 19, 2026",
    startDate: "2026-10-15",
    endDate: "2026-11-19",
    classCount: 6,
    timeLabel: "5:30–6:30 PM",
    prices: [
      { label: "resident", usd: 90 },
      { label: "non-resident", usd: 100 },
    ],
    priceUnit: "session",
    description:
      "Same format as Session I, at North Creek. Join for one session or both — kids who did Session I keep building, and new players are welcome to start here.",
  },
  {
    key: "fall-2-advanced",
    title: "Fall Session II — Green / Yellow",
    activityName: "Youth Pickleball Fall II Advanced (ages 8 to 16)",
    activityNumber: "1205.441",
    registerUrl:
      "https://apm.activecommunities.com/montgomeryvillage/Activity_Search/youth-pickleball-fall-ii-advanced-ages-8-to-16/9362",
    levelLabel: "Green / Yellow",
    venue: NORTH_CREEK,
    dateLabel: "Oct 15 – Nov 19, 2026",
    startDate: "2026-10-15",
    endDate: "2026-11-19",
    classCount: 6,
    timeLabel: "6:30–7:30 PM",
    prices: [
      { label: "resident", usd: 90 },
      { label: "non-resident", usd: 100 },
    ],
    priceUnit: "session",
    description:
      "Game play and strategy at North Creek. Join for one session or both — Session I players keep developing, and new Green/Yellow players are welcome to start here.",
  },
];
