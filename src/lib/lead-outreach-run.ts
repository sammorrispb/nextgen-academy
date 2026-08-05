/**
 * Shared engine for the two lead-CRM outreach blasts — eval-reengagement and
 * camp-outreach. Extracted VERBATIM from src/app/api/eval-reengagement/route.ts
 * and src/app/api/camp-outreach/route.ts (Phase 2b of the admin-reduction
 * roadmap) so the secret-gated curl routes and the /coach/ops server actions
 * run the IDENTICAL segmentation + send path — mirroring how
 * eval-confirmation-send.ts serves two callers. The routes stay byte-identical
 * in behavior; e2e/invariant-ops-trigger-parity.spec.ts pins route === core.
 *
 * The load-bearing rule lives in classifyLead (lead-segmentation.ts): DD-derived
 * / quarantined rows are OFF-LIMITS and are excluded inside
 * fetchLeadOutreachRecipients, so NO caller can mail them.
 */

import { Resend } from "resend";
import { playerCrmDbId } from "@/lib/notion-utils";
import {
  isMailable,
  isTestOrInternal,
  type LeadRow,
} from "@/lib/lead-segmentation";
import { resolveFamilyBucket } from "@/lib/lead-family-bucket";
import { fetchUnsubscribedEmails } from "@/lib/notion-newsletter";
import {
  signLeadConsentToken,
  type ConsentAction,
} from "@/lib/lead-consent-token";
import {
  evalReengagementHtml,
  evalReengagementText,
  EVAL_REENGAGEMENT_SUBJECT,
} from "@/lib/email/eval-reengagement";
import {
  campOutreachHtml,
  campOutreachText,
  CAMP_OUTREACH_SUBJECT,
} from "@/lib/email/camp-outreach";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Lead CRM database id resolves through the shared env-backed constant in
// notion-utils (NOTION_PLAYER_CRM_DB_ID → literal; legacy NOTION_DB_ID is dead).

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const NEWSLETTER_URL = "https://nextgenpbacademy.com/newsletter";
// UTM-stamped /camp link so the push is attributable in /cmo attribute.
const CAMP_URL =
  "https://nextgenpbacademy.com/camp?utm_source=email&utm_medium=parent-outreach&utm_campaign=back-to-school-camp-2026";

/**
 * One-click consent/opt-out link for a recipient. Returns null when no signing
 * secret is configured — the template then degrades to the reply-based opt-out
 * rather than rendering a dead link.
 */
function consentUrl(email: string, action: ConsentAction): string | null {
  const token = signLeadConsentToken(email, action);
  if (!token) return null;
  return `https://nextgenpbacademy.com/api/lead-consent?action=${action}&token=${encodeURIComponent(token)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readText(prop: any): string {
  return (prop?.rich_text ?? prop?.title ?? [])
    .map((t: { plain_text?: string }) => t.plain_text ?? "")
    .join("");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readSelect(prop: any): string {
  return prop?.select?.name ?? "";
}

export interface OutreachRecipient {
  email: string;
  parentFirst: string;
  name: string;
}

export interface LeadSegmentation {
  recipients: OutreachRecipient[];
  scanned: number;
  /** Counts below are FAMILIES (one parent email), not CRM rows. */
  eligible: number;
  offLimits: number;
  ambiguous: number;
  test: number;
  /** Families excluded because they asked us to stop (quarantine or unsubscribe). */
  suppressed: number;
  /** Families with DD/CourtReserve provenance anywhere in their rows. */
  ddDerived: number;
  /** Whether this run mailed the ddDerived bucket. */
  ddIncluded: boolean;
}

export interface RecipientOpts {
  /** Mail DD/CourtReserve-derived families. Off by default; the no-DD-derived-
   * sales rule stands unless an operator explicitly overrides it for one send. */
  includeDdDerived?: boolean;
}

/**
 * Query the lead CRM and return deduped recipients, folded PER FAMILY.
 *
 * Two suppression sources are unioned and are never overridable:
 *   - the CRM `Quarantine` checkbox (classifyLead → offLimitsKind "opt_out")
 *   - `Status = Unsubscribed` in the newsletter DB, because an unsubscribe is
 *     a person saying stop, not a per-sender preference.
 *
 * Folding is per family rather than per row: the CRM holds 405 rows for 257
 * parents, so the previous row-by-row loop mailed anyone who had at least one
 * clean row — silently ignoring an opt-out recorded on a duplicate, and leaking
 * DD provenance for families holding both a Website and a Google Sheet row.
 * See lead-family-bucket.ts. Pinned by e2e/invariant-lead-suppression.spec.ts.
 */
export async function fetchLeadOutreachRecipients(
  includeAmbiguous: boolean,
  opts: RecipientOpts = {},
): Promise<LeadSegmentation> {
  const includeDdDerived = opts.includeDdDerived === true;
  const notionKey = process.env.NOTION_API_KEY;
  const db = playerCrmDbId();
  if (!notionKey) {
    throw new Error("NOTION_API_KEY not configured");
  }

  // Throws if the newsletter DB is unreachable. Deliberate: proceeding with an
  // empty suppression set would re-mail everyone who unsubscribed.
  const unsubscribed = await fetchUnsubscribedEmails();

  interface Family {
    email: string;
    name: string;
    rows: LeadRow[];
  }
  const families = new Map<string, Family>();
  const testEmails = new Set<string>();
  let scanned = 0;
  let cursor: string | undefined;

  do {
    const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Notion query failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    for (const page of data.results ?? []) {
      scanned++;
      const p = page.properties ?? {};
      const email = (p["Parent Email"]?.email ?? "").trim();
      const name = readText(p["Parent Name"]);
      if (!isMailable(email)) continue;

      const key = email.toLowerCase();
      // Strip QA / internal / Sam's-own rows before anything else. One test row
      // condemns the whole address — a QA twin must not smuggle a real send.
      if (isTestOrInternal(name, email)) {
        testEmails.add(key);
        continue;
      }

      const row: LeadRow = {
        parentEmail: email,
        source: readSelect(p["Source"]),
        crEventsAttended: p["CR Events Attended"]?.number ?? null,
        crEventHistory: readText(p["CR Event History"]),
        lastCrEvent: readText(p["Last CR Event"]),
        season: readSelect(p["Season"]),
        notes: readText(p["Notes"]),
        quarantine: p["Quarantine"]?.checkbox ?? false,
      };

      const existing = families.get(key);
      if (existing) existing.rows.push(row);
      else families.set(key, { email, name, rows: [row] });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  const recipients: OutreachRecipient[] = [];
  let eligible = 0;
  let ambiguous = 0;
  let suppressed = 0;
  let ddDerived = 0;

  for (const [key, fam] of families) {
    if (testEmails.has(key)) continue;

    const bucket = resolveFamilyBucket(fam.email, fam.rows, unsubscribed);
    if (bucket === "suppressed") {
      suppressed++;
      continue;
    }
    if (bucket === "dd_derived") {
      ddDerived++;
      if (!includeDdDerived) continue;
    } else if (bucket === "ambiguous") {
      ambiguous++;
      if (!includeAmbiguous) continue;
    } else {
      eligible++;
    }

    recipients.push({
      email: fam.email,
      name: fam.name,
      parentFirst: fam.name.split(/\s+/)[0] || "there",
    });
  }

  return {
    recipients,
    scanned,
    eligible,
    // "off_limits" keeps its historical meaning in response bodies: families
    // that exist but were not mailed on policy grounds.
    offLimits: suppressed + (includeDdDerived ? 0 : ddDerived),
    ambiguous,
    test: testEmails.size,
    suppressed,
    ddDerived,
    ddIncluded: includeDdDerived,
  };
}

export interface OutreachRunResult {
  status: number;
  body: Record<string, unknown>;
}

interface BlastOutcome {
  sent: number;
  failed: number;
  sentEmails: string[];
  failedEmails: string[];
  errors: string[];
}

/** Throttled Resend loop shared by both blasts (~3.3/sec, under the 5/sec cap). */
async function sendBlast(
  recipients: OutreachRecipient[],
  subject: string,
  render: (r: OutreachRecipient) => { html: string; text: string },
): Promise<BlastOutcome> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const sentEmails: string[] = [];
  const failedEmails: string[] = [];
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (i > 0) await new Promise((res) => setTimeout(res, 300));
    const { html, text } = render(r);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: r.email,
      replyTo: REPLY_TO,
      subject,
      html,
      text,
    });
    if (error) {
      failed++;
      failedEmails.push(r.email);
      errors.push(`${r.email}: ${error.message ?? String(error)}`);
    } else {
      sent++;
      sentEmails.push(r.email);
    }
  }
  return { sent, failed, sentEmails, failedEmails, errors };
}

/**
 * Validate + normalize the optional `only` allow-list. Fails LOUD: any
 * non-string entry is a structured 400 (zero sends) — a silently-coerced or
 * silently-dropped allow-list could widen a send to the full eligible set.
 */
function normalizeOnly(
  only: unknown,
):
  | { ok: true; set: Set<string> | null }
  | { ok: false; result: OutreachRunResult } {
  if (!Array.isArray(only) || only.length === 0) {
    return { ok: true, set: null };
  }
  if (only.some((e) => typeof e !== "string")) {
    return {
      ok: false,
      result: { status: 400, body: { error: "only[] must be strings" } },
    };
  }
  return {
    ok: true,
    set: new Set(only.map((e) => e.trim().toLowerCase())),
  };
}

export interface EvalReengagementOpts {
  dryRun?: boolean;
  subject?: string;
  /** Optional allow-list: restrict the send to these emails (e.g. retrying only
   * the addresses that failed a prior run, so already-sent rows aren't redone). */
  only?: string[];
}

export interface CampOutreachOpts {
  dryRun?: boolean;
  subject?: string;
  /** Optional allow-list: restrict the send to these emails. The canonical camp
   * send passes the vetted, age-filtered warm-list.csv here so only that exact
   * set is mailed (the DD gate above still applies as a second safety net). */
  only?: string[];
  /** Opt in to the ambiguous bucket (own leads, unverified marketing source, NOT
   * DD-derived). Off by default so the conservative on-policy send stays default. */
  includeAmbiguous?: boolean;
  /** Opt in to DD/CourtReserve-derived families. Off by default — the
   * no-DD-derived-sales rule stands unless an operator overrides it for one
   * send (Sam's explicit call for the Aug-2026 permission pass). Opt-outs are
   * suppressed regardless; this widens provenance, never consent. */
  includeDdDerived?: boolean;
}

/**
 * The one parameterized blast runner behind both exported ops. The two blasts
 * were byte-for-byte identical except for the bits captured in this config —
 * subject default, rendered template, log tag, whether the ambiguous bucket is
 * mailed, and the camp-only response fields. The exported names stay as thin
 * wrappers so routes/actions/specs don't churn, and each op's response bodies
 * are preserved key-for-key (pinned by e2e/invariant-ops-trigger-parity.spec.ts).
 */
interface OutreachBlastConfig {
  logTag: "eval-reengagement" | "camp-outreach";
  defaultSubject: string;
  render: (r: OutreachRecipient) => { html: string; text: string };
  /** Whether the ambiguous bucket is included in the recipient set. */
  includeAmbiguous: boolean;
  /** Whether DD-derived families are included. Never overrides suppression. */
  includeDdDerived: boolean;
  /** Op-specific leading fields (camp: { includeAmbiguous }; eval: {}). */
  headerFields: Record<string, unknown>;
  /** Op-specific ambiguous/off-limits accounting in the dryRun body. */
  dryRunSegmentFields: (seg: LeadSegmentation) => Record<string, unknown>;
  /** Op-specific ambiguous_excluded accounting in the live summary. */
  ambiguousExcluded: (seg: LeadSegmentation) => number;
}

async function runOutreachBlast(
  cfg: OutreachBlastConfig,
  opts: { dryRun?: boolean; subject?: string; only?: string[] },
): Promise<OutreachRunResult> {
  const dryRun = opts.dryRun === true;
  const subject = opts.subject?.trim() || cfg.defaultSubject;
  const normalized = normalizeOnly(opts.only);
  if (!normalized.ok) return normalized.result;
  const only = normalized.set;

  let seg: LeadSegmentation;
  try {
    seg = await fetchLeadOutreachRecipients(cfg.includeAmbiguous, {
      includeDdDerived: cfg.includeDdDerived,
    });
  } catch (err) {
    console.error(`[${cfg.logTag}] CRM query failed:`, err);
    return {
      status: 500,
      body: { error: err instanceof Error ? err.message : "CRM query failed" },
    };
  }

  // Apply the optional allow-list (vetted warm list / retry-failed-only). It
  // only ever NARROWS the DD-clean set — an off-limits email in `only` still
  // never mails, because it was excluded before this filter.
  const recipients = only
    ? seg.recipients.filter((r) => only.has(r.email.toLowerCase()))
    : seg.recipients;

  if (dryRun) {
    return {
      status: 200,
      body: {
        ok: true,
        dryRun: true,
        ...cfg.headerFields,
        scanned: seg.scanned,
        eligible_unique: seg.recipients.length,
        to_send: recipients.length,
        eligible_rows: seg.eligible,
        ...cfg.dryRunSegmentFields(seg),
        // Always surfaced: the two numbers an operator must eyeball before a
        // live send are "who asked us to stop" and "how many DD families".
        suppressed_opted_out: seg.suppressed,
        dd_derived: seg.ddDerived,
        dd_derived_mailed: seg.ddIncluded,
        test_excluded: seg.test,
        subject,
        recipients: recipients.map((r) => ({ name: r.name, email: r.email })),
      },
    };
  }

  if (!process.env.RESEND_API_KEY) {
    return { status: 500, body: { error: "RESEND_API_KEY missing" } };
  }

  const out = await sendBlast(recipients, subject, cfg.render);

  const summary = {
    ok: true,
    ...cfg.headerFields,
    to_send: recipients.length,
    sent: out.sent,
    failed: out.failed,
    off_limits_excluded: seg.offLimits,
    suppressed_opted_out: seg.suppressed,
    dd_derived_mailed: seg.ddIncluded,
    ambiguous_excluded: cfg.ambiguousExcluded(seg),
    subject,
    sent_emails: out.sentEmails,
    failed_emails: out.failedEmails,
  };
  console.log(
    `[${cfg.logTag}]`,
    JSON.stringify({ to_send: recipients.length, sent: out.sent, failed: out.failed }),
    out.errors.length ? `errors: ${out.errors.slice(0, 5).join("; ")}` : "",
  );
  return { status: 200, body: summary };
}

export async function runEvalReengagement(
  opts: EvalReengagementOpts = {},
): Promise<OutreachRunResult> {
  return runOutreachBlast(
    {
      logTag: "eval-reengagement",
      defaultSubject: EVAL_REENGAGEMENT_SUBJECT,
      render: (r) => {
        const input = {
          parentFirst: r.parentFirst,
          newsletterUrl: NEWSLETTER_URL,
        };
        return {
          html: evalReengagementHtml(input),
          text: evalReengagementText(input),
        };
      },
      includeAmbiguous: false, // ambiguous is always held for re-engagement
      includeDdDerived: false, // never — this op has no operator override
      headerFields: {},
      dryRunSegmentFields: (seg) => ({
        off_limits: seg.offLimits,
        ambiguous: seg.ambiguous,
      }),
      ambiguousExcluded: (seg) => seg.ambiguous,
    },
    opts,
  );
}

export async function runCampOutreach(
  opts: CampOutreachOpts = {},
): Promise<OutreachRunResult> {
  const includeAmbiguous = opts.includeAmbiguous === true;
  const includeDdDerived = opts.includeDdDerived === true;
  return runOutreachBlast(
    {
      logTag: "camp-outreach",
      defaultSubject: CAMP_OUTREACH_SUBJECT,
      render: (r) => {
        const input = {
          parentFirst: r.parentFirst,
          campUrl: CAMP_URL,
          consentUrl: consentUrl(r.email, "subscribe"),
          optOutUrl: consentUrl(r.email, "optout"),
        };
        return { html: campOutreachHtml(input), text: campOutreachText(input) };
      },
      includeAmbiguous,
      includeDdDerived,
      headerFields: { includeAmbiguous, includeDdDerived },
      dryRunSegmentFields: (seg) => ({
        ambiguous_rows: seg.ambiguous,
        ambiguous_mailed: includeAmbiguous,
        off_limits: seg.offLimits,
      }),
      ambiguousExcluded: (seg) => (includeAmbiguous ? 0 : seg.ambiguous),
    },
    opts,
  );
}
