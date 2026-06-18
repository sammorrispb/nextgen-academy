import {
  MAX_KIDS_PER_SUBMISSION,
  normalizeKids,
  type Kid,
} from "@/lib/validate-lead";

export type { Kid };

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
  { value: "drop-in", label: "Drop-in group sessions (all ball colors)" },
  { value: "private-lessons", label: "Private lessons (1:1 coaching)" },
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
  // Preferred shape for program-interest submissions: one entry per kid.
  // Legacy `childAge` is still accepted (treated as one nameless kid) so any
  // existing API consumer keeps working.
  kids?: Kid[];
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

// Per-kid keys are `kids.<index>.<field>`; `childAge` is still emitted for
// legacy-payload callers and the existing spec assertions.
export type ContactValidationErrors = Partial<Record<string, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_INTERESTS = new Set<string>(
  CONTACT_INTEREST_OPTIONS.map((o) => o.value),
);

const MESSAGE_MAX = 1000;
const NAME_MAX = 40;

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
    const usedLegacyPayload =
      !Array.isArray(data.kids) || data.kids.length === 0;
    const kids = normalizeKids({
      kids: data.kids,
      childAge: data.childAge,
    });

    if (kids.length === 0) {
      errors.childAge = "Child's age is required for this option";
    } else if (kids.length > MAX_KIDS_PER_SUBMISSION) {
      errors.kids = `Please add up to ${MAX_KIDS_PER_SUBMISSION} kids at a time`;
    } else {
      kids.forEach((kid, i) => {
        if (!usedLegacyPayload && !kid.name.trim()) {
          errors[`kids.${i}.name`] = "Child's first name is required";
        } else if (kid.name.length > NAME_MAX) {
          errors[`kids.${i}.name`] =
            `Name must be under ${NAME_MAX} characters`;
        }
        if (isNaN(kid.age) || kid.age < 6 || kid.age > 16) {
          const key = usedLegacyPayload ? "childAge" : `kids.${i}.age`;
          errors[key] = "Age must be between 6 and 16";
        }
      });
    }
  }

  if (data.message && data.message.length > MESSAGE_MAX) {
    errors.message = `Message must be under ${MESSAGE_MAX} characters`;
  }

  return errors;
}
