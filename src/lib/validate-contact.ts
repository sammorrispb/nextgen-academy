export type ContactInterest =
  | "free-evaluation"
  | "drop-in"
  | "private-lessons"
  | "yellow-ball"
  | "partnership"
  | "general";

export const CONTACT_INTEREST_OPTIONS: ReadonlyArray<{
  value: ContactInterest;
  label: string;
}> = [
  { value: "free-evaluation", label: "Free evaluation" },
  { value: "drop-in", label: "Drop-in group sessions (Green / Yellow Ball)" },
  { value: "private-lessons", label: "Private lessons (Red / Orange Ball)" },
  { value: "yellow-ball", label: "Yellow Ball tournament track (invite-only)" },
  { value: "partnership", label: "Partnership / school program" },
  { value: "general", label: "General question or feedback" },
];

// Interests that involve a specific child and therefore require an age.
// Partnership and general inquiries do not.
const INTERESTS_REQUIRING_AGE: ReadonlySet<ContactInterest> = new Set([
  "free-evaluation",
  "drop-in",
  "private-lessons",
  "yellow-ball",
]);

export function interestRequiresChildAge(
  interest: string | undefined,
): boolean {
  return INTERESTS_REQUIRING_AGE.has(interest as ContactInterest);
}

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  interest: ContactInterest | "";
  childAge?: string;
  message?: string;
  // Attribution — captured client-side, never validated.
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
  visitor_id?: string | null;
}

export type ContactValidationErrors = Partial<
  Record<"name" | "email" | "phone" | "interest" | "childAge" | "message", string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_INTERESTS = new Set<string>(
  CONTACT_INTEREST_OPTIONS.map((o) => o.value),
);

const MESSAGE_MAX = 1000;

export function validateContactForm(
  data: Partial<ContactFormData>,
): ContactValidationErrors {
  const errors: ContactValidationErrors = {};

  if (!data.name?.trim()) {
    errors.name = "Your name is required";
  }

  if (!data.email?.trim()) {
    errors.email = "A valid email is required";
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (data.phone && data.phone.trim()) {
    const digits = data.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      errors.phone = "Enter a 10-digit phone number";
    }
  }

  if (!data.interest) {
    errors.interest = "Please choose what you're interested in";
  } else if (!VALID_INTERESTS.has(data.interest)) {
    errors.interest = "Please choose a valid option";
  } else if (interestRequiresChildAge(data.interest)) {
    if (!data.childAge) {
      errors.childAge = "Child's age is required for this option";
    } else {
      const age = Number(data.childAge);
      if (isNaN(age) || age < 7 || age > 17) {
        errors.childAge = "Age must be between 7 and 17";
      }
    }
  }

  if (data.message && data.message.length > MESSAGE_MAX) {
    errors.message = `Message must be under ${MESSAGE_MAX} characters`;
  }

  return errors;
}
