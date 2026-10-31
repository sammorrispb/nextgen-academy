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
  // Optional only for retained historical versions that used event-day age.
  ageCutoffDate?: string;
  eligibility: Record<SeriesDivision, { minAge: number; maxAge: number }>;
  multipleBrackets: boolean;
  eligibilityText: string;
  minimumEnrollmentPolicy: string;
  cancellationPolicy: string;
  rainPolicy: string;
  invoiceDueDays: number;
  ngaRevenueShare: number;
  // Retained older releases split the full price; new agreements split the
  // resident base and allocate the entire nonresident surcharge to MVF.
  ngaRevenueBaseUsd?: number;
}

// Retain issued versions permanently: closing admission or changing a later
// release must never strand an existing invoice, receipt or paid callback.
// Winter snapshots deliberately fail releaseProblems until makeup venues are confirmed.
// Do not remove that blocker by rewording the pending terms. No invoice has been issued.
export const MVF_SERIES_RELEASES: readonly SeriesRelease[] = [
  { event: "november-2026", date: "2026-11-14", endTime: "12:00 PM", registrationClosesAt: "2026-11-04T15:00:00Z", rainPolicy: "Weather decisions will be made 24 hours before the tournament. The same-day indoor weather backup is Lake Marion Community Center gymnasium, 3:00–6:00 PM ET, later than the 10:00 AM–noon outdoor tournament. No separate makeup date is scheduled." },
  { event: "january-2027", date: "2027-01-17", endTime: "1:00 PM", registrationClosesAt: "2027-01-07T15:00:00Z", rainPolicy: "Weather decisions will be made 24 hours before the tournament. Indoor tournament at Lake Marion Community Center. The offered makeup is January 23, 2027, 3:30–6:30 PM ET. Makeup venue to be confirmed." },
  { event: "february-2027", date: "2027-02-14", endTime: "1:00 PM", registrationClosesAt: "2027-02-04T15:00:00Z", rainPolicy: "Weather decisions will be made 24 hours before the tournament. Indoor tournament at Lake Marion Community Center. The offered makeup is February 20, 2027, 3:30–6:30 PM ET. Makeup venue to be confirmed." },
].map(event => ({
  ...event, revision: "launch-2026-10-31", startTime: "10:00 AM", ageCutoffDate: `${event.date.slice(0, 4)}-12-31`,
  eligibility: { "12u": { minAge: 6, maxAge: 12 }, "16u": { minAge: 6, maxAge: 16 } }, multipleBrackets: false,
  eligibilityText: "Players must be at least 6. Age is measured on December 31 of the tournament year. Younger players may play up into an older junior bracket. Choose one bracket per player per tournament.",
  minimumEnrollmentPolicy: "A minimum of 8 players across both brackets is needed to run each tournament. If a bracket has fewer than 5 players, we will decide whether to combine or cancel it 3 days before the tournament.",
  cancellationPolicy: "No refunds unless we cancel.", invoiceDueDays: 7, ngaRevenueShare: 0.8, ngaRevenueBaseUsd: 50,
}));
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
  if (release.ageCutoffDate !== undefined && (!isCalendarDob(release.ageCutoffDate) || release.ageCutoffDate !== `${release.date.slice(0, 4)}-12-31`)) problems.push("age cutoff date");
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
  if (release.ngaRevenueBaseUsd !== undefined && release.ngaRevenueBaseUsd !== findMvfJuniorSeriesEvent(release.event)?.prices.residentUsd) problems.push("confirmed revenue base");
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
    const cutoff = release.ageCutoffDate ?? release.date;
    const years = Number(cutoff.slice(0, 4)) - Number(dob.slice(0, 4)) - (cutoff.slice(5) < dob.slice(5) ? 1 : 0);
    if (years < bounds.minAge || years > bounds.maxAge) errors.childDob = `This bracket is ages ${bounds.minAge}–${bounds.maxAge} on ${cutoff}`;
  }
  if (typeof input.allergies !== "string" || input.allergies.length > 480) errors.allergies = "Use at most 480 characters";
  if (typeof input.smsConsent !== "boolean") errors.smsConsent = "Choose whether to receive texts";
  if (input.policyAccepted !== true) errors.policyAccepted = "A parent or guardian must accept the event policies";
  if (input.revision !== release.revision) errors.revision = "Event policies changed; reload before registering";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text("submissionId"))) errors.submissionId = "Reload the form to start a registration attempt";
  return errors;
}
