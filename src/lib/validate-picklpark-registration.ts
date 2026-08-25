import { findPicklParkSeasonGroup } from "@/data/picklpark-season-2026";
import {
  FALL_CHILD_AGE_MIN,
  FALL_CHILD_AGE_MAX,
} from "@/lib/validate-fall-interest";

// Validator for the Pickl Park Saturday season checkout. Structural mirror of
// validate-fall-registration: same parent/child/emergency field set with the
// Pickl Park Green/Yellow group pick. The age window is NGA's standing 6–16
// (imported, never re-typed).

export interface PicklParkRegistrationData {
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

export type PicklParkRegistrationErrors = Partial<
  Record<keyof PicklParkRegistrationData, string>
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

export function validatePicklParkRegistration(
  data: Partial<PicklParkRegistrationData>,
): PicklParkRegistrationErrors {
  const errors: PicklParkRegistrationErrors = {};

  if (!data.group?.trim() || !findPicklParkSeasonGroup(data.group)) {
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
  // by /api/checkout-picklpark — no per-registration checkbox.

  return errors;
}

/** Roster key used by the checkout duplicate guard. */
export interface PicklParkRegistrationKey {
  parentEmail: string;
  childFirstName: string;
}

/**
 * Same-kid-same-group double-pay guard. Case-insensitive on both keys; a
 * sibling (different first name) or a second group for the same kid passes.
 */
export function isDuplicatePicklParkRegistration(
  keys: readonly PicklParkRegistrationKey[],
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
