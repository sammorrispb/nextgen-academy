/**
 * Append-an-inquiry engine for the NGA Player CRM.
 *
 * ONE writer shared by three callers so they cannot drift:
 *  - /api/lead + /api/contact, when a family we already know inquires again;
 *  - /api/lead-enrich, for anything learned OFF the website: Open Brain's
 *    writeback_nga_crm job pushes a parent's email, an iMessage, a meeting note
 *    or a coach's own note here twice a day (its lead_activities are the
 *    source), and a mail-scan routine may call it directly.
 *
 * Before this, a repeat inquiry from a known parent hit the dedup branch in
 * /api/lead and wrote NOTHING — no new row, no update — so a second child, a
 * changed location and fresh parent notes were dropped while the admin email
 * still rendered them in full. The loss was invisible unless you read the
 * "Notion CRM: already exists" line.
 *
 * What this deliberately does NOT touch:
 *  - `Status` and `Level` are coach judgment. A label inferred from form text
 *    or an email parse must never stick to a kid.
 *  - A non-empty `Location` / `Landing Page` is never overwritten — an
 *    operator's value outranks anything we derive.
 *
 * Fail-soft throughout, like notion-eval: a missing key, a vanished row or a
 * Notion 5xx is reported to the caller and never thrown, because the caller's
 * core value (the admin email / the routine's next family) must still land.
 */

import { NOTION_API, NOTION_VERSION, playerCrmDbId, readPlainText } from "./notion-utils";

/** Notion caps a rich_text property around 2000 chars. Stay under it and trim
 * the middle rather than letting an append 400 the whole PATCH. */
const NOTES_MAX = 1900;
const TRIM_MARKER = "… (older entries trimmed)";

export interface FamilyRow {
  id: string;
  playerName: string;
  notes: string;
  location: string;
  landingPage: string;
  /** As stored on the row — needed to settle a loose lookup client-side. */
  parentEmail: string;
  parentPhone: string;
  /** YYYY-MM-DD or "" — the floor Last Contact Date may not drop below. */
  lastContactDate: string;
}

export type MessageSource = "gmail" | "imessage" | "open_brain";
export const MESSAGE_SOURCES: readonly MessageSource[] = ["gmail", "imessage", "open_brain"];
/** Prefix inside the Notes marker. Short because Notes is capped ~2000 chars. */
const MARKER_PREFIX: Record<MessageSource, string> = { gmail: "gm", imessage: "im", open_brain: "ob" };

/** The labels a caller may render before the colon. A caller must not invent
 * vocabulary in Notes any more than in a select option. */
export const ENRICH_CHANNELS = [
  "Email",
  "iMessage",
  "Text",
  "WhatsApp",
  "Meeting",
  "Note",
  "Call",
  "Form",
] as const;

/** Opaque ids only — a marker must stay one token for the replay guard to find it. */
export const MESSAGE_ID_RE = /^[A-Za-z0-9._-]{1,80}$/;

export interface InquiryEntry {
  /** ISO date-only, America/New_York. Callers pass `todayET()`. */
  date: string;
  /** "Lead form" | "Contact form" | "Email" — what produced this line. */
  channel: string;
  /** One-line human summary. */
  summary: string;
  /** The message's own id when it has one (Gmail id, iMessage GUID) or the
   * Open Brain activity id. Makes replay a no-op — see markerFor. */
  messageId?: string;
  /** Which id space messageId lives in; picks the marker prefix. Defaults to
   * gmail so the original `[gm:<id>]` lines keep matching. */
  messageSource?: MessageSource;
  /** Only written when the row's own value is empty. */
  location?: string;
  landingPage?: string;
}

export interface AppendResult {
  updated: boolean;
  pageId?: string;
  /** True when the messageId was already folded in — a replay, not a failure. */
  duplicate?: boolean;
  line?: string;
  reason?: string;
  /** Optional properties Notion rejected as non-existent and we retried without. */
  droppedProps?: string[];
}

/** Today in America/New_York as YYYY-MM-DD. Never `new Date(y, m, d)` — that
 * breaks on a UTC build server (see CLAUDE.md → Date Handling). */
export function todayET(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The replay marker for an entry: `[gm:<gmail id>]`, `[im:<iMessage GUID>]` or
 * `[ob:<activity id>]`. Keyed on the message's OWN id where it has one, so a
 * line Open Brain pushes and a line a mail scan writes for the same email
 * dedupe against each other instead of stacking. Null when there is no id. */
export function markerFor(entry: Pick<InquiryEntry, "messageId" | "messageSource">): string | null {
  if (!entry.messageId) return null;
  return `[${MARKER_PREFIX[entry.messageSource ?? "gmail"]}:${entry.messageId}]`;
}

/** The one-line record appended to Notes. The marker is what makes a re-run of
 * any caller idempotent without a new Notion property. */
export function renderInquiryLine(entry: InquiryEntry): string {
  const marker = markerFor(entry);
  return `${entry.date} · ${entry.channel}: ${entry.summary}${marker ? ` ${marker}` : ""}`;
}

/** Append a line, trimming the OLDEST middle entries if we'd blow the cap. The
 * first line is kept whatever happens — it is the origin record of the lead. */
export function composeNotes(existing: string, line: string): string {
  const merged = existing.trim() ? `${existing.trim()}\n${line}` : line;
  if (merged.length <= NOTES_MAX) return merged;

  const lines = merged.split("\n");
  const first = lines[0];
  const rest = lines.slice(1);
  const kept: string[] = [];
  // Newest-first, keeping what fits under the cap alongside the origin line.
  for (let i = rest.length - 1; i >= 0; i--) {
    const candidate = [first, TRIM_MARKER, ...kept.slice().reverse()];
    const size = [...candidate, rest[i]].join("\n").length;
    if (size > NOTES_MAX) break;
    kept.push(rest[i]);
  }
  return [first, TRIM_MARKER, ...kept.reverse()].join("\n");
}

function notionHeaders(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

/**
 * Every CRM row a parent owns, by email or phone. notion-eval takes
 * page_size 1 because it only stamps a date; we need the whole set so a
 * repeat submission can tell a child we already have from a brand-new one.
 */
export async function findFamilyRows(
  email: string | null,
  phone: string | null,
): Promise<FamilyRow[]> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return [];
  const trimmedEmail = email?.trim();
  const trimmedPhone = phone?.trim();
  if (!trimmedEmail && !trimmedPhone) return [];

  const query = async (filter: Record<string, unknown>): Promise<FamilyRow[]> => {
    try {
      const res = await fetch(`${NOTION_API}/databases/${playerCrmDbId()}/query`, {
        method: "POST",
        headers: notionHeaders(notionKey),
        // Newest first, so rows[0] is the row a fresh inquiry should append to.
        body: JSON.stringify({
          filter,
          sorts: [{ timestamp: "created_time", direction: "descending" }],
          page_size: 50,
        }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: NotionPage[] };
      return (data.results ?? []).map(toFamilyRow);
    } catch {
      return [];
    }
  };

  if (trimmedEmail) {
    const exact = await query({ property: "Parent Email", email: { equals: trimmedEmail } });
    if (exact.length > 0) return exact;
    // A parent who typed Jane@Gmail.com on the form and whose address reaches
    // us lowercased from Open Brain is one family, not a stranger. `equals` is
    // Notion's exact match; `contains` is the looser net, and the re-check is
    // case-insensitive equality so it cannot widen past the one address.
    const needle = trimmedEmail.toLowerCase();
    const loose = await query({ property: "Parent Email", email: { contains: needle } });
    return loose.filter((r) => r.parentEmail.trim().toLowerCase() === needle);
  }

  // Phones are stored as typed — "(240) 555-0134" beside "+12405550134" — so
  // an exact match on formatting misses the same family. Cast a narrow net on
  // the last four digits and settle it on the normalized ten.
  const digits = trimmedPhone!.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length < 10) {
    return query({ property: "Parent Phone", phone_number: { equals: trimmedPhone } });
  }
  const loose = await query({ property: "Parent Phone", phone_number: { contains: last10.slice(-4) } });
  return loose.filter((r) => r.parentPhone.replace(/\D/g, "").endsWith(last10));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotionPage = { id: string; properties?: Record<string, any> };

function toFamilyRow(page: NotionPage): FamilyRow {
  const p = page.properties ?? {};
  return {
    id: page.id,
    playerName: readPlainText(p["Player Name"]),
    notes: readPlainText(p["Notes"]),
    location: p["Location"]?.select?.name ?? "",
    landingPage: readPlainText(p["Landing Page"]),
    parentEmail: typeof p["Parent Email"]?.email === "string" ? p["Parent Email"].email : "",
    parentPhone:
      typeof p["Parent Phone"]?.phone_number === "string" ? p["Parent Phone"].phone_number : "",
    lastContactDate:
      typeof p["Last Contact Date"]?.date?.start === "string"
        ? p["Last Contact Date"].date.start.slice(0, 10)
        : "",
  };
}

/** Case-insensitive "do we already have this child for this parent?" */
export function hasChildRow(rows: FamilyRow[], childName: string): boolean {
  const needle = childName.trim().toLowerCase();
  if (!needle) return rows.length > 0;
  return rows.some((r) => r.playerName.trim().toLowerCase() === needle);
}

/** Properties we can drop and still deliver the thing that matters. Notes and
 * Last Contact Date are NOT in here — losing those is losing the update. */
const OPTIONAL_PROPS = ["Location", "Landing Page"] as const;

/**
 * PATCH, and if Notion rejects because an OPTIONAL property doesn't exist on
 * the DB, retry once with just the load-bearing ones.
 *
 * Same lesson as createNotionPageSourceFailSoft: Notion 400s the WHOLE request
 * when a payload names a property the DB lacks, and this repo has lost two real
 * families that way. `Landing Page` is new — if it hasn't been added to the CRM
 * yet, the inquiry must still land in Notes rather than the update dying for
 * its attribution. Only a property-named rejection is retried, so a genuinely
 * broken write still surfaces.
 */
async function patchWithOptionalPropsFailSoft(
  pageId: string,
  notionKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>,
): Promise<{ ok: boolean; reason?: string; dropped?: string[] }> {
  const send = (props: Record<string, unknown>) =>
    fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({ properties: props }),
    });

  const first = await send(properties);
  if (first.ok) return { ok: true };

  const detail = await first.text().catch(() => "");
  const offending = OPTIONAL_PROPS.filter(
    (name) => name in properties && detail.includes(name),
  );
  if (offending.length === 0) {
    return { ok: false, reason: `patch failed (${first.status}): ${detail.slice(0, 200)}` };
  }

  const retried = { ...properties };
  for (const name of offending) delete retried[name];
  const second = await send(retried);
  if (!second.ok) {
    return { ok: false, reason: `patch retry failed (${second.status})` };
  }
  console.warn(
    `[lead-enrich] dropped ${offending.join(", ")} — not a property on the CRM; add it in Notion`,
  );
  return { ok: true, dropped: [...offending] };
}

/**
 * Append one inquiry line to a row and stamp Last Contact Date.
 *
 * `row` may be passed in (callers that already queried) to save a round trip;
 * otherwise the page is fetched so we never clobber Notes we haven't read.
 */
export async function appendLeadInquiry(
  pageId: string,
  entry: InquiryEntry,
  row?: FamilyRow,
): Promise<AppendResult> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { updated: false, reason: "NOTION_API_KEY missing" };

  try {
    let current = row;
    if (!current) {
      const get = await fetch(`${NOTION_API}/pages/${pageId}`, {
        headers: notionHeaders(notionKey),
      });
      if (!get.ok) return { updated: false, pageId, reason: `page read failed (${get.status})` };
      current = toFamilyRow((await get.json()) as NotionPage);
    }

    // Replay guard. A re-run of ANY caller must not double-append.
    const marker = markerFor(entry);
    if (marker && current.notes.includes(marker)) {
      return { updated: false, pageId, duplicate: true };
    }

    const line = renderInquiryLine(entry);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      Notes: { rich_text: [{ text: { content: composeNotes(current.notes, line) } }] },
    };
    // Last Contact Date only ever moves forward. Open Brain pushes oldest-first
    // and retries stragglers days later; an older line must not drag the row's
    // "last heard from" back behind a newer one.
    if (!current.lastContactDate || entry.date >= current.lastContactDate) {
      properties["Last Contact Date"] = { date: { start: entry.date } };
    }
    // Fill-if-empty only: an operator's value outranks anything we derived.
    if (entry.location && !current.location) {
      properties["Location"] = { select: { name: entry.location } };
    }
    if (entry.landingPage && !current.landingPage) {
      properties["Landing Page"] = {
        rich_text: [{ text: { content: entry.landingPage.slice(0, NOTES_MAX) } }],
      };
    }

    const patch = await patchWithOptionalPropsFailSoft(pageId, notionKey, properties);
    if (!patch.ok) {
      return { updated: false, pageId, reason: patch.reason };
    }
    return { updated: true, pageId, line, droppedProps: patch.dropped };
  } catch (err) {
    return {
      updated: false,
      pageId,
      reason: err instanceof Error ? err.message : "unknown error",
    };
  }
}
