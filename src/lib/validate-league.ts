import {
  LEAGUE_AGE_MIN,
  LEAGUE_AGE_MAX,
  findSeasonBySlug,
  findPriceOption,
} from "@/data/leagues";

// Validator for the season ENROLLMENT checkout (distinct from the league
// interest form). This backs the env-gated Stripe scaffold — full-pay only for
// v1. It is built ahead of launch so flipping the season live is a price-ID +
// public-CTA change, not new plumbing.

export interface LeagueFormData {
  seasonSlug: string;
  priceKey: string;
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

export type LeagueValidationErrors = Partial<Record<keyof LeagueFormData, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Plausible birth-year range for a league player. Recomputed each call so the
// range stays anchored to the current year.
function birthYearRange(): { min: number; max: number } {
  const thisYear = new Date().getFullYear();
  return { min: thisYear - LEAGUE_AGE_MAX, max: thisYear - LEAGUE_AGE_MIN };
}

export function validateLeagueForm(
  data: Partial<LeagueFormData>,
): LeagueValidationErrors {
  const errors: LeagueValidationErrors = {};

  if (!data.seasonSlug?.trim() || !findSeasonBySlug(data.seasonSlug)) {
    errors.seasonSlug = "Pick a season";
  }
  if (!data.priceKey?.trim() || !findPriceOption(data.priceKey)) {
    errors.priceKey = "Pick an enrollment option";
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
      errors.childBirthYear = `League is for ages ${LEAGUE_AGE_MIN}–${LEAGUE_AGE_MAX} (birth year ${min}–${max})`;
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
  // The liability waiver is now a one-time e-signature on file (gated at
  // checkout by /api/checkout-league), not a per-registration checkbox.

  return errors;
}
