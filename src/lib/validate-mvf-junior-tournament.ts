// Validator for the MVF Junior Tournament checkout
// (/api/checkout-mvf-junior-tournament). Same parent/child/emergency field
// set as the lesson, Monday Girls drop-in, and Winter League checkouts, plus:
// the division (10u or 14u), the child's date of birth (validated against
// the division server-side — age as of 2026-10-24), the child's last name,
// and the self-attested Montgomery Village resident flag that sets the price.

import {
  findMvfTournamentDivision,
  isDobEligibleForDivision,
  isCalendarDob,
} from "@/data/mvf-junior-tournament-2026";

export interface MvfJuniorTournamentData {
  /** Division slug: "10u" | "14u". */
  division: string;
  /** Self-attested Montgomery Village residency — sets $50 vs $60 server-side. */
  resident: boolean;
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childLastName: string;
  /** ISO date "YYYY-MM-DD". */
  childDob: string;
  emergencyName: string;
  emergencyPhone: string;
  /** Optional allergies / medical notes. */
  allergies: string;
  /** TCPA opt-in for SMS notifications. Default false. */
  smsConsent: boolean;
}

export type MvfJuniorTournamentErrors = Partial<
  Record<keyof MvfJuniorTournamentData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateMvfJuniorTournament(
  input: unknown,
): MvfJuniorTournamentErrors {
  const data = input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const errors: MvfJuniorTournamentErrors = {};
  const text = (field: keyof MvfJuniorTournamentData) =>
    typeof data[field] === "string" ? (data[field] as string).trim() : "";

  const division = findMvfTournamentDivision(text("division"));
  if (!division || data.division !== division.division) {
    errors.division = "Pick your player's division";
  }
  if (typeof data.resident !== "boolean") {
    errors.resident = "Tell us whether you're a Montgomery Village resident";
  }
  if (!text("parentName")) errors.parentName = "Parent name is required";
  if (!text("email")) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(text("email"))) {
    errors.email = "Please enter a valid email";
  }
  if (!text("phone")) {
    errors.phone = "Phone is required";
  } else if (text("phone").replace(/\D/g, "").length < 10) {
    errors.phone = "Please enter a 10-digit phone number";
  }
  if (!text("childFirstName")) {
    errors.childFirstName = "Child first name is required";
  }
  if (!text("childLastName")) {
    errors.childLastName = "Child last name is required";
  }
  const childDob = typeof data.childDob === "string" ? data.childDob.trim() : "";
  if (data.childDob == null || (typeof data.childDob === "string" && !childDob)) {
    errors.childDob = "Child's date of birth is required";
  } else if (!isCalendarDob(childDob)) {
    errors.childDob = "Enter a valid birthdate as YYYY-MM-DD";
  } else if (division && !isDobEligibleForDivision(division.division, childDob)) {
    errors.childDob =
      division.division === "10u"
        ? "10U is for players ages 6–10 as of October 24, 2026"
        : "14U is for players ages 11–14 as of October 24, 2026";
  }
  if (!text("emergencyName")) {
    errors.emergencyName = "Emergency contact name is required";
  }
  if (!text("emergencyPhone")) {
    errors.emergencyPhone = "Emergency contact phone is required";
  } else if (text("emergencyPhone").replace(/\D/g, "").length < 10) {
    errors.emergencyPhone = "Please enter a 10-digit phone number";
  }
  if (data.allergies !== undefined && typeof data.allergies !== "string") {
    errors.allergies = "Please enter medical notes as text";
  }
  if (data.smsConsent !== undefined && typeof data.smsConsent !== "boolean") {
    errors.smsConsent = "Please choose whether to receive text messages";
  }
  return errors;
}
