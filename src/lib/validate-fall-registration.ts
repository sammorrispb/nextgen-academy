import { findFallSeasonGroup } from "@/data/fall-season-2026";
import {
  FALL_CHILD_AGE_MIN,
  FALL_CHILD_AGE_MAX,
} from "@/lib/validate-fall-interest";

// Validator for the Fall 2026 season REGISTRATION checkout (distinct from the
// /fall demand survey's validate-fall-interest). Structural mirror of
// validate-league: same parent/child/emergency field set, with the season's
// Green/Yellow group pick in place of the league's season/price selects.

export interface FallRegistrationData {
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

export type FallRegistrationErrors = Partial<
  Record<keyof FallRegistrationData, string>
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

export function validateFallRegistration(
  data: Partial<FallRegistrationData>,
): FallRegistrationErrors {
  const errors: FallRegistrationErrors = {};

  if (!data.group?.trim() || !findFallSeasonGroup(data.group)) {
    errors.group = "Pick your player's color group";
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
      errors.childBirthYear = `The season is for ages ${FALL_CHILD_AGE_MIN}–${FALL_CHILD_AGE_MAX} (birth year ${min}–${max})`;
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
  // by /api/checkout-fall — no per-registration checkbox.

  return errors;
}

/** Roster key used by the checkout duplicate guard. */
export interface FallRegistrationKey {
  parentEmail: string;
  childFirstName: string;
}

/**
 * Same-kid-same-group double-pay guard. Case-insensitive on both keys; a
 * sibling (different first name) or a second group for the same kid passes.
 */
export function isDuplicateFallRegistration(
  keys: readonly FallRegistrationKey[],
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
