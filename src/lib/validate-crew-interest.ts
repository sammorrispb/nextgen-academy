export type CrewLevel = "Red" | "Orange" | "Green" | "Yellow";
export type CrewDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const CREW_LEVELS: readonly CrewLevel[] = [
  "Red",
  "Orange",
  "Green",
  "Yellow",
] as const;

export const CREW_DAYS: readonly CrewDay[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export type CrewTimeOfDay = "Morning" | "Afternoon" | "Evening";

export const CREW_TIMES_OF_DAY: readonly CrewTimeOfDay[] = [
  "Morning",
  "Afternoon",
  "Evening",
] as const;

// Skill sub-level within a ball color — splits each level into low/mid/high so
// crew matching can pair kids of genuinely similar ability (a high-Green plays
// up; a low-Green needs reps). Optional everywhere: parents who skip it still
// match on color + age + day. Approved as a child field 2026-06-17 (Sam).
export type CrewSubLevel = "Low" | "Mid" | "High";

export const CREW_SUB_LEVELS: readonly CrewSubLevel[] = [
  "Low",
  "Mid",
  "High",
] as const;

export const CREW_SUB_LEVEL_HINTS: Record<CrewSubLevel, string> = {
  Low: "New to this level",
  Mid: "Comfortable here",
  High: "Ready to play up",
};

export interface CrewInterestFormData {
  parentName: string;
  email: string;
  phone?: string;
  childFirstName: string;
  childAge: string;
  childLevel: string;
  /** Optional low/mid/high split within the ball color — refines crew matching. */
  childSubLevel?: CrewSubLevel | "";
  preferredDays: CrewDay[];
  /** Coarse time-of-day buckets — drives cohort matching. */
  preferredTimeOfDay: CrewTimeOfDay[];
  preferredTime: string;
  preferredLocation?: string;
  friendsWanted?: string;
  notes?: string;
  // Attribution; never produces errors.
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  source?: "Newsletter" | "Web" | "Other";
  /** Cluster slug from /clusters/[color] handoff. Optional — unknown values silently drop. */
  cluster?: string;
}

export type CrewInterestErrors = Partial<
  Record<
    | "parentName"
    | "email"
    | "phone"
    | "childFirstName"
    | "childAge"
    | "childLevel"
    | "childSubLevel"
    | "preferredDays"
    | "preferredTimeOfDay"
    | "preferredTime",
    string
  >
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Permissive phone: at least 7 digits, common punctuation allowed.
const PHONE_RE = /^[\d\s\-+().]{7,}$/;

export function validateCrewInterestForm(
  data: Partial<CrewInterestFormData>,
): CrewInterestErrors {
  const errors: CrewInterestErrors = {};

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
    errors.childFirstName = "Your kid's first name helps us match you up";
  }

  if (!data.childAge) {
    errors.childAge = "Child's age is required";
  } else {
    const age = Number(data.childAge);
    if (isNaN(age) || age < 6 || age > 16) {
      errors.childAge = "Age must be between 6 and 16";
    }
  }

  if (!data.childLevel || !CREW_LEVELS.includes(data.childLevel as CrewLevel)) {
    errors.childLevel = "Pick a level";
  }

  // Sub-level is optional — only flag a value that isn't one of the three.
  if (
    data.childSubLevel &&
    !CREW_SUB_LEVELS.includes(data.childSubLevel as CrewSubLevel)
  ) {
    errors.childSubLevel = "Pick low, mid, or high";
  }

  if (!data.preferredDays || data.preferredDays.length === 0) {
    errors.preferredDays = "Pick at least one day that works";
  } else if (!data.preferredDays.every((d) => CREW_DAYS.includes(d))) {
    errors.preferredDays = "Some days aren't valid";
  }

  if (!data.preferredTimeOfDay || data.preferredTimeOfDay.length === 0) {
    errors.preferredTimeOfDay = "Pick at least one time of day";
  } else if (
    !data.preferredTimeOfDay.every((t) => CREW_TIMES_OF_DAY.includes(t))
  ) {
    errors.preferredTimeOfDay = "Some times aren't valid";
  }

  if (!data.preferredTime?.trim()) {
    errors.preferredTime =
      "Tell us roughly when works (e.g. \"after school\" or \"4–6pm\")";
  }

  return errors;
}
