// NGA Clusters — regional youth pickleball teams launching Fall 2026.
// Clusters are NAMED by their MoCo area (Down-County, Up-County, East-County,
// Mid-County). Each cluster also owns one color from the locked NGA palette —
// the color is a visual recognition cue ONLY (backgrounds/chips/accents so a
// family can spot their group's info at a glance), never part of the name or
// copy. Skill-ball colors (Red/Orange/Green/Yellow) stay reserved for the
// ball pathway and can never be cluster colors.
// See ~/.claude/plans/how-can-we-tie-crispy-narwhal.md for the full strategy.
//
// IMPORTANT: this surface is PRE-LAUNCH. No registration, no Stripe, no claims
// about specific home sites or MCPS varsity status. The /crew waitlist captures
// parent interest until coach roster + venue decisions are locked.

export type ClusterSlug =
  | "down-county"
  | "up-county"
  | "east-county"
  | "mid-county";

export interface Cluster {
  slug: ClusterSlug;
  /** Display name shown to parents — always "<Area> Cluster", never a color. */
  name: string;
  /** Hex from src/app/globals.css — must match a `--color-ngpa-*` token. */
  hex: string;
  /** Tailwind utility for the team color (text + border + background variants). */
  tokenClass: string;
  /** Area name without the "Cluster" suffix — used in chips/metadata. */
  region: string;
  /** MoCo neighborhoods a parent searching for this cluster would recognize. */
  neighborhoods: readonly string[];
  /** One-sentence parent blurb. Coach-voice, no fabricated specifics, ≤180 chars. */
  blurb: string;
  /** Lime fails 1.5:1 on white per BRAND_GUIDELINES — surfaces MUST use the navy ground. */
  darkSurfaceOnly: boolean;
}

export const CLUSTERS: readonly Cluster[] = [
  {
    slug: "down-county",
    name: "Down-County Cluster",
    hex: "#00B4D8",
    tokenClass: "ngpa-teal",
    region: "Down-County",
    neighborhoods: ["Bethesda", "North Bethesda", "Chevy Chase"],
    blurb:
      "Down-County families building real reps every week — so Fall tryouts feel like one more practice, not a test.",
    darkSurfaceOnly: false,
  },
  {
    slug: "up-county",
    name: "Up-County Cluster",
    hex: "#AADC00",
    tokenClass: "ngpa-lime",
    region: "Up-County",
    neighborhoods: ["Gaithersburg", "Germantown", "Clarksburg"],
    blurb:
      "Up-County families showing up week after week — the long-haul reps that turn a curious kid into a confident Fall starter.",
    darkSurfaceOnly: true,
  },
  {
    slug: "east-county",
    name: "East-County Cluster",
    hex: "#FF6B2B",
    tokenClass: "ngpa-orange",
    region: "East-County",
    neighborhoods: ["Olney", "Silver Spring"],
    blurb:
      "East-County families training with intent — a clear pathway from first paddle touch through Fall school-team tryouts.",
    darkSurfaceOnly: false,
  },
  {
    slug: "mid-county",
    name: "Mid-County Cluster",
    hex: "#00D4FF",
    tokenClass: "ngpa-cyan",
    region: "Mid-County",
    neighborhoods: ["Rockville", "Potomac"],
    blurb:
      "Mid-County families on one squad year-round — purposeful coaching, age-division matchups, and a clear road to Fall.",
    darkSurfaceOnly: false,
  },
] as const;

/**
 * Pre-2026-06-09 the clusters were publicly named/routed by color
 * (/clusters/teal etc.). Old links, cached pages, and ?cluster= params still
 * carry these slugs — map them to the area slugs instead of 404ing/dropping.
 */
export const LEGACY_COLOR_SLUGS: Readonly<Record<string, ClusterSlug>> = {
  teal: "down-county",
  lime: "up-county",
  orange: "east-county",
  cyan: "mid-county",
};

/** Hex values reserved by the skill-ball pathway — clusters can NEVER use these. */
export const RESERVED_BALL_COLOR_HEXES = [
  "#FF4040", // skill red
  "#FF8C00", // skill orange (ball-orange — distinct from accent #FF6B2B)
  "#00C853", // skill green
  "#FFD600", // skill yellow
] as const;
