import { findMondayGirlsSeasonGroup } from "@/data/monday-girls-season-2026";
import {
  FALL_CHILD_AGE_MIN,
  FALL_CHILD_AGE_MAX,
} from "@/lib/validate-fall-interest";

// Validator for the Monday Girls Beginner Group checkout. Structural mirror of
// validate-picklpark-registration: same parent/child/emergency field set.
//
// AGE: validated against NGA's standing site-wide 6–16 window (imported, never
// re-typed), NOT against the group's advertised 7–10 band. The band is a
// recruiting description; a form that hard-blocked outside it would have
// rejected the one CONFIRMED player in this block (age 7 when the group was
// advertised as 8–10). Whether a girl is right for a beginner peer group is a
// coach's call at placement, not a birth-year comparison at checkout.

export interface MondayGirlsRegistrationData {
  group: string;
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childBirthYear: string;
  emergencyName: string;
  emergencyPhone: string;
  /** Optional allergies / medical notes. */
  allergies: string;
  /** TCPA opt-in for SMS notifications. Default false. */
  smsConsent: boolean;
}

export type MondayGirlsRegistrationErrors = Partial<
  Record<keyof MondayGirlsRegistrationData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Plausible birth-year range for the season. Recomputed each call so the range
// stays anchored to the current year.
function birthYearRange(): { min: number; max: number } {
  const thisYear = new Date().getFullYear();
  return {
    min: thisYear - FALL_CHILD_AGE_MAX,
    max: thisYear - FALL_CHILD_AGE_MIN,
  };
}

export function validateMondayGirlsRegistration(
  data: Partial<MondayGirlsRegistrationData>,
): MondayGirlsRegistrationErrors {
  const errors: MondayGirlsRegistrationErrors = {};

  if (!data.group?.trim() || !findMondayGirlsSeasonGroup(data.group)) {
    errors.group = "Pick your player's group";
  }
  if (!data.parentName?.trim()) errors.parentName = "Parent name is required";
  if (!data.email?.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors.email = "Please enter a valid email";
  }
  if (!data.phone?.trim()) {
    errors.phone = "Phone is required";
  } else if (data.phone.replace(/\D/g, "").length < 10) {
    errors.phone = "Please enter a 10-digit phone number";
  }
  if (!data.childFirstName?.trim()) {
    errors.childFirstName = "Child first name is required";
  }
  if (!data.childBirthYear?.trim()) {
    errors.childBirthYear = "Child's birth year is required";
  } else {
    const n = Number(data.childBirthYear);
    const { min, max } = birthYearRange();
    if (Number.isNaN(n) || !Number.isInteger(n) || n < min || n > max) {
      errors.childBirthYear = `Next Gen is for ages ${FALL_CHILD_AGE_MIN}–${FALL_CHILD_AGE_MAX} (birth year ${min}–${max})`;
    }
  }
  if (!data.emergencyName?.trim()) {
    errors.emergencyName = "Emergency contact name is required";
  }
  if (!data.emergencyPhone?.trim()) {
    errors.emergencyPhone = "Emergency contact phone is required";
  } else if (data.emergencyPhone.replace(/\D/g, "").length < 10) {
    errors.emergencyPhone = "Please enter a 10-digit phone number";
  }
  // The liability waiver is a one-time e-signature on file, gated at checkout
  // by /api/checkout-monday-girls — no per-registration checkbox.

  return errors;
}

/** Roster key used by the checkout duplicate guard. */
export interface MondayGirlsRegistrationKey {
  parentEmail: string;
  childFirstName: string;
}

/**
 * Same-kid-same-group double-pay guard. Case-insensitive on both keys; a
 * sibling (different first name) passes.
 */
export function isDuplicateMondayGirlsRegistration(
  keys: readonly MondayGirlsRegistrationKey[],
  parentEmail: string,
  childFirstName: string,
): boolean {
  const email = parentEmail.trim().toLowerCase();
  const child = childFirstName.trim().toLowerCase();
  return keys.some(
    (k) =>
      k.parentEmail.trim().toLowerCase() === email &&
      k.childFirstName.trim().toLowerCase() === child,
  );
}
