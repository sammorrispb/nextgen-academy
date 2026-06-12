export interface RsvpFormData {
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childBirthYear: string;
  sessionId: string;
  /** Opt-in: show child's first name on the public schedule. Default false. */
  displayConsent: boolean;
  /** TCPA opt-in for SMS notifications. Default false. */
  smsConsent: boolean;
  /**
   * Attribution (optional) — the sessionStorage UTM stash captured by
   * UtmCapture, forwarded so /api/checkout can stamp Stripe metadata for the
   * webhook's Source attribution. Never validated; absent = direct/organic.
   */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  ref?: string;
}

export type RsvpValidationErrors = Partial<
  Record<keyof RsvpFormData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Plausible birth-year range for an NGA player. Recomputed each call so the
// range stays anchored to the current year (no stale baked-in window).
function birthYearRange(): { min: number; max: number } {
  const thisYear = new Date().getFullYear();
  // NGA accepts ages 6..16, strict — no exceptions, no headroom.
  return { min: thisYear - 16, max: thisYear - 6 };
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
