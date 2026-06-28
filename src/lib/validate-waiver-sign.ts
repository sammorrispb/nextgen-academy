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
  Record<"parentName" | "email" | "signatureName" | "agree", string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateWaiverSignForm(
  data: Partial<WaiverSignFormData>,
): WaiverSignValidationErrors {
  const errors: WaiverSignValidationErrors = {};

  if (!data.parentName?.trim()) {
    errors.parentName = "Your name is required";
  }

  if (!data.email?.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (!data.signatureName?.trim()) {
    errors.signatureName = "Type your full legal name to sign";
  } else if (data.signatureName.trim().length < 2) {
    errors.signatureName = "Please type your full legal name";
  }

  if (data.agree !== true) {
    errors.agree = "You must agree to the waiver to sign";
  }

  return errors;
}
