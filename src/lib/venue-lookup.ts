/**
 * Infers a Montgomery County, MD city/area from a free-text Notion
 * `Location` field (e.g. "Sherwood HS Tennis Courts" → "Sandy Spring").
 *
 * Used by both UpcomingSessions rendering and per-session Event JSON-LD.
 * Sam can extend the keyword table as new venues come online.
 */

const CITY_KEYWORDS: Record<string, string> = {
  // Direct city names
  rockville: "Rockville",
  "north bethesda": "North Bethesda",
  bethesda: "Bethesda",
  potomac: "Potomac",
  "chevy chase": "Chevy Chase",
  kensington: "Kensington",
  "silver spring": "Silver Spring",
  gaithersburg: "Gaithersburg",
  derwood: "Derwood",
  "aspen hill": "Aspen Hill",
  olney: "Olney",
  "sandy spring": "Sandy Spring",
  wheaton: "Wheaton",
  germantown: "Germantown",
  // MCPS high school shorthand → city
  sherwood: "Sandy Spring",
  wootton: "Rockville",
  whitman: "Bethesda",
  "walter johnson": "Bethesda",
  "richard montgomery": "Rockville",
  magruder: "Rockville",
  einstein: "Kensington",
  blair: "Silver Spring",
  northwood: "Silver Spring",
  "watkins mill": "Gaithersburg",
  "quince orchard": "Gaithersburg",
  "b-cc": "Bethesda",
  "bethesda-chevy chase": "Bethesda",
};

export function inferCity(location: string): string | null {
  if (!location) return null;
  const lower = location.toLowerCase();
  const keys = Object.keys(CITY_KEYWORDS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.includes(key)) return CITY_KEYWORDS[key];
  }
  return null;
}
