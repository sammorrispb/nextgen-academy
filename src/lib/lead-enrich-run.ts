/**
 * Email → CRM enrichment engine.
 *
 * The gap this closes: correspondence with a family was being captured (a
 * nightly Gmail scrape lands threads in Open Brain), but none of it reached the
 * Notion Player CRM — the database the coach actually works from. Location,
 * preferred format, "wants privates before group" all sat in a semantic layer
 * with no join key back to the row. `Last Contact Date` was set on 33 of 420
 * rows.
 *
 * Open Brain's `writeback_nga_crm` job (open-brain: nga-crm-sync/writeback.ts)
 * POSTs one call per off-website activity — a parent's email or iMessage, a
 * meeting note, a coach's note — to /api/lead-enrich, which calls straight
 * through to `appendLeadInquiry`, the SAME writer /api/lead uses for a repeat
 * form submission. One engine, one more caller, so an Open-Brain-derived
 * update and a form-derived update cannot drift. A mail-scan routine may call
 * it directly too; both key their line on the message's own id, so the two
 * cannot stack.
 *
 * Egress is Notion and nothing else: no Resend, no Open Brain, no analytics.
 */

import { LEAD_LOCATIONS } from "./validate-lead";
import {
  appendLeadInquiry,
  ENRICH_CHANNELS,
  findFamilyRows,
  MESSAGE_ID_RE,
  MESSAGE_SOURCES,
  renderInquiryLine,
  todayET,
  type MessageSource,
} from "./notion-lead-enrich";

export interface LeadEnrichInput {
  parentEmail?: string;
  parentPhone?: string;
  /** The message's own id (Gmail id, iMessage GUID) or an Open Brain activity
   * id — makes a re-run of any caller a no-op. Opaque token, see MESSAGE_ID_RE. */
  messageId?: string;
  /** "gmail" (default) | "imessage" | "open_brain" — the id space messageId
   * lives in. Picks the marker prefix so ids from different systems cannot
   * collide inside Notes. */
  messageSource?: string;
  /** One of ENRICH_CHANNELS — rendered before the colon. Defaults to "Email". */
  channel?: string;
  /** ISO date-only (America/New_York). Defaults to today. */
  observedAt?: string;
  /** One-line summary of what the parent told us. */
  summary?: string;
  /** Must be one of LEAD_LOCATIONS — an email parse must not invent a Notion
   * select option. Only written when the row's Location is empty. */
  location?: string;
  landingPage?: string;
  dryRun?: boolean;
}

export interface LeadEnrichResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUMMARY_MAX = 400;

export function validateLeadEnrich(input: LeadEnrichInput): string[] {
  const errors: string[] = [];
  if (!input.parentEmail?.trim() && !input.parentPhone?.trim()) {
    errors.push("parentEmail or parentPhone is required");
  }
  if (!input.summary?.trim()) errors.push("summary is required");
  if (input.summary && input.summary.length > SUMMARY_MAX) {
    errors.push(`summary must be under ${SUMMARY_MAX} characters`);
  }
  if (input.observedAt && !ISO_DATE_RE.test(input.observedAt)) {
    errors.push("observedAt must be YYYY-MM-DD");
  }
  if (input.location && !(LEAD_LOCATIONS as readonly string[]).includes(input.location)) {
    errors.push("location must be one of the known areas");
  }
  if (input.channel && !(ENRICH_CHANNELS as readonly string[]).includes(input.channel)) {
    errors.push("channel must be one of the known labels");
  }
  if (input.messageSource && !(MESSAGE_SOURCES as readonly string[]).includes(input.messageSource)) {
    errors.push("messageSource must be gmail, imessage or open_brain");
  }
  if (input.messageId && !MESSAGE_ID_RE.test(input.messageId)) {
    errors.push("messageId must be an opaque id (letters, digits, . _ -; max 80)");
  }
  return errors;
}

export async function runLeadEnrich(input: LeadEnrichInput): Promise<LeadEnrichResult> {
  const errors = validateLeadEnrich(input);
  if (errors.length > 0) {
    return { ok: false, status: 400, body: { error: "Validation failed", errors } };
  }

  const entry = {
    date: input.observedAt || todayET(),
    channel: input.channel || "Email",
    summary: input.summary!.trim(),
    messageId: input.messageId,
    messageSource: input.messageSource as MessageSource | undefined,
    location: input.location,
    landingPage: input.landingPage,
  };

  // dryRun renders the exact line that WOULD be appended and touches nothing —
  // the house rule for every write surface in this repo.
  if (input.dryRun) {
    return {
      ok: true,
      status: 200,
      body: { dryRun: true, line: renderInquiryLine(entry), wrote: false },
    };
  }

  const rows = await findFamilyRows(
    input.parentEmail?.trim() ?? null,
    input.parentPhone?.trim() ?? null,
  );
  if (rows.length === 0) {
    // Not an error: plenty of inbound mail is from people who were never a
    // lead. Creating a row from an email parse would let the inbox invent
    // families, so we report and move on.
    return { ok: true, status: 200, body: { matched: false, wrote: false } };
  }

  const result = await appendLeadInquiry(rows[0].id, entry, rows[0]);
  return {
    ok: true,
    status: 200,
    body: {
      matched: true,
      wrote: result.updated,
      duplicate: result.duplicate ?? false,
      // The row the line lives on — provenance for the caller's own ledger.
      pageId: result.pageId ?? rows[0].id,
      droppedProps: result.droppedProps ?? [],
      ...(result.reason ? { reason: result.reason } : {}),
    },
  };
}
