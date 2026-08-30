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
 * A scheduled routine reads the inbox and POSTs one call per thread to
 * /api/lead-enrich, which calls straight through to `appendLeadInquiry` — the
 * SAME writer /api/lead uses for a repeat form submission. One engine, two
 * callers, so an email-derived update and a form-derived update cannot drift.
 *
 * Egress is Notion and nothing else: no Resend, no Open Brain, no analytics.
 */

import { LEAD_LOCATIONS } from "./validate-lead";
import { appendLeadInquiry, findFamilyRows, renderInquiryLine, todayET } from "./notion-lead-enrich";

export interface LeadEnrichInput {
  parentEmail?: string;
  parentPhone?: string;
  /** Gmail message id — makes a re-run of the scan a no-op. */
  messageId?: string;
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
  return errors;
}

export async function runLeadEnrich(input: LeadEnrichInput): Promise<LeadEnrichResult> {
  const errors = validateLeadEnrich(input);
  if (errors.length > 0) {
    return { ok: false, status: 400, body: { error: "Validation failed", errors } };
  }

  const entry = {
    date: input.observedAt || todayET(),
    channel: "Email",
    summary: input.summary!.trim(),
    messageId: input.messageId,
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
      droppedProps: result.droppedProps ?? [],
      ...(result.reason ? { reason: result.reason } : {}),
    },
  };
}
