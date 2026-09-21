// Validator for the Pickl Park Winter Youth League checkout
// (/api/checkout-pickl-park-winter-league). Same parent/child/emergency field
// set as the lesson and Monday Girls drop-in checkouts, plus the track
// (foundations-10u or game-time-11-14) the player is signing up for.

import { findPicklParkWinterLeagueTrack } from "@/data/pickl-park-winter-league-2026";
import {
  FALL_CHILD_AGE_MIN,
  FALL_CHILD_AGE_MAX,
} from "@/lib/validate-fall-interest";

export interface PicklParkWinterLeagueData {
  /** Track slug: "foundations-10u" | "game-time-11-14". */
  track: string;
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

export type PicklParkWinterLeagueErrors = Partial<
  Record<keyof PicklParkWinterLeagueData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function birthYearRange(): { min: number; max: number } {
  const thisYear = new Date().getFullYear();
  return {
    min: thisYear - FALL_CHILD_AGE_MAX,
    max: thisYear - FALL_CHILD_AGE_MIN,
  };
}

export function validatePicklParkWinterLeague(
  data: Partial<PicklParkWinterLeagueData>,
): PicklParkWinterLeagueErrors {
  const errors: PicklParkWinterLeagueErrors = {};

  if (!data.track?.trim() || !findPicklParkWinterLeagueTrack(data.track)) {
    errors.track = "Pick your player's track";
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
  return errors;
}
