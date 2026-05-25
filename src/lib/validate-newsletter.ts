export interface NewsletterFormData {
  parentName: string;
  email: string;
  childAge: string;
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
export type NewsletterValidationErrors = Partial<
  Record<"parentName" | "email" | "childAge", string>
>;

// Email-only: the welcome email is the whole point, so there's no phone branch.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNewsletterForm(
  data: Partial<NewsletterFormData>,
): NewsletterValidationErrors {
  const errors: NewsletterValidationErrors = {};

  if (!data.parentName?.trim()) {
    errors.parentName = "Your name is required";
  }

  if (!data.email?.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (!data.childAge) {
    errors.childAge = "Child's age is required";
  } else {
    const age = Number(data.childAge);
    // NGA accepts ages 6–16, strict — no exceptions, no on-ramp slack.
    if (isNaN(age) || age < 6 || age > 16) {
      errors.childAge = "Age must be between 6 and 16";
    }
  }

  return errors;
}
