import { CLUSTERS, type ClusterSlug } from "@/data/clusters";
import { resolveClusterBand, SEASON_YEAR } from "./cluster-age";

// Validator for cluster season registration (env- and gate-blocked until a
// cluster's coach + venue are locked — see src/data/cluster-launch-gates.ts).
// Cluster training is public GROUP play, so the site-wide rule applies:
// Green/Yellow ball only; Red/Orange families route to the private-lesson
// bridge (the newcomer onramp), not into a group they're not ready for.

export interface ClusterFormData {
  clusterSlug: string;
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  /** Full ISO birthdate — bands resolve as of Sept 1 (see cluster-age.ts). */
  childBirthDate: string;
  ballLevel: string;
  emergencyName: string;
  emergencyPhone: string;
  allergies: string;
  smsConsent: boolean;
  /** Opt-IN to public first-name display. Omitted/false = never shown. */
  displayConsent?: boolean;
}

export type ClusterValidationErrors = Partial<
  Record<keyof ClusterFormData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GROUP_BALL_LEVELS = new Set(["Green", "Yellow"]);

function isClusterSlug(value: string): value is ClusterSlug {
  return CLUSTERS.some((c) => c.slug === value);
}

export function validateClusterForm(
  data: Partial<ClusterFormData>,
): ClusterValidationErrors {
  const errors: ClusterValidationErrors = {};

  if (!data.clusterSlug?.trim() || !isClusterSlug(data.clusterSlug.trim())) {
    errors.clusterSlug = "Pick your area's cluster";
  }
  if (!data.parentName?.trim()) errors.parentName = "Parent name is required";
  if (!data.email?.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors.email = "Please enter a valid email";
  }
  if (!data.phone?.trim()) errors.phone = "Phone is required";
  if (!data.childFirstName?.trim()) {
    errors.childFirstName = "Player first name is required";
  }

  const band = resolveClusterBand(data.childBirthDate ?? "");
  if (!data.childBirthDate?.trim()) {
    errors.childBirthDate = "Player birthdate is required";
  } else if (band === null) {
    errors.childBirthDate = `Clusters are for players who are 10–14 on Sept 1, ${SEASON_YEAR}. For younger or older players, reach out about private lessons and we'll find the right fit.`;
  }

  if (!data.ballLevel?.trim() || !GROUP_BALL_LEVELS.has(data.ballLevel.trim())) {
    errors.ballLevel =
      "Cluster training is Green and Yellow ball. Red and Orange ball players start with private lessons — a free evaluation is the first step.";
  }

  if (!data.emergencyName?.trim()) {
    errors.emergencyName = "Emergency contact name is required";
  }
  if (!data.emergencyPhone?.trim()) {
    errors.emergencyPhone = "Emergency contact phone is required";
  }
  // The liability waiver is now a one-time e-signature on file (gated at
  // checkout by /api/checkout-cluster), not a per-registration checkbox.

  return errors;
}

export interface ClusterRegistrationKey {
  childFirstName: string;
  parentEmail: string;
  clusterSlug: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function isDuplicateClusterRegistration(
  existing: readonly ClusterRegistrationKey[],
  candidate: ClusterRegistrationKey,
): boolean {
  return existing.some(
    (row) =>
      normalize(row.childFirstName) === normalize(candidate.childFirstName) &&
      normalize(row.parentEmail) === normalize(candidate.parentEmail) &&
      normalize(row.clusterSlug) === normalize(candidate.clusterSlug),
  );
}
