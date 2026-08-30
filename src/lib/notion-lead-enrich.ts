/**
 * Append-an-inquiry engine for the NGA Player CRM.
 *
 * ONE writer shared by two callers so they cannot drift:
 *  - /api/lead + /api/contact, when a family we already know inquires again;
 *  - /api/lead-enrich, when the mail-scan routine learns something over email.
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
}

export interface InquiryEntry {
  /** ISO date-only, America/New_York. Callers pass `todayET()`. */
  date: string;
  /** "Lead form" | "Contact form" | "Email" — what produced this line. */
  channel: string;
  /** One-line human summary. */
  summary: string;
  /** Gmail message id, when this came from a mail scan. Makes replay a no-op. */
  messageId?: string;
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

/** The one-line record appended to Notes. The `[gm:<id>]` marker is what makes
 * a re-run of the mail scan idempotent without a new Notion property. */
export function renderInquiryLine(entry: InquiryEntry): string {
  const marker = entry.messageId ? ` [gm:${entry.messageId}]` : "";
  return `${entry.date} · ${entry.channel}: ${entry.summary}${marker}`;
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

  const filter = trimmedEmail
    ? { property: "Parent Email", email: { equals: trimmedEmail } }
    : { property: "Parent Phone", phone_number: { equals: trimmedPhone } };

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

    // Replay guard. A re-run of the mail scan must not double-append.
    if (entry.messageId && current.notes.includes(`[gm:${entry.messageId}]`)) {
      return { updated: false, pageId, duplicate: true };
    }

    const line = renderInquiryLine(entry);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      Notes: { rich_text: [{ text: { content: composeNotes(current.notes, line) } }] },
      "Last Contact Date": { date: { start: entry.date } },
    };
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
