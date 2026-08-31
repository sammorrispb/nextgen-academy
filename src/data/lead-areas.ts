/**
 * Where a family wants to play — the vocabulary the empty-state waitlist form
 * offers and the waitlist route allowlists.
 *
 * ONE list, imported by both. It used to be typed twice (a client array in
 * EmptyStateWaitlist and a server Set in /api/waitlist), so adding an area
 * meant remembering both files and forgetting one silently 400s every
 * submission that picks it.
 *
 * The value lands in a Notion select, so junk strings would auto-create
 * options — which is why the route allowlists against this rather than
 * accepting free text.
 */
export const LEAD_AREAS = [
  "Anywhere in MoCo",
  "Rockville",
  "North Bethesda",
  "Bethesda",
  "Potomac",
  "Chevy Chase",
  "Kensington",
  "Silver Spring",
  "Gaithersburg",
  "Derwood",
  "Aspen Hill",
  "Olney",
  "Sandy Spring",
  // Frederick joins the list with the Pickl Park Saturday programme
  // (2026-08-31) — the first NGA venue outside Montgomery County. It sits last
  // because it is a different county, not another MoCo town, and "Anywhere in
  // MoCo" must not read as covering it.
  "Frederick",
] as const;

export type LeadArea = (typeof LEAD_AREAS)[number];

export const LEAD_AREA_SET: ReadonlySet<string> = new Set(LEAD_AREAS);
