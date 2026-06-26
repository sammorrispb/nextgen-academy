// Pure view-model helpers for the coach-only camp roster page. No I/O — these
// translate the Stripe-derived CampRosterEntry list into render-ready rows so
// the page stays a thin shell and the logic is unit-testable without a browser.
// Date matching is ISO-string comparison only (never new Date(y, m, d), which
// off-by-ones on Vercel's UTC build servers — see the date-only hazard).

import { type Camp, type CampOptionKey, campDays } from "@/data/camps";
import type { CampRosterEntry } from "@/lib/notion-camp-roster";

// Stripe metadata caps values at 500 chars; checkout-camp trims allergies to
// 480, so a stored value at exactly 480 may have lost its tail — flag it.
const ALLERGY_CAP = 480;

/** Age from a birth year, or null when the year is unknown. */
export function deriveAge(
  birthYear: number | null,
  refYear: number,
): number | null {
  if (birthYear === null) return null;
  return refYear - birthYear;
}

/**
 * Which of the four camp mornings a registration covers.
 * - "week" → all four [0,1,2,3].
 * - a "day" whose selected date is in the camp week → that single index.
 * - a "day" whose selected date is NOT in the week → empty + offWeek=true
 *   (a visible "day not in this camp week" state, never silently blank).
 * - no selected day → empty, not off-week.
 */
export function campAttendingDays(
  optionKey: CampOptionKey | string,
  selectedDay: string,
  camp: Camp,
): { indexes: number[]; offWeek: boolean } {
  if (optionKey === "week") {
    return { indexes: [0, 1, 2, 3], offWeek: false };
  }
  if (!selectedDay) {
    return { indexes: [], offWeek: false };
  }
  const i = campDays(camp).indexOf(selectedDay);
  if (i === -1) {
    return { indexes: [], offWeek: true };
  }
  return { indexes: [i], offWeek: false };
}

/** Allergy text plus whether it may have been truncated at the Stripe cap. */
export function allergyDisplay(allergies: string): {
  text: string;
  truncated: boolean;
} {
  return { text: allergies, truncated: allergies.length === ALLERGY_CAP };
}

export interface CampRosterViewEntry {
  stripeSessionId: string;
  childFirstName: string;
  age: number | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  emergencyName: string;
  emergencyPhone: string;
  allergies: string;
  allergiesTruncated: boolean;
  optionLabel: string;
  /** Indexes (0–3) of the camp mornings this registration covers. */
  attendingDays: number[];
  /** True when a single-day pick falls outside this camp's week. */
  offWeek: boolean;
  registeredAt: string;
}

/** Map Stripe-derived roster entries into render-ready coach view rows. */
export function toRosterView(
  entries: CampRosterEntry[],
  camp: Camp,
  refYear: number,
): CampRosterViewEntry[] {
  return entries.map((e) => {
    const { indexes, offWeek } = campAttendingDays(
      e.optionKey,
      e.selectedDay,
      camp,
    );
    const allergy = allergyDisplay(e.allergies);
    return {
      stripeSessionId: e.stripeSessionId,
      childFirstName: e.childFirstName,
      age: deriveAge(e.childBirthYear, refYear),
      parentName: e.parentName,
      parentEmail: e.parentEmail,
      parentPhone: e.parentPhone,
      emergencyName: e.emergencyName,
      emergencyPhone: e.emergencyPhone,
      allergies: allergy.text,
      allergiesTruncated: allergy.truncated,
      optionLabel: e.optionLabel,
      attendingDays: indexes,
      offWeek,
      registeredAt: e.registeredAt,
    };
  });
}
