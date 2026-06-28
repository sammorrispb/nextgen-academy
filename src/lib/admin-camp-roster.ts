import type { CampRosterEntry } from "@/lib/notion-camp-roster";

/**
 * Admin camp-roster projection for the /admin/sessions Camps section. It manages
 * registration + refunds — NOT day-of safety — so it deliberately DROPS the
 * camp-safety fields (allergies/medical, emergency contact) that the coach
 * day-of roster (`/coach/camps/[slug]`) carries. Narrowing here keeps
 * allergy/emergency-contact child PII off this new admin egress path; that
 * omission is pinned by e2e/invariant-admin-camps-roster.spec.ts.
 */
export interface AdminCampCamper {
  stripeSessionId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number | null;
  optionLabel: string;
  optionKey: string;
  selectedDay: string;
  registeredAt: string;
}

export function toAdminCampCamper(e: CampRosterEntry): AdminCampCamper {
  return {
    stripeSessionId: e.stripeSessionId,
    parentName: e.parentName,
    parentEmail: e.parentEmail,
    parentPhone: e.parentPhone,
    childFirstName: e.childFirstName,
    childBirthYear: e.childBirthYear,
    optionLabel: e.optionLabel,
    optionKey: e.optionKey,
    selectedDay: e.selectedDay,
    registeredAt: e.registeredAt,
  };
}
