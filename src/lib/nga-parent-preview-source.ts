import { isAllowedCoachEmail } from "@/lib/coach-allowlist";
import { readPlainText } from "@/lib/notion-utils";
import { NgaJourneyProviderError, resolveNgaJourneyProvider, type NgaJourneyProvider } from "@/lib/nga-journey-provider";
import { readNgaAssessmentEvidence, readNgaProgramInventory } from "@/lib/nga-journey-source";
import { chooseNgaPrograms, validateNgaPreferences, type NgaAssessment, type NgaPreview } from "@/lib/nga-journey";
import { issueParentPreviewCode, verifyParentPreviewCode, parentPreviewFingerprint, parentPreviewKeyConfigured, isNgaPageId, type ParentPreviewAuthority } from "@/lib/nga-parent-preview";

type Result = { status: number; body: Record<string, unknown> };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key));
const sameId = (a: unknown, b: string) => typeof a === "string" && a.replaceAll("-", "").toLowerCase() === b.replaceAll("-", "").toLowerCase();
const denied = (status: number, code: string): Result => ({ status, body: { error: "Preview unavailable", code } });
class PreviewError extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }
function fingerprint(value: unknown): string { const result = parentPreviewFingerprint(value); if (!result) throw new PreviewError(503, "preview_not_configured"); return result; }
function clock(now?: string): { iso: string; ms: number } { const iso = now ?? new Date().toISOString(), ms = Date.parse(iso); if (!Number.isFinite(ms)) throw new PreviewError(503, "invalid_clock"); return { iso, ms }; }
const text = (value: unknown, field: string) => object(value) && typeof value[field] === "string" ? value[field] as string : "";
const normalizedName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
const normalizedPhone = (phone: string) => { const digits = phone.replace(/\D/g, ""); return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits; };
interface Identity { childFirstName: string; parentEmail: string; parentPhone: string }
interface Pair {
  registrationId: string; registrationRevision: string; assessment: NgaAssessment; identityRevision: string; associationRevision: string;
  registrationIdentity: Identity; assessmentIdentity: Identity; sessionDate: string;
}
function matchingIdentity(a: Identity, b: Identity): boolean {
  const ae = a.parentEmail.trim().toLowerCase(), be = b.parentEmail.trim().toLowerCase();
  const ap = normalizedPhone(a.parentPhone), bp = normalizedPhone(b.parentPhone);
  if (!normalizedName(a.childFirstName) || normalizedName(a.childFirstName) !== normalizedName(b.childFirstName)) return false;
  if (ae && be && ae !== be) return false;
  if (ap && bp && ap !== bp) return false;
  return !!(ae && be && ae === be) || !!(ap.length === 10 && bp.length === 10 && ap === bp);
}
/** Exact pages only. No family query, inference, registration write or child store. */
async function readPair(registrationId: string, playerId: string, provider: NgaJourneyProvider): Promise<Pair> {
  const db = provider.registrationsDbId;
  if (!db) throw new PreviewError(503, "source_not_configured");
  const page = await provider.request(`/v1/pages/${registrationId}`);
  if (!object(page) || !sameId(page.id, registrationId) || !object(page.parent) || !sameId(page.parent.database_id, db) || page.archived === true || page.in_trash === true) throw new PreviewError(404, "source_unavailable");
  if (typeof page.last_edited_time !== "string" || !Number.isFinite(Date.parse(page.last_edited_time)) || !object(page.properties)) throw new PreviewError(503, "source_revision_unavailable");
  const props = page.properties;
  const status = object(props.Status) && object(props.Status.select) ? props.Status.select.name : null;
  if (status !== "Confirmed") throw new PreviewError(409, "source_changed");
  const checkout = readPlainText(props["Stripe Checkout Session ID"]);
  if (!checkout) throw new PreviewError(409, "registration_authority_unavailable");
  const registrationIdentity: Identity = { childFirstName: readPlainText(props["Child First Name"]), parentEmail: text(props["Parent Email"], "email"), parentPhone: text(props["Parent Phone"], "phone_number") };
  let evidence: Awaited<ReturnType<typeof readNgaAssessmentEvidence>>;
  try { evidence = await readNgaAssessmentEvidence(playerId, provider); }
  catch (error) { if (error instanceof Error && "status" in error && error.status === 404) throw new PreviewError(404, "source_unavailable"); throw error; }
  if (!matchingIdentity(registrationIdentity, evidence.identity)) throw new PreviewError(409, "association_unavailable");
  const birthYear = object(props["Child Birth Year"]) ? props["Child Birth Year"].number : null;
  const registrationRevision = fingerprint([page.id, page.last_edited_time, status, checkout, registrationIdentity, birthYear]);
  const identityRevision = fingerprint([evidence.assessment.playerId, evidence.identity]);
  const date = props["Session Date"];
  return { registrationId: page.id as string, registrationRevision, assessment: evidence.assessment, identityRevision, associationRevision: fingerprint([registrationRevision, evidence.assessment.revision, identityRevision]), registrationIdentity, assessmentIdentity: evidence.identity, sessionDate: object(date) && object(date.date) && typeof date.date.start === "string" ? date.date.start : "" };
}
function unchanged(a: Pair, b: Pair): boolean { return a.associationRevision === b.associationRevision; }
function authorityMatches(pair: Pair, claims: ParentPreviewAuthority): boolean { return sameId(pair.registrationId, claims.registrationId) && sameId(pair.assessment.playerId, claims.playerId) && pair.registrationRevision === claims.registrationRevision && pair.assessment.revision === claims.assessmentRevision && pair.identityRevision === claims.identityRevision; }
function failed(error: unknown): Result { return error instanceof PreviewError ? denied(error.status, error.code) : error instanceof NgaJourneyProviderError ? denied(error.status, error.reason) : denied(503, "source_unavailable"); }

export async function runCoachParentCapability(input: unknown, coachEmail: string, options: { now?: string } = {}): Promise<Result> {
  if (!isAllowedCoachEmail(coachEmail)) return denied(401, "coach_session_required");
  if (!object(input) || typeof input.action !== "string" || (input.action !== "inspect" && input.action !== "issue") || !isNgaPageId(input.registrationId) || !isNgaPageId(input.playerId) || !keys(input, input.action === "inspect" ? ["action", "registrationId", "playerId"] : ["action", "registrationId", "playerId", "associationRevision", "associationConfirmed", "review"])) return denied(400, "invalid_input");
  if (input.action === "issue" && (input.associationConfirmed !== true || typeof input.associationRevision !== "string" || !object(input.review))) return denied(400, "explicit_association_review_required");
  if (!parentPreviewKeyConfigured()) return denied(503, "preview_not_configured");
  try {
    const provider = resolveNgaJourneyProvider();
    const now = clock(options.now), pair = await readPair(input.registrationId, input.playerId, provider);
    if (!isAllowedCoachEmail(coachEmail)) return denied(401, "coach_access_revoked");
    if (input.action === "inspect") return { status: 200, body: { ok: true, associationRevision: pair.associationRevision, assessment: { ...pair.assessment, identity: pair.assessmentIdentity }, registration: { id: pair.registrationId, identity: pair.registrationIdentity, sessionDate: pair.sessionDate }, limits: "One registration, read-only dated proposal. No preferences are saved or messages sent." } };
    if (input.associationRevision !== pair.associationRevision) return denied(409, "association_changed");
    const preview = chooseNgaPrograms({ assessment: pair.assessment, programs: [], review: input.review, preferences: {}, now: now.iso });
    if (!preview.nextFocus || preview.state === "stale" || preview.state === "clarification") return denied(preview.state === "stale" ? 409 : 400, preview.reason ?? "coach_review_required");
    const latest = await readPair(pair.registrationId, pair.assessment.playerId, provider);
    if (!unchanged(pair, latest)) return denied(409, "association_changed");
    if (!isAllowedCoachEmail(coachEmail)) return denied(401, "coach_access_revoked");
    const code = issueParentPreviewCode({ registrationId: pair.registrationId, playerId: pair.assessment.playerId, registrationRevision: pair.registrationRevision, assessmentRevision: pair.assessment.revision, identityRevision: pair.identityRevision, focusId: preview.nextFocus.id }, coachEmail, now.ms);
    if (!code) return denied(503, "preview_not_configured");
    return { status: 200, body: { ok: true, code, expiresAt: new Date(now.ms + 600_000).toISOString(), reviewedAt: now.iso, nextFocus: preview.nextFocus, limits: "This dated proposal expires in ten minutes. Source changes or loss of issuer access invalidate it. Editing this draft does not revoke a copied code." } };
  } catch (error) { return failed(error); }
}

export async function runParentJourneyPreview(code: unknown, input: unknown, options: { now?: string } = {}): Promise<Result> {
  try {
    const now = clock(options.now), claims = verifyParentPreviewCode(code, now.ms);
    if (!claims) return denied(parentPreviewKeyConfigured() ? 401 : 503, "parent_preview_code_required");
    if (!object(input) || !keys(input, ["preferences", "ageConfirmed"]) || (input.ageConfirmed !== undefined && typeof input.ageConfirmed !== "boolean")) return denied(400, "invalid_input");
    const preferences = input.preferences ?? {}, preferenceState = validateNgaPreferences(preferences);
    if (preferenceState !== "valid") return denied(preferenceState === "unsupported" ? 422 : 400, "unsupported_or_invalid_requirements");
    const provider = resolveNgaJourneyProvider();
    const pair = await readPair(claims.registrationId, claims.playerId, provider);
    if (!authorityMatches(pair, claims)) return denied(409, "reviewed_source_changed");
    const programs = await readNgaProgramInventory(now.iso, provider);
    const latest = await readPair(claims.registrationId, claims.playerId, provider);
    if (!authorityMatches(latest, claims)) return denied(409, "reviewed_source_changed");
    // Re-read the clock and current key/allowlist after slow dependencies.
    const after = options.now ? now.ms : Date.now();
    if (!verifyParentPreviewCode(code, after)) return denied(401, "parent_preview_access_revoked");
    const preview: NgaPreview = chooseNgaPrograms({ assessment: pair.assessment, programs, review: { confirmed: true, focusId: claims.focusId, assessmentRevision: claims.assessmentRevision, ageConfirmed: input.ageConfirmed === true }, preferences, now: now.iso });
    return { status: 200, body: { state: preview.state, ...(preview.reason ? { reason: preview.reason } : {}), nextFocus: preview.nextFocus, assessment: { level: pair.assessment.level, age: pair.assessment.age }, programs: preview.programs, reviewedAt: new Date(claims.issuedAt * 1000).toISOString(), expiresAt: new Date(claims.expiresAt * 1000).toISOString(), scope: "registration_parent_read_only_preview", limits: "Dated coach review for one registration. Scheduling choices are temporary; this preview saves nothing and holds no place." } };
  } catch (error) { return failed(error); }
}
