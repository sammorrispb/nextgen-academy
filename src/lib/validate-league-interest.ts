import {
  LEAGUE_AGE_MIN,
  LEAGUE_AGE_MAX,
  LEAGUE_BANDS,
  type LeagueBand,
} from "@/data/leagues";

// The league interest form is the demand-validation signal (launch-readiness
// P2 #12 — "can you fill a division?"). It is NOT a checkout: it captures which
// band a family would enroll in so Sam can gauge a division before committing
// the P0 spend. Distinct from Crew Interest (ad-hoc weekly crews) — a league is
// a fixed-roster paid season.

export type LeagueLevel = "Red" | "Orange" | "Green" | "Yellow";

export const LEAGUE_LEVELS: readonly LeagueLevel[] = [
  "Red",
  "Orange",
  "Green",
  "Yellow",
] as const;

export const LEAGUE_BAND_KEYS: readonly LeagueBand[] = LEAGUE_BANDS.map(
  (b) => b.band,
);

export interface LeagueInterestFormData {
  parentName: string;
  email: string;
  phone?: string;
  childFirstName: string;
  childAge: string;
  preferredBand: string;
  /** Optional ball-color level within the band. */
  childLevel?: string;
  notes?: string;
  // Attribution; never produces errors.
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  source?: "Newsletter" | "Web" | "Other";
}

export type LeagueInterestErrors = Partial<
  Record<
    | "parentName"
    | "email"
    | "phone"
    | "childFirstName"
    | "childAge"
    | "preferredBand"
    | "childLevel",
    string
  >
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Permissive phone: at least 7 digits, common punctuation allowed.
const PHONE_RE = /^[\d\s\-+().]{7,}$/;

export function validateLeagueInterestForm(
  data: Partial<LeagueInterestFormData>,
): LeagueInterestErrors {
  const errors: LeagueInterestErrors = {};

  if (!data.parentName?.trim()) {
    errors.parentName = "Your name is required";
  }

  if (!data.email?.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (data.phone && data.phone.trim() && !PHONE_RE.test(data.phone.trim())) {
    errors.phone = "Please enter a valid phone number";
  }

  if (!data.childFirstName?.trim()) {
    errors.childFirstName = "Your kid's first name helps us place the division";
  }

  if (!data.childAge) {
    errors.childAge = "Child's age is required";
  } else {
    const age = Number(data.childAge);
    if (
      Number.isNaN(age) ||
      age < LEAGUE_AGE_MIN ||
      age > LEAGUE_AGE_MAX
    ) {
      errors.childAge = `Age must be between ${LEAGUE_AGE_MIN} and ${LEAGUE_AGE_MAX}`;
    }
  }

  if (
    !data.preferredBand ||
    !LEAGUE_BAND_KEYS.includes(data.preferredBand as LeagueBand)
  ) {
    errors.preferredBand = "Pick an age division";
  }

  // Level is optional, but if provided it must be a real ball color.
  if (
    data.childLevel &&
    !LEAGUE_LEVELS.includes(data.childLevel as LeagueLevel)
  ) {
    errors.childLevel = "Pick a level";
  }

  return errors;
}
