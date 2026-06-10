// Pure helpers around the MCPS schools data — side-effect-free and
// unit-testable without a dev server.
import type { ClusterSlug } from "@/data/clusters";
import { SCHOOLS, type School, type SchoolLevel } from "@/data/schools";

export function getSchoolsForCluster(
  cluster: ClusterSlug,
  level?: SchoolLevel,
): readonly School[] {
  return SCHOOLS.filter(
    (s) => s.cluster === cluster && (level === undefined || s.level === level),
  );
}

/** Throws if a school name appears twice — guards copy-paste drift in the data. */
export function assertSchoolNamesUnique(): void {
  const seen = new Set<string>();
  for (const s of SCHOOLS) {
    if (seen.has(s.name)) throw new Error(`Duplicate school: ${s.name}`);
    seen.add(s.name);
  }
}
