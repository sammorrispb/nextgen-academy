import {
  createNotionPageSourceFailSoft, EMAIL_RE, NOTION_API, NOTION_VERSION,
  playerCrmDbId, readPlainText,
} from "./notion-utils";
import { buildWaiverSignUrl } from "./waiver-gate";

type WaiverCheck = { action: "check_waiver"; parentEmail: string };
type PrepareRequest = {
  action: "prepare_request"; requestId: string; parentName: string;
  parentEmail: string; parentPhone: string; partySize: number;
};
type Input = WaiverCheck | PrepareRequest;
type Result = { status: number; body: { ok?: true; error?: string; code?: string; waiverUrl?: string } };
type Page = { id: string; properties: Record<string, unknown> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parse(raw: unknown): Input | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const checkOnly = value.action === "check_waiver";
  if (!checkOnly && value.action !== "prepare_request") return null;
  const allowed = checkOnly ? ["action", "parentEmail"]
    : ["action", "requestId", "parentName", "parentEmail", "parentPhone", "partySize"];
  if (Object.keys(value).some(k => !allowed.includes(k))) return null;
  const email = typeof value.parentEmail === "string" ? value.parentEmail.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  if (checkOnly) return { action: "check_waiver", parentEmail: email };
  const name = typeof value.parentName === "string" ? value.parentName.trim() : "";
  const phone = typeof value.parentPhone === "string" ? value.parentPhone.trim() : "";
  if (!name || name.length > 200 || /[\r\n\x00-\x1f]/.test(name)
    || typeof value.requestId !== "string" || !UUID.test(value.requestId)
    || typeof value.parentPhone !== "string" || phone.length > 30
    || (phone && !/^\+?[\d ()-]{7,30}$/.test(phone))
    || typeof value.partySize !== "number" || !Number.isInteger(value.partySize)
    || value.partySize < 1 || value.partySize > 8) return null;
  return { action: "prepare_request", requestId: value.requestId, parentName: name,
    parentEmail: email, parentPhone: phone, partySize: value.partySize };
}

function emailOf(page: Page): string {
  const field = page.properties["Parent Email"] as { email?: unknown } | undefined;
  return typeof field?.email === "string" ? field.email.trim().toLowerCase() : "";
}

async function parentRows(db: string, email: string, key: string): Promise<Page[]> {
  const pages: Page[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Notion-Version": NOTION_VERSION },
      body: JSON.stringify({ filter: { property: "Parent Email", email: { contains: email } },
        page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    if (!res.ok) throw new Error("Parent lookup unavailable");
    const body = await res.json();
    if (!Array.isArray(body.results) || typeof body.has_more !== "boolean"
      || body.results.some((p: Page) => typeof p?.id !== "string" || !p.id
        || !p.properties || typeof p.properties !== "object" || !EMAIL_RE.test(emailOf(p)))) {
      throw new Error("Parent lookup incomplete");
    }
    pages.push(...body.results.filter((p: Page) => emailOf(p) === email));
    cursor = body.has_more ? body.next_cursor : undefined;
    if (body.has_more && (typeof cursor !== "string" || !cursor || cursors.has(cursor) || cursors.size >= 20)) {
      throw new Error("Parent lookup incomplete");
    }
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return pages;
}

function signed(page: Page): boolean {
  const at = page.properties["Signed At"] as { date?: { start?: unknown } } | undefined;
  return Boolean(readPlainText(page.properties["Signature Name"]).trim()
    && readPlainText(page.properties["Waiver Version"]).trim()
    && typeof at?.date?.start === "string" && Number.isFinite(Date.parse(at.date.start)));
}

/** Parent-only handoff. A failed read must never mean "new family" or "waiver signed". */
export async function runLessonScheduling(raw: unknown): Promise<Result> {
  const input = parse(raw);
  if (!input) return { status: 400, body: { error: "Invalid lesson request" } };
  const key = process.env.NOTION_API_KEY;
  const waiverDb = process.env.NOTION_WAIVERS_DB_ID;
  const unavailable: Result = { status: 503, body: {
    error: "We couldn't verify your NGA details. Please try again, or text Coach Sam at 301-325-4731.",
  } };
  if (!key || !waiverDb) return unavailable;
  try {
    if (!(await parentRows(waiverDb, input.parentEmail, key)).some(signed)) {
      const path = buildWaiverSignUrl({ email: input.parentEmail,
        parentName: input.action === "prepare_request" ? input.parentName : undefined, next: "/lessons/book" });
      return { status: 409, body: { code: "WAIVER_REQUIRED",
        error: "Please sign the NGA waiver, then return here and send your request.",
        waiverUrl: `https://nextgenpbacademy.com${path}` } };
    }
    if (input.action === "prepare_request"
      && !(await parentRows(playerCrmDbId(), input.parentEmail, key)).length) {
      // A clearly labelled parent inquiry, not an invented child profile. The
      // regular newsletter reconciliation applies every existing exclusion.
      const { res } = await createNotionPageSourceFailSoft({
        notionKey: key, databaseId: playerCrmDbId(), logPrefix: "[lesson-scheduling]",
        properties: {
          "Player Name": { title: [{ text: { content: `Lesson inquiry — ${input.parentName}` } }] },
          "Parent Name": { rich_text: [{ text: { content: input.parentName } }] },
          "Parent Email": { email: input.parentEmail },
          ...(input.parentPhone ? { "Parent Phone": { phone_number: input.parentPhone } } : {}),
          Source: { select: { name: "Website" } },
          Notes: { rich_text: [{ text: { content: `Parent started an NGA lesson request for ${input.partySize} player(s). Child details remain with NGA. [lesson-request:${input.requestId}]` } }] },
          "Last Contact Date": { date: { start: new Date().toISOString().slice(0, 10) } },
        },
      });
      if (!res.ok) return unavailable;
      const created = await res.json();
      if (typeof created.id !== "string" || !created.id) return unavailable;
    }
    return { status: 200, body: { ok: true } };
  } catch {
    // Provider error bodies can contain parent/child fields. Never echo or log them.
    return unavailable;
  }
}
