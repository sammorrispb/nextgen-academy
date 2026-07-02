// Validation for the parent self-serve eval booking form
// (/free-evaluation/book → POST /api/eval-book). House shape: a pure
// validate function returning a field→message map (mirrors validate-lead /
// validate-crew-interest). Child data is deliberately capped at FIRST NAME +
// LEVEL — no new child fields (admin-reduction roadmap Phase 1a).

import { EMAIL_RE } from "./notion-utils";

// Same ball-color vocabulary the eval flow already places kids into (the
// Player CRM Level select / CREW_LEVELS in validate-crew-interest.ts).
export const EVAL_LEVELS = ["Red", "Orange", "Green", "Yellow"] as const;
export type EvalLevel = (typeof EVAL_LEVELS)[number];

export const EVAL_LEVEL_HINTS: Record<EvalLevel, string> = {
  Red: "First time on a court",
  Orange: "Rallies a bit, still learning",
  Green: "Rallies well, knows the rules",
  Yellow: "Competitive / tournament-track",
};

export interface EvalBookFormData {
  slotId: string;
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  level: string;
}

export type EvalBookErrors = Partial<
  Record<keyof EvalBookFormData, string>
>;

// Permissive phone: at least 7 digits, common punctuation allowed (same shape
// as validate-crew-interest). Phone is REQUIRED here — the eval is an
// in-person meet and day-of coordination happens by text.
const PHONE_RE = /^[\d\s\-+().]{7,}$/;
const NAME_MAX = 40;

// A slotId must LOOK like a Notion page id (UUID, dashed or bare 32-hex)
// before we make a single Notion call with it (PR #244 F1) — anything else is
// rejected at the validation boundary, never used to build an API URL.
const SLOT_ID_RE =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function validateEvalBookForm(
  data: Partial<EvalBookFormData>,
): EvalBookErrors {
  const errors: EvalBookErrors = {};

  if (!data.slotId?.trim() || !SLOT_ID_RE.test(data.slotId.trim())) {
    errors.slotId = "Pick a time slot";
  }

  if (!data.parentName?.trim()) {
    errors.parentName = "Your name is required";
  }

  if (!data.email?.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (!data.phone?.trim()) {
    errors.phone = "Phone is required — we text day-of updates";
  } else if (!PHONE_RE.test(data.phone.trim())) {
    errors.phone = "Please enter a valid phone number";
  }

  if (!data.childFirstName?.trim()) {
    errors.childFirstName = "Your kid's first name is required";
  } else if (data.childFirstName.length > NAME_MAX) {
    errors.childFirstName = `Name must be under ${NAME_MAX} characters`;
  }

  if (!data.level || !EVAL_LEVELS.includes(data.level as EvalLevel)) {
    errors.level = "Pick a level";
  }

  return errors;
}
