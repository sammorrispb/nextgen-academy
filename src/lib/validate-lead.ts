export interface LeadFormData {
  parentName: string;
  contact: string;
  childAge: string;
  location: string;
}

export type LeadValidationErrors = Partial<Record<keyof LeadFormData, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_LOCATIONS = ["Rockville", "North Bethesda"] as const;

export function validateLeadForm(
  data: Partial<LeadFormData>,
): LeadValidationErrors {
  const errors: LeadValidationErrors = {};

  if (!data.parentName?.trim()) {
    errors.parentName = "Your name is required";
  }

  if (!data.contact?.trim()) {
    errors.contact = "Email or phone number is required";
  } else {
    const value = data.contact.trim();
    const digits = value.replace(/\D/g, "");
    const isEmail = EMAIL_RE.test(value);
    const isPhone = digits.length >= 10;
    if (!isEmail && !isPhone) {
      errors.contact = "Please enter a valid email or 10-digit phone number";
    }
  }

  if (!data.childAge) {
    errors.childAge = "Child's age is required";
  } else {
    const age = Number(data.childAge);
    if (isNaN(age) || age < 4 || age > 16) {
      errors.childAge = "Age must be between 4 and 16";
    }
  }

  if (
    data.location &&
    !VALID_LOCATIONS.includes(data.location as (typeof VALID_LOCATIONS)[number])
  ) {
    errors.location = "Invalid location";
  }

  return errors;
}
