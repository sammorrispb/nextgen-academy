export interface RsvpFormData {
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childBirthYear: string;
  sessionId: string;
}

export type RsvpValidationErrors = Partial<
  Record<keyof RsvpFormData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Plausible birth-year range for an NGA player. Recomputed each call so the
// range stays anchored to the current year (no stale baked-in window).
function birthYearRange(): { min: number; max: number } {
  const thisYear = new Date().getFullYear();
  // ages 7..18 — covers NGA (8–16) plus a year of slack on each end.
  return { min: thisYear - 18, max: thisYear - 7 };
}

export function validateRsvpForm(
  data: Partial<RsvpFormData>,
): RsvpValidationErrors {
  const errors: RsvpValidationErrors = {};

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
      errors.childBirthYear = `Birth year must be between ${min} and ${max}`;
    }
  }
  if (!data.sessionId?.trim()) errors.sessionId = "Pick a session";

  return errors;
}
