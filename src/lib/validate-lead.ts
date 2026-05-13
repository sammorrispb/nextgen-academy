export interface LeadFormData {
  parentName: string;
  contact: string;
  childAge: string;
  // Optional free-text — UI no longer collects it, but the API still forwards
  // it to Notion + Hub if a caller (e.g. legacy form, server) supplies one.
  location?: string;
  // Optional "anything we should know?" textarea. Used to capture
  // self-identified intent (private vs group, skill level, urgency) so Sam
  // can pre-tier before responding.
  notes?: string;
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
    // NGA core is 8–16; allow 7 and 17 for inquiry slack (siblings, edge ages).
    if (isNaN(age) || age < 7 || age > 17) {
      errors.childAge = "Age must be between 7 and 17";
    }
  }

  return errors;
}
