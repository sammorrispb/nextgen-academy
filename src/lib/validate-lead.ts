export interface LeadFormData {
  parentName: string;
  contact: string;
  childAge: string;
  // Part of Montgomery County the parent lives in (Bethesda, Rockville, etc.).
  // Optional — surfaces as a dropdown on the lead form and lets us match the
  // family to the closest rotating session venue.
  location?: string;
  // Attribution fields — all optional, captured client-side from URL params.
  // Never validated (accepted as-is) and never shown as form errors.
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
}

// Only the three user-facing fields can produce validation errors.
export type LeadValidationErrors = Partial<
  Record<"parentName" | "contact" | "childAge", string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  return errors;
}
