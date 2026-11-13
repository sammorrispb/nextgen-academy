import { LEAGUE_SEASONS } from "@/data/leagues";
import { MVF_PROGRAMS, upcomingMvfPrograms } from "@/data/mvf";

/**
 * The home page folds its reference sections (how it works, the four habits,
 * the team, the FAQ) into closed disclosures so the page a parent scrolls is
 * the short one. Old URLs, the menu and other pages still link to those
 * sections by anchor, so each disclosure carries its section's id and
 * HomeDisclosureOpener opens whichever one a link points at.
 */
const ALWAYS_FOLDED = ["how-it-works", "ease", "about", "faq"] as const;

/** Parent stories sit between the habits and the team, and only when there are any. */
export function homeFoldedIds(input: { testimonials: readonly unknown[] }): string[] {
  const ids: string[] = [...ALWAYS_FOLDED];
  if (input.testimonials.length > 0) ids.splice(ids.indexOf("about"), 0, "testimonials");
  return ids;
}

// Ids FAQSection gives each question and answer. A link to one of them has to
// open the FAQ fold it sits inside.
const INNER_ID = /^faq-(?:question|answer)-\d+$/;

/**
 * Which fold a URL fragment asks for: the fold it names, the fold it sits
 * inside, or none. Never throws: the fragment comes straight from the address
 * bar.
 */
export function disclosureIdForHash(hash: string, folded: readonly string[]): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (folded.includes(id)) return id;
  if (INNER_ID.test(id) && folded.includes("faq")) return "faq";
  return null;
}

/**
 * The "Looking to play" card names league play and MVF classes. It shows only
 * while one of them still has a date to come, so it retires itself instead of
 * pointing a parent at a season that has ended.
 */
export function playCardLive(todayIso: string): boolean {
  return (
    LEAGUE_SEASONS.some((season) => season.endDate >= todayIso) ||
    upcomingMvfPrograms(todayIso, MVF_PROGRAMS).length > 0
  );
}
