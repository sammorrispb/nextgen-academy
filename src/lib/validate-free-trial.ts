export interface FreeTrialFormData {
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childLastName: string;
  childAge: string;
  location: string;
  sessionId: string;
  sessionLabel: string;
  howHeard: string;
  notes: string;
}

export type ValidationErrors = Partial<Record<keyof FreeTrialFormData, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_LOCATIONS = ["Rockville", "North Bethesda"] as const;
const VALID_HOW_HEARD = [
  "",
  "Facebook/Instagram Ad",
  "Friend/Referral",
  "Google Search",
  "School/Community Event",
  "Other",
] as const;

export function validateFreeTrialForm(
  data: Partial<FreeTrialFormData>,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.parentFirstName?.trim()) {
    errors.parentFirstName = "Parent first name is required";
  }
  if (!data.parentLastName?.trim()) {
    errors.parentLastName = "Parent last name is required";
  }

  if (!data.parentEmail?.trim()) {
    errors.parentEmail = "Email is required";
  } else if (!EMAIL_RE.test(data.parentEmail.trim())) {
    errors.parentEmail = "Please enter a valid email address";
  }

  if (!data.parentPhone?.trim()) {
    errors.parentPhone = "Phone number is required";
  } else {
    const digits = data.parentPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      errors.parentPhone = "Please enter a valid 10-digit phone number";
    }
  }

  if (!data.childFirstName?.trim()) {
    errors.childFirstName = "Child's first name is required";
  }
  if (!data.childLastName?.trim()) {
    errors.childLastName = "Child's last name is required";
  }

  if (!data.childAge) {
    errors.childAge = "Child's age is required";
  } else {
    const age = Number(data.childAge);
    if (isNaN(age) || age < 4 || age > 10) {
      errors.childAge = "Age must be between 4 and 10";
    }
  }

  if (!data.location) {
    errors.location = "Please select a location";
  } else if (
    !VALID_LOCATIONS.includes(data.location as (typeof VALID_LOCATIONS)[number])
  ) {
    errors.location = "Invalid location";
  }

  // Session ID is validated server-side against live CR data
  if (!data.sessionId) {
    errors.sessionId = "Please select a session";
  }

  if (
    data.howHeard &&
    !VALID_HOW_HEARD.includes(
      data.howHeard as (typeof VALID_HOW_HEARD)[number],
    )
  ) {
    errors.howHeard = "Invalid selection";
  }

  if (data.notes && data.notes.length > 500) {
    errors.notes = "Notes must be 500 characters or fewer";
  }

  return errors;
}
