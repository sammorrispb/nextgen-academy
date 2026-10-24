/** Reviewed policy is scoped to one Sessions database and one session page.
 * Titles, slugs, environment variables and the general youth age policy cannot
 * supply a program rule. Add entries only after reviewing that exact program. */
export interface NgaProgramAgeRule {
  sessionsDbId: string;
  programId: string;
  reviewStatus: "pending" | "reviewed" | "rejected";
  ageRange: { min: number; max: number };
  policySourceUrl: string;
  /** Change this revision whenever the reviewed policy or its evidence changes. */
  policyRevision: string;
  reviewedBy: string;
  reviewedAt: string;
  /** Inclusive program dates in America/New_York, not the lookup date. */
  effectiveFrom: string;
  effectiveThrough: string;
  additionalEligibility: "no_additional_restrictions" | "requires_coach_confirmation";
}

// One isolated synthetic session has an explicitly reviewed test policy.
// Every other program still requires its own exact reviewed source rule.
export const NGA_PROGRAM_AGE_REGISTRY: readonly NgaProgramAgeRule[] = Object.freeze([
  Object.freeze({
    sessionsDbId: "bea3d534-4dc1-407b-a413-aee04ddaf69e",
    programId: "403fa3ac-27dc-8196-968a-f51ea29ac8c3",
    reviewStatus: "reviewed" as const,
    ageRange: Object.freeze({ min: 8, max: 12 }),
    policySourceUrl: "https://app.notion.com/p/402fa3ac27dc814596c1c03fe2c62ff9",
    policyRevision: "664f-synthetic-session-v1",
    reviewedBy: "Codex release review (root 1a0c)",
    reviewedAt: "2026-10-24T14:51:20.000Z",
    effectiveFrom: "2026-10-25",
    effectiveThrough: "2026-10-25",
    additionalEligibility: "no_additional_restrictions" as const,
  }),
]);

export interface NgaReviewedProgramAgePolicy {
  ageRange: { min: number; max: number };
  revision: string;
  additionalEligibility: NgaProgramAgeRule["additionalEligibility"];
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown): string | null => typeof v === "string" && /^(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(v) ? v.replaceAll("-", "").toLowerCase() : null;
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max && v === v.trim() && !/[\u0000-\u001f\u007f]/.test(v);
function date(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}
function instant(v: unknown): number | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)) return null;
  const parsed = new Date(v);
  return Number.isFinite(parsed.getTime()) && (parsed.toISOString() === v || parsed.toISOString().replace(".000Z", "Z") === v) ? parsed.getTime() : null;
}
function sourceUrl(v: unknown): boolean {
  if (!text(v, 2048)) return false;
  try { const url = new URL(v); return url.protocol === "https:" && !!url.hostname && !url.username && !url.password && !url.search; }
  catch { return false; }
}

/** Exactly one complete reviewed rule must authorize this source record.
 * Duplicate entries remain ambiguous even if their apparent bounds agree.
 * A future event may use a future effective interval once the review exists. */
export function resolveNgaProgramAgePolicy(input: { sessionsDbId: string; programId: string; eventDate: string; now: string }, registry: readonly unknown[] = NGA_PROGRAM_AGE_REGISTRY): NgaReviewedProgramAgePolicy | null {
  const db = uuid(input.sessionsDbId), program = uuid(input.programId), now = instant(input.now);
  if (!db || !program || !date(input.eventDate) || now === null || !Array.isArray(registry)) return null;
  const matches = registry.filter((entry) => object(entry) && uuid(entry.sessionsDbId) === db && uuid(entry.programId) === program);
  if (matches.length !== 1) return null;
  const rule = matches[0];
  if (!object(rule) || Object.keys(rule).sort().join(",") !== "additionalEligibility,ageRange,effectiveFrom,effectiveThrough,policyRevision,policySourceUrl,programId,reviewStatus,reviewedAt,reviewedBy,sessionsDbId") return null;
  const range = rule.ageRange;
  if (!object(range) || Object.keys(range).sort().join(",") !== "max,min" || !Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max) || (range.min as number) < 0 || (range.max as number) < (range.min as number)) return null;
  if (rule.reviewStatus !== "reviewed" || !sourceUrl(rule.policySourceUrl) || !text(rule.policyRevision, 128) || !text(rule.reviewedBy, 200)) return null;
  const reviewedAt = instant(rule.reviewedAt);
  if (reviewedAt === null || reviewedAt > now || !date(rule.effectiveFrom) || !date(rule.effectiveThrough) || rule.effectiveFrom > rule.effectiveThrough) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  if (input.eventDate < rule.effectiveFrom || input.eventDate > rule.effectiveThrough || today > rule.effectiveThrough) return null;
  if (rule.additionalEligibility !== "no_additional_restrictions" && rule.additionalEligibility !== "requires_coach_confirmation") return null;
  return { ageRange: { min: range.min as number, max: range.max as number }, revision: rule.policyRevision, additionalEligibility: rule.additionalEligibility };
}
