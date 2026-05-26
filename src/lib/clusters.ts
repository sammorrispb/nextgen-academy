// Pure helpers around the Color Cluster data — kept side-effect-free so
// they're unit-testable without a dev server.
import {
  CLUSTERS,
  RESERVED_BALL_COLOR_HEXES,
  type Cluster,
  type ClusterSlug,
} from "@/data/clusters";
import { SERVICE_AREAS, type ServiceCity } from "@/lib/seo";

export function getAllClusters(): readonly Cluster[] {
  return CLUSTERS;
}

export function getAllClusterSlugs(): ClusterSlug[] {
  return CLUSTERS.map((c) => c.slug);
}

export function getClusterBySlug(slug: string): Cluster | undefined {
  return CLUSTERS.find((c) => c.slug === slug);
}

/** Throws if any cluster hex collides with a reserved skill-ball color. */
export function assertNoSkillBallCollision(): void {
  for (const cluster of CLUSTERS) {
    if ((RESERVED_BALL_COLOR_HEXES as readonly string[]).includes(cluster.hex)) {
      throw new Error(
        `Cluster ${cluster.name} hex ${cluster.hex} collides with a reserved skill-ball color`,
      );
    }
  }
}

/** Hex tokens must be #RRGGBB uppercase. Guards drift away from globals.css tokens. */
export function isCanonicalHex(hex: string): boolean {
  return /^#[0-9A-F]{6}$/.test(hex);
}

/** All slugs must be unique and lowercase ascii. */
export function assertSlugsUniqueAndLower(): void {
  const seen = new Set<string>();
  for (const c of CLUSTERS) {
    if (seen.has(c.slug)) throw new Error(`Duplicate cluster slug: ${c.slug}`);
    if (c.slug !== c.slug.toLowerCase())
      throw new Error(`Cluster slug must be lowercase: ${c.slug}`);
    seen.add(c.slug);
  }
}

/** Cluster handoff to the existing /crew waitlist — pre-fills the cluster name. */
export function buildCrewWaitlistHref(slug: ClusterSlug): string {
  return `/crew?cluster=${encodeURIComponent(slug)}`;
}

/** True when a string is a known cluster slug — used in form validation. */
export function isClusterSlug(value: unknown): value is ClusterSlug {
  return typeof value === "string" && CLUSTERS.some((c) => c.slug === value);
}

/**
 * Maps every SERVICE_AREAS city to the cluster whose `neighborhoods` list
 * contains it. Returns undefined for any service city not covered by a
 * cluster (none today — all 8 cities map cleanly, but the helper stays
 * safe in case SERVICE_AREAS grows ahead of CLUSTERS).
 */
export function getClusterForCity(city: ServiceCity): Cluster | undefined {
  return CLUSTERS.find((c) =>
    (c.neighborhoods as readonly string[]).includes(city),
  );
}

/** Exhaustiveness guard: every SERVICE_AREAS city must map to a cluster. */
export function assertEveryServiceCityHasCluster(): void {
  const orphans = SERVICE_AREAS.filter((city) => !getClusterForCity(city));
  if (orphans.length > 0) {
    throw new Error(
      `Service cities without a cluster: ${orphans.join(", ")} — add to a CLUSTERS.neighborhoods list`,
    );
  }
}
