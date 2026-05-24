export type Vote = "Yes" | "Maybe" | "No";
export type Level = "Red" | "Orange" | "Green" | "Yellow";

export interface PollVoteFormData {
  parentName: string;
  email: string;
  phone?: string;
  childFirstName: string;
  childAge: string;
  childLevel: Level | "";
  vote: Vote | "";
  note?: string;
}

export type PollVoteValidationErrors = Partial<
  Record<
    "parentName" | "email" | "phone" | "childFirstName" | "childAge" | "childLevel" | "vote",
    string
  >
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VOTES: Vote[] = ["Yes", "Maybe", "No"];
const LEVELS: Level[] = ["Red", "Orange", "Green", "Yellow"];

export function validatePollVote(
  data: Partial<PollVoteFormData>,
): PollVoteValidationErrors {
  const errors: PollVoteValidationErrors = {};

  if (!data.parentName?.trim()) errors.parentName = "Your name is required";

  if (!data.email?.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (!data.childFirstName?.trim()) {
    errors.childFirstName = "Child's first name is required";
  }

  if (!data.childAge) {
    errors.childAge = "Child's age is required";
  } else {
    const age = Number(data.childAge);
    if (isNaN(age) || age < 7 || age > 17) {
      errors.childAge = "Age must be between 7 and 17";
    }
  }

  if (!data.childLevel || !LEVELS.includes(data.childLevel as Level)) {
    errors.childLevel = "Pick a level";
  }

  if (!data.vote || !VOTES.includes(data.vote as Vote)) {
    errors.vote = "Pick yes, maybe, or no";
  }

  return errors;
}
