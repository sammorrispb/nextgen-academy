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
import {
  classifyLead,
  isMailable,
  isTestOrInternal,
  type LeadRow,
} from "@/lib/lead-segmentation";
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

// Lead CRM database id — a non-secret constant, mirroring /api/lead (which
// hardcodes the same id rather than reading an env var). Env override allowed.
const LEAD_DB_ID =
  process.env.NOTION_DB_ID || "1e5e34c258384c6cb5f3e846543ecfc7";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const NEWSLETTER_URL = "https://nextgenpbacademy.com/newsletter";
// UTM-stamped /camp link so the push is attributable in /cmo attribute.
const CAMP_URL =
  "https://nextgenpbacademy.com/camp?utm_source=email&utm_medium=parent-outreach&utm_campaign=summer-camps-2026";

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
  eligible: number;
  offLimits: number;
  ambiguous: number;
  test: number;
}

/**
 * Query the lead CRM and return deduped, DD-clean recipients. By default only
 * the "eligible" bucket (clean own-marketing source) is mailed. When
 * `includeAmbiguous` is true, the "ambiguous" bucket (own leads whose Source is
 * blank/Evaluation/Referral — i.e. unverified marketing source, but NOT
 * DD-derived) is ALSO mailed. Off-limits (DD-derived) is never mailed either way.
 */
export async function fetchLeadOutreachRecipients(
  includeAmbiguous: boolean,
): Promise<LeadSegmentation> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = LEAD_DB_ID;
  if (!notionKey) {
    throw new Error("NOTION_API_KEY not configured");
  }

  const byEmail = new Map<string, OutreachRecipient>();
  let scanned = 0;
  let eligible = 0;
  let offLimits = 0;
  let ambiguous = 0;
  let test = 0;
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

      // Strip QA / internal / Sam's-own rows before anything else.
      if (isTestOrInternal(name, email)) {
        test++;
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

      // DD-derived rows are excluded here — the no-DD-derived-sales rule lives
      // in classifyLead. Defense in depth: even if an `only` allow-list passes a
      // DD email, it never makes it past this gate.
      const { bucket } = classifyLead(row);
      if (bucket === "off_limits") {
        offLimits++;
        continue;
      }
      if (bucket === "ambiguous") {
        ambiguous++;
        if (!includeAmbiguous) continue;
      } else {
        eligible++;
      }
      // Reached here = eligible, or (ambiguous && includeAmbiguous). Mail it.
      const key = email.toLowerCase();
      if (!byEmail.has(key)) {
        byEmail.set(key, {
          email,
          name,
          parentFirst: name.split(/\s+/)[0] || "there",
        });
      }
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return {
    recipients: [...byEmail.values()],
    scanned,
    eligible,
    offLimits,
    ambiguous,
    test,
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
    seg = await fetchLeadOutreachRecipients(cfg.includeAmbiguous);
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
  return runOutreachBlast(
    {
      logTag: "camp-outreach",
      defaultSubject: CAMP_OUTREACH_SUBJECT,
      render: (r) => {
        const input = { parentFirst: r.parentFirst, campUrl: CAMP_URL };
        return { html: campOutreachHtml(input), text: campOutreachText(input) };
      },
      includeAmbiguous,
      headerFields: { includeAmbiguous },
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
