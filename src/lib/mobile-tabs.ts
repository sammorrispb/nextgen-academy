// One list of doors for the whole site. The top menu (desktop) reads
// NAV_LINKS; the phone bar reads TABS and MORE_LINKS. Keeping them here is how
// a door added to the menu cannot go missing on phones:
// e2e/mobile-tab-bar.spec.ts fails if NAV_LINKS has a door the bar lacks.

export interface NavLink {
  href: string;
  label: string;
}

// Seven doors, no more. The three intents Sam named map to the first three;
// "Tournaments" joined 2026-10-31 for the MVF junior series. Everything else
// (Fall Season, Camp, Pickl Park, Clusters, Monday Girls, Newsletter, Crew)
// stays live and reachable from the schedule page, footer, and homepage
// cards. It just stops competing for attention up here.
export const NAV_LINKS: readonly NavLink[] = [
  { href: "#start", label: "Start Here" },
  { href: "/lessons", label: "Lessons" },
  { href: "/league", label: "Leagues" },
  { href: "/montgomery-village-youth-pickleball", label: "MVF Classes" },
  { href: "/mvf-junior-tournament", label: "Tournaments" },
  { href: "/schedule", label: "Schedule" },
  { href: "#about", label: "About" },
];

export type TabKey = "home" | "levels" | "schedule";

/** The fixed tabs. With the More tab and the page's action that makes five,
 * the brand guide's ceiling for a phone bar. */
export const TABS: readonly (NavLink & { key: TabKey })[] = [
  { key: "home", href: "/", label: "Home" },
  { key: "levels", href: "/levels", label: "Levels" },
  { key: "schedule", href: "/schedule", label: "Schedule" },
];

/**
 * Every menu door the tabs do not carry, in menu order. Derived, not typed:
 * a door added to NAV_LINKS lands here unless a tab already opens it. Home
 * page anchors become full paths so they work from any page.
 */
export const MORE_LINKS: readonly NavLink[] = NAV_LINKS.filter(
  (link) => !TABS.some((tab) => tab.href === link.href),
).map((link) => (link.href.startsWith("#") ? { ...link, href: `/${link.href}` } : link));

/** The More sheet's door for this page, if it has one. Anchors are never "the page". */
export function activeMoreHref(pathname: string | null | undefined): string | null {
  const path = (pathname ?? "").replace(/\/+$/, "") || "/";
  const match = MORE_LINKS.find((link) => !link.href.includes("#") && (path === link.href || path.startsWith(`${link.href}/`)));
  return match ? match.href : null;
}

// Staff pages are tools, not the public site: no marketing bar over a roster
// or a sign-in form. The signed-in areas carry their own navigation.
const HIDDEN_PREFIXES = ["/admin", "/coach"];

export function tabBarHidden(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function activeTab(pathname: string | null | undefined): TabKey | null {
  const path = (pathname ?? "").replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  for (const tab of TABS) {
    if (tab.href !== "/" && (path === tab.href || path.startsWith(`${tab.href}/`))) return tab.key;
  }
  return null;
}
