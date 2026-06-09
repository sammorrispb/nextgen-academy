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

export interface CrewInterestFormData {
  parentName: string;
  email: string;
  phone?: string;
  childFirstName: string;
  childAge: string;
  childLevel: string;
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
