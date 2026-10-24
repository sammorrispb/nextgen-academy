import { SKILL_STACK, CURRICULUM_AGE_MIN, CURRICULUM_AGE_MAX } from "@/data/session-curriculum";
import type { PlayerLevel } from "@/lib/notion-player-bracket";
import { sessionStartUtcMs, parseStartTime } from "@/lib/session-time";

export const NGA_NEXT_FOCUS_OPTIONS = SKILL_STACK.map((block) => ({ id: `skill-${block.order}`, label: block.name }));
export interface NgaAssessment { playerId: string; revision: string; level: PlayerLevel | null; age: number | null }
export interface NgaProgram {
  id: string; revision: string; title: string; date: string; startTime: string; endTime: string;
  level: PlayerLevel | "All Levels" | null; location: string; status: string | null;
  capacity: number | null; registeredCount: number | null; url: string;
  /** Null when the canonical source does not publish program-specific ages. */
  ageRange: { min: number; max: number } | null;
  /** Only a reviewed exact-program rule can clear additional eligibility.
   * Absent for older callers; absence still requires coach confirmation. */
  eligibilityPolicy?: { revision: string; additionalEligibility: "no_additional_restrictions" | "requires_coach_confirmation" } | null;
}
export interface NgaReview { assessmentRevision: string; focusId: string; confirmed: true; ageConfirmed?: boolean }
type Mode = "required" | "preferred";
export interface NgaPreferences {
  days?: { mode: Mode; values: number[] };
  locations?: { mode: Mode; values: string[] };
  time?: { mode: Mode; start: string; end: string };
}
export interface NgaProgramChoice extends NgaProgram { fit: "fit" | "needs_confirmation"; reasons: string[] }
export interface NgaPreview {
  state: "recommendation" | "clarification" | "needs_confirmation" | "no_match" | "unavailable" | "stale" | "unsupported";
  reason?: string; assessment?: NgaAssessment; nextFocus?: { id: string; label: string };
  programs: NgaProgramChoice[];
  scope: "coach_read_only_session_preview";
}
const scope = "coach_read_only_session_preview" as const;
export function ngaPreviewState(state: NgaPreview["state"], reason: string): NgaPreview { return { state, reason, programs: [], scope }; }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const mode = (v: unknown) => v === "required" || v === "preferred";
const minutes = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3)) : null;
const validDate = (v: string) => { const parsed = new Date(`${v}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v; };
function knownAgeRange(p: NgaProgram): NgaProgram["ageRange"] {
  const range = p.ageRange;
  return range && Number.isInteger(range.min) && Number.isInteger(range.max) && range.min >= 0 && range.max >= range.min ? range : null;
}
function knownEligibilityPolicy(p: NgaProgram): NonNullable<NgaProgram["eligibilityPolicy"]> | null {
  const policy = p.eligibilityPolicy;
  return object(policy) && keys(policy, ["revision", "additionalEligibility"]) && typeof policy.revision === "string" && policy.revision.length > 0 && policy.revision.length <= 128 && policy.revision === policy.revision.trim() && !/[\u0000-\u001f\u007f]/.test(policy.revision) && (policy.additionalEligibility === "no_additional_restrictions" || policy.additionalEligibility === "requires_coach_confirmation") ? { revision: policy.revision, additionalEligibility: policy.additionalEligibility } : null;
}
function keys(v: Record<string, unknown>, allowed: string[]) { return Object.keys(v).every((k) => allowed.includes(k)); }

export function validateNgaPreferences(value: unknown): "valid" | "invalid" | "unsupported" {
  if (!object(value)) return "invalid";
  if (!keys(value, ["days", "locations", "time"])) return "unsupported";
  for (const name of ["days", "locations"] as const) {
    const entry = value[name]; if (entry === undefined) continue;
    if (!object(entry) || !keys(entry, ["mode", "values"]) || !mode(entry.mode) || !Array.isArray(entry.values) || entry.values.length < 1 || entry.values.length > 20) return "invalid";
    if (name === "days" && !entry.values.every((v) => Number.isInteger(v) && v >= 0 && v <= 6)) return "invalid";
    if (name === "locations" && !entry.values.every((v) => typeof v === "string" && v.trim().length > 0 && v.length <= 150)) return "invalid";
  }
  const t = value.time;
  if (t !== undefined && (!object(t) || !keys(t, ["mode", "start", "end"]) || !mode(t.mode) || typeof t.start !== "string" || typeof t.end !== "string" || minutes(t.start) === null || minutes(t.end) === null || minutes(t.start)! >= minutes(t.end)!)) return "invalid";
  return "valid";
}

/** Rules consume assessed skill, explicit coach review, and temporary scheduling
 * choices independently. No model, registration, persistence or send is called. */
export function chooseNgaPrograms(input: { assessment: NgaAssessment; programs: NgaProgram[]; review?: unknown; preferences: unknown; now: string }): NgaPreview {
  const { assessment, programs, now } = input;
  const prefState = validateNgaPreferences(input.preferences);
  if (prefState !== "valid") return ngaPreviewState(prefState === "unsupported" ? "unsupported" : "clarification", prefState === "unsupported" ? "unsupported_parent_requirement" : "invalid_parent_requirements");
  const preferences = input.preferences as NgaPreferences;
  if (!Number.isFinite(Date.parse(now))) return ngaPreviewState("unavailable", "invalid_clock");
  if (!assessment.level) return { ...ngaPreviewState("clarification", "coach_assessment_required"), assessment };
  const review = input.review;
  if (!object(review) || !keys(review, ["assessmentRevision", "focusId", "confirmed", "ageConfirmed"]) || review.confirmed !== true || typeof review.focusId !== "string") return { ...ngaPreviewState("clarification", "coach_review_required"), assessment };
  if (review.assessmentRevision !== assessment.revision) return { ...ngaPreviewState("stale", "assessment_changed"), assessment };
  const nextFocus = NGA_NEXT_FOCUS_OPTIONS.find((o) => o.id === review.focusId);
  if (!nextFocus) return { ...ngaPreviewState("clarification", "invalid_next_focus"), assessment };
  const result = (state: NgaPreview["state"], choices: NgaProgramChoice[], reason?: string): NgaPreview => ({ state, ...(reason ? { reason } : {}), assessment, nextFocus, programs: choices, scope });
  const currentAge = review.ageConfirmed === true && typeof assessment.age === "number" && Number.isInteger(assessment.age) && assessment.age >= 0 ? assessment.age : null;
  if (currentAge !== null && (currentAge < CURRICULUM_AGE_MIN || currentAge > CURRICULUM_AGE_MAX)) return result("no_match", [], "outside_youth_age_policy");
  const choices: { program: NgaProgramChoice; score: number; start: number }[] = [];
  // Every record must independently survive known denials and required
  // constraints before it can contribute evidence to a shared destination.
  for (const p of programs) {
    const reasons: string[] = []; let score = 0;
    if (p.status && p.status !== "Open") continue;
    const ageRange = knownAgeRange(p);
    if (ageRange && currentAge !== null && (currentAge < ageRange.min || currentAge > ageRange.max)) continue;
    if (p.level && p.level !== "All Levels" && p.level !== assessment.level) continue;
    if (p.capacity !== null && p.registeredCount !== null && p.registeredCount >= p.capacity) continue;
    const start = validDate(p.date) ? sessionStartUtcMs(p.date, p.startTime) : null;
    const end = validDate(p.date) ? sessionStartUtcMs(p.date, p.endTime) : null;
    if (start !== null && start <= Date.parse(now)) continue;
    if (!ageRange) reasons.push("program_age_policy_unknown");
    const eligibilityPolicy = knownEligibilityPolicy(p);
    if (!eligibilityPolicy) reasons.push("program_eligibility_policy_unknown");
    else if (eligibilityPolicy.additionalEligibility === "requires_coach_confirmation") reasons.push("program_eligibility_confirmation_required");
    if (currentAge === null) reasons.push("age_confirmation_required");
    if (!p.level) reasons.push("program_level_unknown");
    if (!p.status) reasons.push("program_status_unknown");
    if (p.capacity === null || p.registeredCount === null) reasons.push("capacity_unknown");
    if (start === null || end === null || end <= start) reasons.push("program_time_unknown");
    const day = validDate(p.date) ? new Date(`${p.date}T12:00:00Z`).getUTCDay() : null;
    if (preferences.days) {
      const matches = day !== null && preferences.days.values.includes(day);
      if (!matches && preferences.days.mode === "required") { if (day !== null) continue; reasons.push("required_day_unknown"); }
      if (matches) score += 1;
    }
    if (preferences.locations) {
      const matches = preferences.locations.values.some((v) => v.trim().toLowerCase() === p.location.trim().toLowerCase());
      if (!matches && preferences.locations.mode === "required") { if (p.location.trim()) continue; reasons.push("required_location_unknown"); }
      if (matches) score += 1;
    }
    if (preferences.time) {
      const st = parseStartTime(p.startTime), en = parseStartTime(p.endTime);
      const matches = st && en && st.h * 60 + st.m >= minutes(preferences.time.start)! && en.h * 60 + en.m <= minutes(preferences.time.end)!;
      if (!matches && preferences.time.mode === "required") { if (st && en) continue; reasons.push("required_time_unknown"); }
      if (matches) score += 1;
    }
    choices.push({ program: { ...p, fit: reasons.length ? "needs_confirmation" : "fit", reasons }, score, start: start ?? Infinity });
  }
  const destinations = new Map<string, typeof choices>();
  for (const choice of choices) destinations.set(choice.program.url, [...destinations.get(choice.program.url) ?? [], choice]);
  const deduplicated: typeof choices = [];
  const authority = (p: NgaProgram) => JSON.stringify([p.date, p.startTime, p.endTime, p.level, p.location, p.status, p.capacity, p.registeredCount, knownAgeRange(p)?.min ?? null, knownAgeRange(p)?.max ?? null, knownEligibilityPolicy(p)]);
  for (const [url, versions] of [...destinations].sort(([a], [b]) => a.localeCompare(b))) {
    versions.sort((a, b) => a.program.id.localeCompare(b.program.id) || a.program.revision.localeCompare(b.program.revision) || a.program.title.localeCompare(b.program.title));
    const first = versions[0];
    // Source identity, revision and display label alone do not contradict the
    // facts authorizing this destination. Conflicting facts still need review.
    const conflict = versions.some((v) => authority(v.program) !== authority(first.program));
    deduplicated.push(conflict ? { program: { ...first.program, url, fit: "needs_confirmation", reasons: [...new Set([...first.program.reasons, "conflicting_destination_evidence"])] }, score: 0, start: Infinity } : first);
  }
  deduplicated.sort((a, b) => Number(a.program.fit !== "fit") - Number(b.program.fit !== "fit") || b.score - a.score || a.start - b.start || a.program.url.localeCompare(b.program.url) || a.program.id.localeCompare(b.program.id));
  const selected = deduplicated.map((c) => c.program);
  return result(selected.some((p) => p.fit === "fit") ? "recommendation" : selected.length ? "needs_confirmation" : "no_match", selected);
}
