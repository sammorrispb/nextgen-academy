// NGA Color Clusters — regional youth pickleball teams launching Fall 2026.
// Each cluster owns one color from the locked NGA palette (NEVER a skill-ball
// color: Red/Orange/Green/Yellow are reserved for the ball-pathway pathway).
// See ~/.claude/plans/how-can-we-tie-crispy-narwhal.md for the full strategy.
//
// IMPORTANT: this surface is PRE-LAUNCH. No registration, no Stripe, no claims
// about specific home sites or MCPS varsity status. The /crew waitlist captures
// parent interest until coach roster + venue decisions are locked.

export type ClusterSlug = "teal" | "lime" | "orange" | "cyan";

export interface Cluster {
  slug: ClusterSlug;
  /** Display name shown to parents — always "Teal Cluster", "Lime Cluster" etc. */
  name: string;
  /** Hex from src/app/globals.css — must match a `--color-ngpa-*` token. */
  hex: string;
  /** Tailwind utility for the team color (text + border + background variants). */
  tokenClass: string;
  /** Generic region name (no specific HS / venue — operational decisions still pending). */
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
    slug: "teal",
    name: "Teal Cluster",
    hex: "#00B4D8",
    tokenClass: "ngpa-teal",
    region: "Down-County",
    neighborhoods: ["Bethesda", "North Bethesda", "Chevy Chase"],
    blurb:
      "Down-County families building real reps every week — so Fall tryouts feel like one more practice, not a test.",
    darkSurfaceOnly: false,
  },
  {
    slug: "lime",
    name: "Lime Cluster",
    hex: "#AADC00",
    tokenClass: "ngpa-lime",
    region: "Up-County",
    neighborhoods: ["Gaithersburg", "Germantown", "Clarksburg"],
    blurb:
      "Up-County families showing up week after week — the long-haul reps that turn a curious kid into a confident Fall starter.",
    darkSurfaceOnly: true,
  },
  {
    slug: "orange",
    name: "Orange Cluster",
    hex: "#FF6B2B",
    tokenClass: "ngpa-orange",
    region: "East-County",
    neighborhoods: ["Olney", "Silver Spring"],
    blurb:
      "East-County families training with intent — a clear pathway from first paddle touch through Fall school-team tryouts.",
    darkSurfaceOnly: false,
  },
  {
    slug: "cyan",
    name: "Cyan Cluster",
    hex: "#00D4FF",
    tokenClass: "ngpa-cyan",
    region: "Mid-County",
    neighborhoods: ["Rockville", "Potomac"],
    blurb:
      "Mid-County families on one squad year-round — purposeful coaching, age-division matchups, and a clear road to Fall.",
    darkSurfaceOnly: false,
  },
] as const;

/** Hex values reserved by the skill-ball pathway — clusters can NEVER use these. */
export const RESERVED_BALL_COLOR_HEXES = [
  "#FF4040", // skill red
  "#FF8C00", // skill orange (ball-orange — distinct from accent #FF6B2B)
  "#00C853", // skill green
  "#FFD600", // skill yellow
] as const;
