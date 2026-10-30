import { findMvfJuniorSeriesEvent } from "./mvf-junior-series";
import { isCalendarDob } from "./mvf-junior-tournament-2026";
import { sessionStartUtcMs, parseStartTime } from "@/lib/session-time";

export const MVF_SERIES_KIND = "mvf-junior-series";
export const MVF_SERIES_ACCOUNT = "acct_1TU4iSBpXOfTC961";
export const MVF_SERIES_ADMISSION_ENABLED: boolean = false;
export type SeriesDivision = "12u" | "16u";
export interface SeriesRelease {
  event: string;
  revision: string;
  date: string;
  startTime: string;
  endTime: string;
  registrationClosesAt: string;
  eligibility: Record<SeriesDivision, { minAge: number; maxAge: number }>;
  multipleBrackets: boolean;
  eligibilityText: string;
  minimumEnrollmentPolicy: string;
  cancellationPolicy: string;
  rainPolicy: string;
  invoiceDueDays: number;
  ngaRevenueShare: number;
}

// Retain issued versions permanently: closing admission or changing a later
// release must never strand an existing invoice, receipt or paid callback.
export const MVF_SERIES_RELEASES: readonly SeriesRelease[] = [];
export const MVF_SERIES_ACTIVE_REVISIONS: Readonly<Record<string, string>> = {};

export function seriesEventKey(event: string, division: SeriesDivision): string {
  if (!findMvfJuniorSeriesEvent(event)) throw new Error("Unknown tournament");
  return `mvf-junior-tournament-${event}-${division}`;
}

export function releaseProblems(release: SeriesRelease): string[] {
  const problems: string[] = [];
  if (!findMvfJuniorSeriesEvent(release.event)) problems.push("event");
  if (!/^[a-z0-9-]{1,40}$/.test(release.revision)) problems.push("policy revision");
  if (!isCalendarDob(release.date)) problems.push("confirmed date");
  const start = isCalendarDob(release.date) ? sessionStartUtcMs(release.date, release.startTime) : null, end = isCalendarDob(release.date) ? sessionStartUtcMs(release.date, release.endTime) : null;
  if (!parseStartTime(release.startTime) || !parseStartTime(release.endTime) || start === null || end === null || end <= start) problems.push("confirmed times");
  if (!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(release.registrationClosesAt) || !Number.isFinite(Date.parse(release.registrationClosesAt))) problems.push("registration deadline");
  for (const division of ["12u", "16u"] as const) {
    const age = release.eligibility?.[division];
    if (!age || !Number.isInteger(age.minAge) || age.minAge < 6 || !Number.isInteger(age.maxAge) || age.minAge > age.maxAge || age.maxAge !== (division === "12u" ? 12 : 16)) problems.push(`${division} eligibility`);
  }
  if (typeof release.multipleBrackets !== "boolean") problems.push("multiple bracket policy");
  for (const key of ["eligibilityText", "minimumEnrollmentPolicy", "cancellationPolicy", "rainPolicy"] as const) {
    if (!release[key]?.trim() || release[key].length > 480 || /\b(?:tbd|to be confirmed)\b/i.test(release[key])) problems.push(key);
  }
  if (!Number.isInteger(release.invoiceDueDays) || release.invoiceDueDays < 1 || release.invoiceDueDays > 30) problems.push("invoice due days");
  if (!Number.isFinite(release.ngaRevenueShare) || release.ngaRevenueShare < 0 || release.ngaRevenueShare > 1) problems.push("confirmed revenue allocation");
  if (start !== null && Date.parse(release.registrationClosesAt) + release.invoiceDueDays * 86400000 > start) problems.push("invoice payment window before event");
  return problems;
}

export function findSeriesRelease(event: string, revision: string): SeriesRelease | undefined {
  return MVF_SERIES_RELEASES.find(r => r.event === event && r.revision === revision);
}

export function publishedSeriesRelease(event: string): SeriesRelease | undefined {
  const release = findSeriesRelease(event, MVF_SERIES_ACTIVE_REVISIONS[event]);
  return release && releaseProblems(release).length === 0 ? release : undefined;
}

export function activeSeriesRelease(event: string): SeriesRelease | undefined {
  return MVF_SERIES_ADMISSION_ENABLED ? publishedSeriesRelease(event) : undefined;
}

export function publicSeriesRelease(event: string, now = Date.now()): SeriesRelease | undefined {
  const release = activeSeriesRelease(event);
  return release && Number.isFinite(now) && now < Date.parse(release.registrationClosesAt) ? release : undefined;
}

export interface SeriesRegistration {
  division: SeriesDivision; resident: boolean; parentName: string; email: string; phone: string;
  childFirstName: string; childLastName: string; childDob: string;
  emergencyName: string; emergencyPhone: string; allergies: string; smsConsent: boolean;
  policyAccepted: boolean; revision: string; submissionId: string;
}

export function validateSeriesRegistration(value: unknown, release: SeriesRelease): Record<string, string> {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const errors: Record<string, string> = {};
  const text = (key: string) => typeof input[key] === "string" ? (input[key] as string).trim() : "";
  for (const key of ["parentName", "childFirstName", "childLastName", "emergencyName"]) if (!text(key) || text(key).length > 100 || /[\r\n\x00-\x1f]/.test(text(key))) errors[key] = "Enter a name (100 characters maximum)";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text("email")) || text("email").length > 254) errors.email = "Enter a valid parent email";
  for (const key of ["phone", "emergencyPhone"]) if (!/^\+?[\d ()-]{10,25}$/.test(text(key)) || text(key).replace(/\D/g, "").length < 10) errors[key] = "Enter a valid phone number";
  if (typeof input.resident !== "boolean") errors.resident = "Choose resident or nonresident";
  if (!["12u", "16u"].includes(String(input.division))) errors.division = "Choose 12U or 16U";
  if (!isCalendarDob(text("childDob"))) errors.childDob = "Enter a valid date of birth";
  else if (!errors.division) {
    const bounds = release.eligibility[input.division as SeriesDivision];
    const dob = text("childDob");
    const years = Number(release.date.slice(0, 4)) - Number(dob.slice(0, 4)) - (release.date.slice(5) < dob.slice(5) ? 1 : 0);
    if (years < bounds.minAge || years > bounds.maxAge) errors.childDob = `This bracket is ages ${bounds.minAge}–${bounds.maxAge} on ${release.date}`;
  }
  if (typeof input.allergies !== "string" || input.allergies.length > 480) errors.allergies = "Use at most 480 characters";
  if (typeof input.smsConsent !== "boolean") errors.smsConsent = "Choose whether to receive texts";
  if (input.policyAccepted !== true) errors.policyAccepted = "A parent or guardian must accept the event policies";
  if (input.revision !== release.revision) errors.revision = "Event policies changed; reload before registering";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text("submissionId"))) errors.submissionId = "Reload the form to start a registration attempt";
  return errors;
}
