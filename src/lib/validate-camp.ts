import {
  CAMP_AGE_MIN,
  CAMP_AGE_MAX,
  findCampBySlug,
  findCampOption,
} from "@/data/camps";

export interface CampFormData {
  campSlug: string;
  optionKey: string;
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childBirthYear: string;
  emergencyName: string;
  emergencyPhone: string;
  /** Optional allergies / medical notes. */
  allergies: string;
  /** Required — parent accepts the liability waiver. */
  waiverAccepted: boolean;
  /** TCPA opt-in for SMS notifications. Default false. */
  smsConsent: boolean;
}

export type CampValidationErrors = Partial<
  Record<keyof CampFormData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Plausible birth-year range for an NGA camper. Recomputed each call so the
// range stays anchored to the current year (no stale baked-in window).
function birthYearRange(): { min: number; max: number } {
  const thisYear = new Date().getFullYear();
  return { min: thisYear - CAMP_AGE_MAX, max: thisYear - CAMP_AGE_MIN };
}

export function validateCampForm(
  data: Partial<CampFormData>,
): CampValidationErrors {
  const errors: CampValidationErrors = {};

  if (!data.campSlug?.trim() || !findCampBySlug(data.campSlug)) {
    errors.campSlug = "Pick a camp week";
  }
  if (!data.optionKey?.trim() || !findCampOption(data.optionKey)) {
    errors.optionKey = "Pick a camp option";
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
      errors.childBirthYear = `Camp is for ages ${CAMP_AGE_MIN}–${CAMP_AGE_MAX} (birth year ${min}–${max})`;
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
  if (!data.waiverAccepted) {
    errors.waiverAccepted = "Please accept the waiver to register";
  }

  return errors;
}
