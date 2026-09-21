// Validator for the Monday Girls drop-in checkout
// (/api/checkout-monday-girls-dropin). Same parent/child/emergency field set
// as the season checkout, plus the Monday being bought.

import { findMondayGirlsSeasonGroup } from "@/data/monday-girls-season-2026";
import {
  MONDAY_GIRLS_MONDAYS,
  MONDAY_GIRLS_SKIPPED_DATE,
} from "@/data/monday-girls-2026";
import {
  FALL_CHILD_AGE_MIN,
  FALL_CHILD_AGE_MAX,
} from "@/lib/validate-fall-interest";

export interface MondayGirlsDropinData {
  /** ISO date of the Monday being bought, e.g. "2026-09-28". */
  monday: string;
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

export type MondayGirlsDropinErrors = Partial<
  Record<keyof MondayGirlsDropinData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function birthYearRange(): { min: number; max: number } {
  const thisYear = new Date().getFullYear();
  return {
    min: thisYear - FALL_CHILD_AGE_MAX,
    max: thisYear - FALL_CHILD_AGE_MIN,
  };
}

export function validateMondayGirlsDropin(
  data: Partial<MondayGirlsDropinData>,
): MondayGirlsDropinErrors {
  const errors: MondayGirlsDropinErrors = {};

  if (!data.monday?.trim()) {
    errors.monday = "Pick a Monday";
  } else if (
    !(MONDAY_GIRLS_MONDAYS as readonly string[]).includes(
      data.monday.trim(),
    ) ||
    data.monday.trim() === MONDAY_GIRLS_SKIPPED_DATE
  ) {
    errors.monday = "That Monday isn't part of this block";
  }
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
  return errors;
}
