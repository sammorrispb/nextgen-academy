export interface WaiverSignFormData {
  parentName: string;
  email: string;
  /** Optional — captured for the phone-fallback gate key. */
  phone?: string;
  /** The full legal name the parent types as their e-signature. */
  signatureName: string;
  /** Must be true — the explicit "I agree" attestation. */
  agree: boolean;
  // Attribution (optional) — captured client-side, never validated.
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  ref?: string;
}

export type WaiverSignValidationErrors = Partial<
  Record<keyof WaiverSignFormData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateWaiverSignForm(
  input: unknown,
): WaiverSignValidationErrors {
  const data = input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const errors: WaiverSignValidationErrors = {};
  const parentName = typeof data.parentName === "string" ? data.parentName.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const signatureName = typeof data.signatureName === "string" ? data.signatureName.trim() : "";

  if (!parentName) {
    errors.parentName = "Your name is required";
  }

  if (!email) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Please enter a valid email address";
  }

  if (!signatureName) {
    errors.signatureName = "Type your full legal name to sign";
  } else if (signatureName.length < 2) {
    errors.signatureName = "Please type your full legal name";
  }

  if (data.agree !== true) {
    errors.agree = "You must agree to the waiver to sign";
  }

  for (const field of ["phone", "utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"] as const) {
    if (data[field] !== undefined && typeof data[field] !== "string") {
      errors[field] = field === "phone" ? "Please enter your phone as text" : "Invalid attribution field";
    }
  }

  return errors;
}
