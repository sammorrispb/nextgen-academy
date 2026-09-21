// Validator for the lesson checkout (/api/checkout-lesson). Same
// parent/child/emergency field set as the other program checkouts.
// Group lessons additionally collect the player count so the $60 group
// total can be split — the checkout puts it in session metadata for staff.

import {
  findLessonProduct,
  GROUP_LESSON_MIN_PLAYERS,
  GROUP_LESSON_MAX_PLAYERS,
} from "@/data/lessons";
import {
  FALL_CHILD_AGE_MIN,
  FALL_CHILD_AGE_MAX,
} from "@/lib/validate-fall-interest";

export interface LessonPurchaseData {
  lessonType: string;
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childBirthYear: string;
  /** Free-text preferred days/times, e.g. "Tue/Thu after 5pm". */
  preferredTimes: string;
  emergencyName: string;
  emergencyPhone: string;
  /** Number of players for a group lesson (required only for groups). */
  groupPlayers: string;
  /** Optional allergies / medical notes. */
  allergies: string;
  /** Optional notes for the coach (goals, experience, etc.). */
  notes: string;
  /** TCPA opt-in for SMS notifications. Default false. */
  smsConsent: boolean;
}

export type LessonPurchaseErrors = Partial<
  Record<keyof LessonPurchaseData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function birthYearRange(): { min: number; max: number } {
  const thisYear = new Date().getFullYear();
  return {
    min: thisYear - FALL_CHILD_AGE_MAX,
    max: thisYear - FALL_CHILD_AGE_MIN,
  };
}

export function validateLessonPurchase(
  data: Partial<LessonPurchaseData>,
): LessonPurchaseErrors {
  const errors: LessonPurchaseErrors = {};

  if (!data.lessonType?.trim() || !findLessonProduct(data.lessonType)) {
    errors.lessonType = "Pick private or group";
  }
  if (data.lessonType === "group") {
    // The $60 group hour is split between the players — the count has to be
    // a real number so the per-player split is visible to staff in the
    // checkout metadata.
    const n = Number(data.groupPlayers);
    if (!data.groupPlayers?.trim()) {
      errors.groupPlayers = "How many players will be in the group?";
    } else if (
      Number.isNaN(n) ||
      !Number.isInteger(n) ||
      n < GROUP_LESSON_MIN_PLAYERS ||
      n > GROUP_LESSON_MAX_PLAYERS
    ) {
      errors.groupPlayers = `Enter ${GROUP_LESSON_MIN_PLAYERS}–${GROUP_LESSON_MAX_PLAYERS} players`;
    }
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
  if (!data.preferredTimes?.trim()) {
    errors.preferredTimes =
      "Tell us when you're generally free so we can schedule";
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
