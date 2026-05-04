const DEFAULT_REF = "nga";
const UTM_SOURCE = "nga";

export function getRefSource(pathname?: string | null): string {
  if (!pathname) return DEFAULT_REF;
  if (pathname.startsWith("/yellowball")) return "nga_yellowball";
  if (pathname.startsWith("/leagues")) return "nga_leagues";
  return DEFAULT_REF;
}

export function crUrl(target: string, ref: string = UTM_SOURCE): string {
  const url = new URL(target);
  url.searchParams.set("utm_source", ref);
  return url.toString();
}

export type FamilyDest = "sammorrispb" | "mocopb";

const FAMILY_BASES: Record<FamilyDest, string> = {
  sammorrispb: "https://sammorrispb.com",
  mocopb: "https://mocopb.com",
};

/**
 * Reads the `ld_visitor` cookie (set by funnelClient.ts getOrCreateVisitorId).
 * SSR-safe: returns null when document is undefined.
 * Fail-open: any parse error returns null rather than throwing.
 */
function readLdVisitorCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const pair = document.cookie
      .split("; ")
      .find((row) => row.startsWith("ld_visitor="));
    if (!pair) return null;
    return decodeURIComponent(pair.slice("ld_visitor=".length)) || null;
  } catch {
    return null;
  }
}

export function familySiteUrl(dest: FamilyDest, path: string = "/"): string {
  const url = new URL(path, FAMILY_BASES[dest]);
  url.searchParams.set("utm_source", "nga");
  url.searchParams.set("utm_medium", "cross_family_nav");
  url.searchParams.set("utm_campaign", "family_reciprocal");
  url.searchParams.set("utm_content", `footer_${dest}`);
  const ldPid = readLdVisitorCookie();
  if (ldPid) {
    url.searchParams.set("ld_pid", ldPid);
  }
  return url.toString();
}

export function familyMarketingRef(dest: FamilyDest): string {
  return `nga_footer_${dest}`;
}
