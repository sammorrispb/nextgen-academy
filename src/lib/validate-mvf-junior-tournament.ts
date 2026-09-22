// Validator for the MVF Junior Tournament checkout
// (/api/checkout-mvf-junior-tournament). Same parent/child/emergency field
// set as the lesson, Monday Girls drop-in, and Winter League checkouts, plus:
// the division (10u or 14u), the child's date of birth (validated against
// the division server-side — age as of 2026-10-24), the child's last name,
// and the self-attested Montgomery Village resident flag that sets the price.

import {
  findMvfTournamentDivision,
  isDobEligibleForDivision,
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
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateMvfJuniorTournament(
  data: Partial<MvfJuniorTournamentData>,
): MvfJuniorTournamentErrors {
  const errors: MvfJuniorTournamentErrors = {};

  const division = findMvfTournamentDivision(data.division ?? "");
  if (!data.division?.trim() || !division) {
    errors.division = "Pick your player's division";
  }
  if (typeof data.resident !== "boolean") {
    errors.resident = "Tell us whether you're a Montgomery Village resident";
  }
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
  if (!data.childLastName?.trim()) {
    errors.childLastName = "Child last name is required";
  }
  if (!data.childDob?.trim()) {
    errors.childDob = "Child's date of birth is required";
  } else if (!DOB_RE.test(data.childDob.trim())) {
    errors.childDob = "Enter the birthdate as YYYY-MM-DD";
  } else if (division && !isDobEligibleForDivision(division.division, data.childDob.trim())) {
    errors.childDob =
      division.division === "10u"
        ? "10U is for players 10 and under as of October 24, 2026"
        : "14U is for players ages 11–14 as of October 24, 2026";
  }
  if (!data.emergencyName?.trim()) {
    errors.emergencyName = "Emergency contact name is required";
  }
  if (!data.emergencyPhone?.trim()) {
    errors.emergencyPhone = "Emergency contact phone is required";
  } else if (data.emergencyPhone.replace(/\D/g, "").length < 10) {
    errors.emergencyPhone = "Please enter a 10-digit phone number";
  }
  return errors;
}
