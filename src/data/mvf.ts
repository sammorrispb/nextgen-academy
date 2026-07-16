// MVF (Montgomery Village Foundation) youth pickleball programs — marketing
// data only. Registration is through and payable to MVF, NOT NGA Stripe, so
// unlike `camps.ts` there are no priceEnvVar fields and no checkout coupling.
// Prices/dates come from MVF; everything here is subject to the final MVF
// Fall Rec Guide. Fall class times + age sub-groupings are deliberately TBD
// (Sam's call): show only dates + prices until the Rec Guide publishes.

export const MVF_AGE_MIN = 8;
export const MVF_AGE_MAX = 16;

export const MVF_VENUE = "Apple Ridge Pickleball Courts";
export const MVF_VENUE_LOCALITY = "Montgomery Village";
export const MVF_VENUE_REGION = "MD";

export const MVF_REGISTRATION_NOTE =
  "Registration opens with the MVF Fall Rec Guide — registration is through and payable to the Montgomery Village Foundation.";

export const MVF_REC_GUIDE_FOOTNOTE =
  "Program details are subject to the final MVF Fall Rec Guide.";

export interface MvfPrice {
  /** e.g. "per class", "resident", "non-resident" */
  label: string;
  usd: number;
}

export interface MvfProgram {
  key: string;
  title: string;
  /** Human date label, e.g. "Sept 3 – Oct 8, 2026". */
  dateLabel: string;
  /** ISO date-only. Same as endDate for the single intro class. */
  startDate: string;
  endDate: string;
  classCount: number;
  /** Confirmed time, or null when MVF hasn't announced times yet. */
  timeLabel: string | null;
  prices: MvfPrice[];
  /** Suffix after each price, e.g. "class" or "session". */
  priceUnit: string;
  description: string;
}

export const MVF_PROGRAMS: MvfProgram[] = [
  {
    key: "intro",
    title: "MVF Youth Pickleball INTRO Class – by Next Gen Pickleball",
    dateLabel: "Thursday, August 27, 2026",
    startDate: "2026-08-27",
    endDate: "2026-08-27",
    classCount: 1,
    timeLabel: "6:00–7:00 PM",
    prices: [{ label: "per class", usd: 8 }],
    priceUnit: "class",
    description:
      "Kids learn the pickleball basics — rallying, serve and return, scoring — and get into real games. All skills welcome; courts are grouped by skill and age. We also assess your child's bracket for the Fall session classes: Red/Orange (beginner and advanced beginner) or Green/Yellow (intermediate and advanced).",
  },
  {
    key: "fall-1",
    title: "MVF Youth Pickleball Classes – Fall Session I",
    dateLabel: "Sept 3 – Oct 8, 2026",
    startDate: "2026-09-03",
    endDate: "2026-10-08",
    classCount: 6,
    timeLabel: null,
    prices: [
      { label: "resident", usd: 90 },
      { label: "non-resident", usd: 100 },
    ],
    priceUnit: "session",
    description:
      "Structured, fun, focused sessions with routines that build confidence through rallying with like-skilled kids. Players are assessed in the first session and placed into one of four skill brackets (Red/Orange or Green/Yellow). Red and Orange are still learning to rally and get into games; Green and Yellow play games and focus on strategy.",
  },
  {
    key: "fall-2",
    title: "MVF Youth Pickleball Classes – Fall Session II",
    dateLabel: "Oct 15 – Nov 19, 2026",
    startDate: "2026-10-15",
    endDate: "2026-11-19",
    classCount: 6,
    timeLabel: null,
    prices: [
      { label: "resident", usd: 90 },
      { label: "non-resident", usd: 100 },
    ],
    priceUnit: "session",
    description:
      "Same format as Session I — structured, fun, focused sessions building confidence through rallying with like-skilled kids, in the four skill brackets (Red/Orange or Green/Yellow). Join for one session or both.",
  },
];

// Cross-promo: the Link & Dink tournament at the same venue. External event —
// links out to p3.linkanddink.com, never an NGA registration surface.
export const MVF_TOURNAMENT = {
  title: "MVF Pickleball Tournament by Link and Dink",
  date: "2026-09-05",
  rainDate: "2026-09-06",
  dateLabel: "Saturday, September 5, 2026",
  rainDateLabel: "Sunday, September 6",
  timeLabel: "8:30 AM – 3:00 PM",
  ageMin: 9,
  format: "Same-partner round robin into single elimination",
  brackets: ["Advanced Beginner", "Intermediate", "Advanced"],
  prices: [
    { label: "resident", usd: 25 },
    { label: "non-resident", usd: 35 },
  ] as MvfPrice[],
  priceUnit: "player",
  url: "https://p3.linkanddink.com/popup/mvf-pickleball-tournament-2026",
} as const;
