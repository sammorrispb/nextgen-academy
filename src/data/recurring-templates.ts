// Recurring session templates — one entry per evening the seed cron keeps
// stocked (admin-reduction roadmap Phase 2a). A data file, not a Notion DB,
// for v1: venues change a few times a year and a one-line PR is fine.
//
// Field values are AUDIT-VERIFIED against the live Sessions DB so
// `legacyTitlePrefixes` matches every title a row has ever carried — that
// match is what keeps the seeder from double-booking a date|level that already
// exists under an older title.
//
// 2026-07-21 — WEEKEND MOVE. Weeknight evenings didn't work for parents and
// collided with Link & Dink's weekday nights, so youth sessions moved to
// Saturday/Sunday at the two best-performing venues (Earle B. Wood MS on
// Saturdays, Walter Johnson HS on Sundays). New evening shape: Red & Orange
// 6–7 PM, Green & Yellow 7–8 PM (one reserved tennis court per evening splits
// into two pickleball courts — a level per court).
//   * The four weeknight templates are kept but `active: false` so the cron
//     stops seeding them AND their already-seeded rows stay recognized by the
//     row-family idempotency matcher (a Cancelled weeknight row is never
//     resurrected).
//   * The weekend templates are `active: false` too, because the first weekend
//     block (Aug 2026) is HAND-SEEDED in Notion: Sam is away Aug 8–16 and the
//     block starts Aug 1, so the run has holes the weekly cron can't express
//     (it seeds every occurrence of a weekday, no skips). To resume open-ended
//     auto-seeding of the weekend cadence once it runs gap-free, flip the two
//     weekend templates to `active: true`.

export const ALL_LEVELS = ["Red", "Orange", "Green", "Yellow"] as const;
export type SessionLevel = (typeof ALL_LEVELS)[number];

export interface RecurringTemplate {
  /** Day of week the session runs, 0=Sun … 6=Sat (matches Date#getUTCDay).
   * Union type so a typo'd weekday fails at compile time; validateTemplate
   * re-checks at runtime for templates injected via options. */
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Current row-title prefix; rows are titled `${titleBase} — ${level}`. A
   * venue-day may have two templates sharing one titleBase (an early and a
   * late time block) whose `levels` are disjoint — the rows still get unique
   * date|level identity keys. */
  titleBase: string;
  /** EVERY title prefix this evening's rows have ever carried (including the
   * current one). The idempotency matcher treats a row starting with any of
   * these as "this evening already exists for that date|level". */
  legacyTitlePrefixes: readonly string[];
  /** Full venue string as written to the Notion `Location` property. */
  location: string;
  /** Broad public-facing area fallback (`Public Area` property). */
  publicArea: string;
  startTime: string;
  endTime: string;
  /** Levels this evening seeds — one row (= one court) per level. */
  levels: readonly SessionLevel[];
  /** Soft-launch court count per level row (may auto-expand — see
   * computeRegistrationIncrement). */
  courtCount: number;
  maxCourts: number;
  notes: string;
  /** false = keep the template on file but seed nothing. */
  active: boolean;
}

export const RECURRING_TEMPLATES: readonly RecurringTemplate[] = [
  // ── Weekend format (current) ─────────────────────────────────────────────
  // Earle B. Wood MS — Saturdays. Red/Orange share the 6–7 court; Green/Yellow
  // the 7–8 court. active:false — Aug 2026 is hand-seeded (see file header).
  {
    weekday: 6,
    titleBase: "Wood Saturday Evening",
    legacyTitlePrefixes: ["Wood Saturday Evening"],
    location:
      "Earle B. Wood Middle School Tennis Courts, 14615 Bauer Dr, Rockville, MD 20853",
    publicArea: "Rockville, MD",
    startTime: "6:00 PM",
    endTime: "7:00 PM",
    levels: ["Red", "Orange"],
    courtCount: 1,
    maxCourts: 1,
    notes:
      "Saturday weekend format: Red & Orange, 6–7 PM. Venue: Earle B. Wood MS tennis courts.",
    active: false,
  },
  {
    weekday: 6,
    titleBase: "Wood Saturday Evening",
    legacyTitlePrefixes: ["Wood Saturday Evening"],
    location:
      "Earle B. Wood Middle School Tennis Courts, 14615 Bauer Dr, Rockville, MD 20853",
    publicArea: "Rockville, MD",
    startTime: "7:00 PM",
    endTime: "8:00 PM",
    levels: ["Green", "Yellow"],
    courtCount: 1,
    maxCourts: 1,
    notes:
      "Saturday weekend format: Green & Yellow, 7–8 PM. Venue: Earle B. Wood MS tennis courts.",
    active: false,
  },
  // Walter Johnson HS — Sundays.
  {
    weekday: 0,
    titleBase: "Walter Johnson Sunday Evening",
    legacyTitlePrefixes: ["Walter Johnson Sunday Evening"],
    location:
      "Walter Johnson High School Tennis Courts, 6400 Rock Spring Dr, Bethesda, MD 20814",
    publicArea: "Bethesda, MD",
    startTime: "6:00 PM",
    endTime: "7:00 PM",
    levels: ["Red", "Orange"],
    courtCount: 1,
    maxCourts: 1,
    notes:
      "Sunday weekend format: Red & Orange, 6–7 PM. Venue: Walter Johnson HS tennis courts.",
    active: false,
  },
  {
    weekday: 0,
    titleBase: "Walter Johnson Sunday Evening",
    legacyTitlePrefixes: ["Walter Johnson Sunday Evening"],
    location:
      "Walter Johnson High School Tennis Courts, 6400 Rock Spring Dr, Bethesda, MD 20814",
    publicArea: "Bethesda, MD",
    startTime: "7:00 PM",
    endTime: "8:00 PM",
    levels: ["Green", "Yellow"],
    courtCount: 1,
    maxCourts: 1,
    notes:
      "Sunday weekend format: Green & Yellow, 7–8 PM. Venue: Walter Johnson HS tennis courts.",
    active: false,
  },

  // ── Weeknight format (retired 2026-07-21) ────────────────────────────────
  // Kept ONLY so the row-family idempotency matcher still recognizes their
  // already-seeded rows (a deliberately-Cancelled weeknight row is never
  // resurrected). active:false — the cron seeds nothing from these.
  {
    weekday: 1,
    titleBase: "Ridgeview Monday Evening",
    legacyTitlePrefixes: ["Ridgeview Monday Evening"],
    location:
      "Ridgeview Middle School Tennis Courts, 16600 Raven Rock Dr, Gaithersburg, MD 20878",
    publicArea: "Gaithersburg, MD",
    startTime: "6:30 PM",
    endTime: "7:30 PM",
    levels: ALL_LEVELS,
    courtCount: 1,
    maxCourts: 2,
    notes:
      "Retired 2026-07-21 (weeknights moved to weekend format). Kept for row-family idempotency only.",
    active: false,
  },
  {
    weekday: 2,
    titleBase: "Redland Tuesday Evening",
    // Rows seeded before the 2026-06-09 Redland move carry the old Olney name;
    // matching both prefixes keeps the seeder from ever double-seeding.
    legacyTitlePrefixes: ["Redland Tuesday Evening", "Olney Tuesday Evening"],
    location:
      "Redland Middle School Tennis Courts, 6505 Muncaster Mill Rd, Rockville, MD 20855",
    publicArea: "Derwood, MD",
    startTime: "6:30 PM",
    endTime: "7:30 PM",
    levels: ALL_LEVELS,
    courtCount: 1,
    maxCourts: 2,
    notes:
      "Retired 2026-07-21 (weeknights moved to weekend format). Kept for row-family idempotency only.",
    active: false,
  },
  {
    weekday: 3,
    titleBase: "Westland Wednesday Evening",
    legacyTitlePrefixes: ["Westland Wednesday Evening"],
    location:
      "Westland Middle School Tennis Courts, 5511 Massachusetts Ave, Bethesda, MD 20816",
    publicArea: "Bethesda, MD",
    startTime: "6:30 PM",
    endTime: "7:30 PM",
    levels: ALL_LEVELS,
    courtCount: 1,
    maxCourts: 2,
    notes:
      "Retired 2026-07-21 (weeknights moved to weekend format). Kept for row-family idempotency only.",
    active: false,
  },
  {
    weekday: 4,
    titleBase: "Shannon Thursday Evening",
    legacyTitlePrefixes: ["Shannon Thursday Evening"],
    location:
      "Odessa Shannon Middle School Tennis Courts, 11800 Monticello Ave, Silver Spring, MD 20902",
    publicArea: "Silver Spring, MD",
    startTime: "6:30 PM",
    endTime: "7:30 PM",
    levels: ["Green", "Yellow"],
    courtCount: 1,
    maxCourts: 3,
    notes:
      "Retired 2026-07-21 (weeknights moved to weekend format). Kept for row-family idempotency only.",
    active: false,
  },
];
