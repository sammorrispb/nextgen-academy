export interface RsvpFormData {
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childAge: string;
  sessionId: string;
}

export type RsvpValidationErrors = Partial<
  Record<keyof RsvpFormData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (!data.childAge?.trim()) {
    errors.childAge = "Child age is required";
  } else {
    const n = Number(data.childAge);
    if (Number.isNaN(n) || n < 4 || n > 16) {
      errors.childAge = "Age must be between 4 and 16";
    }
  }
  if (!data.sessionId?.trim()) errors.sessionId = "Pick a session";

  return errors;
}
