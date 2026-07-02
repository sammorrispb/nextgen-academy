// Recurring weekly-evening session templates — one entry per evening the
// seed cron keeps stocked (admin-reduction roadmap Phase 2a). A data file,
// not a Notion DB, for v1: venues change a few times a year and a one-line
// PR is fine.
//
// Field values are AUDIT-VERIFIED against the live Sessions DB (2026-07-01)
// so `legacyTitlePrefixes` matches Sam's hand-created rows — that match is
// what keeps the seeder from double-booking a date|level that already exists
// under an older title.
//
// All evenings run 6:30–7:30 PM: the MCPS permits only cover 6:30+ after
// 6/22 (Tuesday's old 6:00–7:00 in the pre-Phase-2a code was a live bug —
// permit #684275).

export const ALL_LEVELS = ["Red", "Orange", "Green", "Yellow"] as const;
export type SessionLevel = (typeof ALL_LEVELS)[number];

export interface RecurringTemplate {
  /** Day of week the session runs, 0=Sun … 6=Sat (matches Date#getUTCDay).
   * Union type so a typo'd weekday fails at compile time; validateTemplate
   * re-checks at runtime for templates injected via options. */
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Current row-title prefix; rows are titled `${titleBase} — ${level}`. */
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
      "All-levels Monday: one court per level (Red/Orange/Green/Yellow). Venue: Ridgeview MS tennis courts. Auto-seeded by the seed-tuesday-sessions cron.",
    active: true,
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
      "All-levels Tuesday: one court per level (Red/Orange/Green/Yellow). Venue: Redland MS tennis courts. Auto-seeded by the seed-tuesday-sessions cron.",
    active: true,
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
      "All-levels Wednesday: one court per level (Red/Orange/Green/Yellow). Venue: Westland MS tennis courts. Auto-seeded by the seed-tuesday-sessions cron.",
    active: true,
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
    // Historically Green/Yellow only at Shannon. Sam hasn't decided on all-4
    // yet — flipping is a one-line edit: `levels: ALL_LEVELS`.
    levels: ["Green", "Yellow"],
    courtCount: 1,
    maxCourts: 3,
    notes:
      "Thursday at Shannon: Green/Yellow, one court per level. Venue: Odessa Shannon MS tennis courts. Auto-seeded by the seed-tuesday-sessions cron.",
    active: true,
  },
];
