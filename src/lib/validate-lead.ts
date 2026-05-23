export interface Kid {
  name: string;
  age: number;
}

export interface LeadFormData {
  parentName: string;
  contact: string;
  // Preferred shape: one entry per kid. Multi-kid families submit all kids in
  // a single round-trip. Backwards-compat: legacy callers can still send
  // `childAge` (single value) and the API/validator treats it as one kid with
  // an empty name (Notion gets the "Child of X" placeholder).
  kids?: Kid[];
  childAge?: string;
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

// Per-kid error keys are `kids.<index>.<field>`; the legacy single-kid
// `childAge` key is still emitted when the caller used the legacy payload, so
// existing API consumers (and the contact-form spec) keep working.
export type LeadValidationErrors = Partial<Record<string, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_KIDS_PER_SUBMISSION = 4;
const NAME_MAX = 40;

export function normalizeKids(data: Partial<LeadFormData>): Kid[] {
  if (Array.isArray(data.kids) && data.kids.length > 0) {
    return data.kids.map((k) => ({
      name: (k.name ?? "").toString(),
      age: Number(k.age),
    }));
  }
  if (data.childAge) {
    return [{ name: "", age: Number(data.childAge) }];
  }
  return [];
}

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

  const usedLegacyPayload =
    !Array.isArray(data.kids) || data.kids.length === 0;
  const kids = normalizeKids(data);

  if (kids.length === 0) {
    // Mirror the legacy error key so the contact-form / lead-form specs and
    // any existing API consumers keep getting `childAge` in the errors map.
    errors.childAge = "Child's age is required";
  } else if (kids.length > MAX_KIDS_PER_SUBMISSION) {
    errors.kids = `Please add up to ${MAX_KIDS_PER_SUBMISSION} kids at a time`;
  } else {
    kids.forEach((kid, i) => {
      // Name is only required when the caller opted into the multi-kid
      // `kids[]` shape — legacy `childAge`-only payloads don't have a name to
      // validate and must keep submitting cleanly.
      if (!usedLegacyPayload && !kid.name.trim()) {
        errors[`kids.${i}.name`] = "Child's first name is required";
      } else if (kid.name.length > NAME_MAX) {
        errors[`kids.${i}.name`] = `Name must be under ${NAME_MAX} characters`;
      }
      if (isNaN(kid.age) || kid.age < 7 || kid.age > 17) {
        const key = usedLegacyPayload ? "childAge" : `kids.${i}.age`;
        errors[key] = "Age must be between 7 and 17";
      }
    });
  }

  return errors;
}
