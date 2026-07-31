import {
  FALL_ADULT_BRACKETS,
  FALL_COMMITMENTS,
  FALL_DAYS,
  FALL_PRICE_BANDS,
  FALL_YOUTH_LEVELS,
  type FallAdultBracket,
  type FallCommitment,
  type FallDay,
  type FallPriceBand,
  type FallTrack,
  type FallYouthLevel,
} from "@/data/fall-2026";

export const FALL_TRACKS: readonly FallTrack[] = ["youth", "adult"] as const;

export interface FallInterestFormData {
  respondentName: string;
  email: string;
  phone?: string;
  /** Which program(s) they're answering about. At least one. */
  track: FallTrack[];
  // Youth branch — required only when `track` includes "youth".
  childFirstName?: string;
  childAge?: string;
  childLevel?: FallYouthLevel | "";
  // Adult branch — required only when `track` includes "adult".
  adultBracket?: FallAdultBracket | "";
  days: FallDay[];
  commitment?: FallCommitment | "";
  subListInterest?: boolean;
  youthPriceBand?: FallPriceBand | "";
  adultPriceBand?: FallPriceBand | "";
  notes?: string;
  // Attribution; never produces errors.
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export type FallInterestErrors = Partial<
  Record<
    | "respondentName"
    | "email"
    | "phone"
    | "track"
    | "childFirstName"
    | "childAge"
    | "childLevel"
    | "adultBracket"
    | "days"
    | "commitment"
    | "youthPriceBand"
    | "adultPriceBand",
    string
  >
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Permissive phone: at least 7 digits, common punctuation allowed.
const PHONE_RE = /^[\d\s\-+().]{7,}$/;

export const FALL_CHILD_AGE_MIN = 6;
export const FALL_CHILD_AGE_MAX = 16;

export function validateFallInterest(
  data: Partial<FallInterestFormData>,
): FallInterestErrors {
  const errors: FallInterestErrors = {};

  if (!data.respondentName?.trim()) {
    errors.respondentName = "Your name is required";
  }

  if (!data.email?.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (data.phone && data.phone.trim() && !PHONE_RE.test(data.phone.trim())) {
    errors.phone = "Please enter a valid phone number";
  }

  const track = data.track ?? [];
  const wantsYouth = track.includes("youth");
  const wantsAdult = track.includes("adult");

  if (track.length === 0) {
    errors.track = "Tell us who'd be playing — your kid, you, or both";
  } else if (!track.every((t) => FALL_TRACKS.includes(t))) {
    errors.track = "That isn't one of the programs";
  }

  // Branch fields are only required for the tracks actually picked — an adult
  // answering about themselves is never asked for a child's name.
  if (wantsYouth) {
    if (!data.childFirstName?.trim()) {
      errors.childFirstName = "Your kid's first name helps us group them";
    }

    if (!data.childAge) {
      errors.childAge = "Child's age is required";
    } else {
      const age = Number(data.childAge);
      if (
        isNaN(age) ||
        age < FALL_CHILD_AGE_MIN ||
        age > FALL_CHILD_AGE_MAX
      ) {
        errors.childAge = `Age must be between ${FALL_CHILD_AGE_MIN} and ${FALL_CHILD_AGE_MAX}`;
      }
    }

    if (
      !data.childLevel ||
      !FALL_YOUTH_LEVELS.includes(data.childLevel as FallYouthLevel)
    ) {
      errors.childLevel = "Pick a color group";
    }

    if (
      data.youthPriceBand &&
      !FALL_PRICE_BANDS.includes(data.youthPriceBand as FallPriceBand)
    ) {
      errors.youthPriceBand = "Pick one of the ranges";
    }
  }

  if (wantsAdult) {
    if (
      !data.adultBracket ||
      !FALL_ADULT_BRACKETS.includes(data.adultBracket as FallAdultBracket)
    ) {
      errors.adultBracket = "Pick a bracket";
    }

    if (
      data.adultPriceBand &&
      !FALL_PRICE_BANDS.includes(data.adultPriceBand as FallPriceBand)
    ) {
      errors.adultPriceBand = "Pick one of the ranges";
    }
  }

  if (!data.days || data.days.length === 0) {
    errors.days = "Let us know which days work — or that neither does";
  } else if (!data.days.every((d) => FALL_DAYS.includes(d))) {
    errors.days = "Some days aren't valid";
  }

  if (
    !data.commitment ||
    !FALL_COMMITMENTS.includes(data.commitment as FallCommitment)
  ) {
    errors.commitment = "Tell us where you land on the full season";
  }

  return errors;
}
