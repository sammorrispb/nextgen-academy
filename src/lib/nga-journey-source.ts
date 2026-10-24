import { createHash } from "node:crypto";
import { REGISTRATION_WINDOW_DAYS } from "@/data/schedule";
import { isPlayerLevel } from "@/lib/notion-player-bracket";
import { NOTION_API, NOTION_VERSION, playerCrmDbId, readPlainText } from "@/lib/notion-utils";
import { sessionToSlug } from "@/lib/session-slug";
import { chooseNgaPrograms, ngaPreviewState, type NgaAssessment, type NgaProgram, type NgaPreview } from "@/lib/nga-journey";

const idPattern = /^(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i;
const sameId = (a: unknown, b: string) => typeof a === "string" && a.replaceAll("-", "") === b.replaceAll("-", "");
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
class SourceError extends Error { constructor(readonly reason: string, readonly status = 503) { super(reason); } }
interface Page { id: string; archived?: boolean; in_trash?: boolean; parent?: { database_id?: string }; last_edited_time?: string; properties?: Record<string, unknown> }
async function readNotion(path: string, body?: object, assessmentRead = false): Promise<unknown> {
  const res = await fetch(`${NOTION_API}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${process.env.NOTION_API_KEY}`, "Content-Type": "application/json", "Notion-Version": NOTION_VERSION }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (res.status === 404 && assessmentRead) throw new SourceError("assessment_not_found", 404);
  if (!res.ok) throw new SourceError("source_unavailable");
  return res.json();
}
function select(value: unknown): string | null { return object(value) && object(value.select) && typeof value.select.name === "string" ? value.select.name : null; }
function number(value: unknown, formula = false): number | null { const v = object(value) ? formula && object(value.formula) ? value.formula.number : value.number : null; return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null; }
function page(value: unknown, db: string, assessmentRead = true): Page {
  if (!object(value) || typeof value.id !== "string" || !object(value.parent) || !sameId(value.parent.database_id, db) || value.archived === true || value.in_trash === true) throw new SourceError(assessmentRead ? "assessment_not_found" : "inventory_record_invalid", assessmentRead ? 404 : 503);
  if (typeof value.last_edited_time !== "string" || !Number.isFinite(Date.parse(value.last_edited_time)) || !object(value.properties)) throw new SourceError("source_revision_unavailable");
  return value as unknown as Page;
}
/** Existing Level and age remain canonical. Identity evidence is returned
 * only to the explicitly reviewed exact-registration association helper. The
 * ordinary preview below projects assessment only, with no identity fields. */
export interface NgaAssessmentEvidence {
  assessment: NgaAssessment;
  /** Server-only evidence for an explicitly reviewed registration association. */
  identity: { childFirstName: string; parentEmail: string; parentPhone: string };
}
export async function readNgaAssessmentEvidence(playerId: string): Promise<NgaAssessmentEvidence> {
  const p = page(await readNotion(`/pages/${playerId}`, undefined, true), playerCrmDbId());
  if (!sameId(p.id, playerId)) throw new SourceError("assessment_not_found", 404);
  const props = p.properties!;
  if (select(props.Audience) !== "Youth") throw new SourceError("assessment_not_found", 404);
  const rawLevel = select(props.Level); const level = isPlayerLevel(rawLevel) ? rawLevel : null;
  const age = number(props.Age);
  const email = props["Parent Email"], phone = props["Parent Phone"];
  return {
    assessment: { playerId: p.id, level, age, revision: digest([p.id, p.last_edited_time, level, age]) },
    identity: { childFirstName: readPlainText(props["Player Name"]), parentEmail: object(email) && typeof email.email === "string" ? email.email : "", parentPhone: object(phone) && typeof phone.phone_number === "string" ? phone.phone_number : "" },
  };
}
export async function readNgaAssessment(playerId: string): Promise<NgaAssessment> {
  return (await readNgaAssessmentEvidence(playerId)).assessment;
}
/** Strict inventory projection intentionally omits roster enrichment. The public
 * schedule's fail-soft empty list and capacity defaults cannot prove eligibility.
 * Sessions currently have no canonical typed age-range property. Global youth
 * policy cannot replace program-specific restrictions in freeform copy: keep
 * ageRange unknown until that evidence exists. Never infer it from a title. */
export async function readNgaProgramInventory(now: string): Promise<NgaProgram[]> {
  const db = process.env.NOTION_SESSIONS_DB_ID!;
  const from = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const end = new Date(`${from}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + REGISTRATION_WINDOW_DAYS);
  const programs: NgaProgram[] = []; let cursor: string | undefined; const seen = new Set<string>();
  for (let count = 0; count < 12; count += 1) {
    const value = await readNotion(`/databases/${db}/query`, { filter: { and: [{ property: "Date", date: { on_or_after: from } }, { property: "Date", date: { on_or_before: end.toISOString().slice(0, 10) } }] }, sorts: [{ property: "Date", direction: "ascending" }], page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    if (!object(value) || !Array.isArray(value.results) || typeof value.has_more !== "boolean") throw new SourceError("inventory_incomplete");
    for (const raw of value.results) {
      if (object(raw) && (raw.archived === true || raw.in_trash === true)) continue;
      const p = page(raw, db, false), props = p.properties!;
      const level = select(props.Level);
      const dateProp = props.Date;
      const date = object(dateProp) && object(dateProp.date) && typeof dateProp.date.start === "string" ? dateProp.date.start : "";
      const title = readPlainText(props.Session);
      const rawStatus = select(props.Status);
      const data: Omit<NgaProgram, "revision"> = { ageRange: null, id: p.id, title, date, startTime: readPlainText(props["Start time"]), endTime: readPlainText(props["End time"]), level: isPlayerLevel(level) || level === "All Levels" ? level : null, location: readPlainText(props.Location) || readPlainText(props["Public Area"]), status: rawStatus && ["Open", "Full", "Cancelled", "Completed", "Passed"].includes(rawStatus) ? rawStatus : null, capacity: number(props.Capacity, true), registeredCount: number(props["Registered count"]), url: `/schedule/${sessionToSlug({ title, date })}` };
      programs.push({ ...data, revision: digest([data, p.last_edited_time]) });
    }
    if (!value.has_more) return programs;
    if (typeof value.next_cursor !== "string" || !value.next_cursor || seen.has(value.next_cursor)) throw new SourceError("inventory_incomplete");
    cursor = value.next_cursor; seen.add(cursor);
  }
  throw new SourceError("inventory_incomplete");
}
export async function runNgaJourneyPreview(input: unknown, opts: { now?: string } = {}): Promise<{ status: number; body: NgaPreview }> {
  if (!object(input) || typeof input.playerId !== "string" || !idPattern.test(input.playerId)) return { status: 400, body: ngaPreviewState("clarification", "invalid_player_id") };
  if ("parentToken" in input) return { status: 422, body: ngaPreviewState("unsupported", "parent_preference_authority_unavailable") };
  if (Object.keys(input).some((key) => !["playerId", "review", "preferences"].includes(key))) return { status: 400, body: ngaPreviewState("clarification", "unsupported_request_field") };
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_SESSIONS_DB_ID) return { status: 503, body: ngaPreviewState("unavailable", "source_not_configured") };
  const now = opts.now ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(now))) return { status: 503, body: ngaPreviewState("unavailable", "invalid_clock") };
  try {
    const assessment = await readNgaAssessment(input.playerId);
    const preliminary = chooseNgaPrograms({ assessment, programs: [], review: input.review, preferences: input.preferences ?? {}, now });
    if (["clarification", "stale", "unsupported"].includes(preliminary.state)) return { status: preliminary.state === "stale" ? 409 : preliminary.state === "unsupported" ? 422 : 200, body: preliminary };
    const programs = await readNgaProgramInventory(now);
    const latest = await readNgaAssessment(input.playerId);
    if (latest.revision !== assessment.revision) return { status: 409, body: { ...ngaPreviewState("stale", "assessment_changed"), assessment: latest } };
    return { status: 200, body: chooseNgaPrograms({ assessment, programs, review: input.review, preferences: input.preferences ?? {}, now }) };
  } catch (error) {
    const status = error instanceof SourceError ? error.status : 503;
    return { status, body: ngaPreviewState("unavailable", error instanceof SourceError ? error.reason : "source_unavailable") };
  }
}
