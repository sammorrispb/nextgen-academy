/**
 * Engine for the Fall 2026 season-feedback broadcast — the send that drives
 * both audiences to /fall.
 *
 * Route/lib split like camp-followup-run.ts so the whole thing unit-tests
 * offline; the ?secret-gated route and the /coach/ops action call this same
 * core, so an agent and the editor fire identical behavior.
 *
 * AUDIENCE = the union of two lists, deduped on lowercased email:
 *   1. NGA newsletter subscribers (Status = Active) — a real subscription, so
 *      these carry a signed one-click unsubscribe link.
 *   2. The eligible bucket of the lead CRM, via fetchLeadOutreachRecipients.
 *      That reuse is deliberate: classifyLead is where the load-bearing rule
 *      lives, so quarantined opt-outs, DD/CourtReserve-derived rows, and
 *      unverified ("ambiguous") sources are excluded before this file ever sees
 *      them. These recipients are NOT on a list, so they get no unsubscribe
 *      link — the same posture as eval-reengagement.
 *
 * NO SENT-FLAG COLUMN. A repeated live run re-sends. Always dryRun first, and
 * use `only` to retry just the addresses that failed.
 */

import { Resend } from "resend";
import { fetchActiveSubscribers } from "@/lib/notion-newsletter";
import {
  fetchLeadOutreachRecipients,
  type LeadSegmentation,
} from "@/lib/lead-outreach-run";
import { signUnsubscribeToken } from "@/lib/newsletter-token";
import {
  fallSurveyHtml,
  fallSurveySubject,
  fallSurveyText,
  type FallSurveyVariant,
} from "@/lib/email/fall-survey";
import { appendUtm } from "@/lib/email/utm";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL || "https://nextgenpbacademy.com";

/** ~3.3/sec, under Resend's 5/sec cap. */
const THROTTLE_MS = 300;

const VARIANTS: readonly FallSurveyVariant[] = ["nga", "ld"] as const;

export interface FallSurveyRecipient {
  email: string;
  firstName: string;
  name: string;
  /** Newsletter subscribers get an unsubscribe link; lead-CRM rows don't. */
  isSubscriber: boolean;
}

export type RunFallSurveyResult =
  | {
      ok: true;
      dryRun: true;
      variant: FallSurveyVariant;
      subject: string;
      scanned: number;
      subscribers: number;
      eligible_unique: number;
      to_send: number;
      off_limits_excluded: number;
      ambiguous_excluded: number;
      recipients: { name: string; email: string; isSubscriber: boolean }[];
    }
  | {
      ok: true;
      dryRun: false;
      variant: FallSurveyVariant;
      subject: string;
      to_send: number;
      sent: number;
      failed: number;
      off_limits_excluded: number;
      ambiguous_excluded: number;
      sent_emails: string[];
      failed_emails: string[];
    }
  | {
      ok: false;
      reason:
        | "invalid_variant"
        | "invalid_only"
        | "audience_query_failed"
        | "resend_unconfigured";
      error?: string;
    };

export interface RunFallSurveyOpts {
  variant?: FallSurveyVariant;
  dryRun?: boolean;
  subject?: string;
  /** Narrowing allow-list — e.g. retrying only the addresses a prior run failed. */
  only?: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

/**
 * Build the deduped recipient set. A person on both lists is mailed once, and
 * being on the newsletter wins — they keep their unsubscribe link.
 */
async function buildAudience(): Promise<{
  recipients: FallSurveyRecipient[];
  segmentation: LeadSegmentation;
  subscribers: number;
}> {
  const byEmail = new Map<string, FallSurveyRecipient>();

  // fetchActiveSubscribers never throws — a Notion miss returns [] and we still
  // reach the lead CRM.
  const subs = await fetchActiveSubscribers();
  for (const sub of subs) {
    const key = sub.email.trim().toLowerCase();
    if (!key) continue;
    byEmail.set(key, {
      email: sub.email.trim(),
      name: sub.parentName,
      firstName: firstNameOf(sub.parentName),
      isSubscriber: true,
    });
  }

  const segmentation = await fetchLeadOutreachRecipients(false);
  for (const lead of segmentation.recipients) {
    const key = lead.email.trim().toLowerCase();
    if (!key || byEmail.has(key)) continue;
    byEmail.set(key, {
      email: lead.email.trim(),
      name: lead.name,
      firstName: lead.parentFirst,
      isSubscriber: false,
    });
  }

  return {
    recipients: [...byEmail.values()],
    segmentation,
    subscribers: byEmail.size ? subs.length : 0,
  };
}

function renderFor(
  recipient: FallSurveyRecipient,
  variant: FallSurveyVariant,
): { html: string; text: string } {
  const fallUrl = appendUtm(
    `${SITE_ORIGIN}/fall`,
    `fall-survey-${variant}`,
    "fall-2026-survey",
  );

  // Only a real subscriber row can be unsubscribed — offering the link to a
  // lead-CRM address would promise a list membership that doesn't exist.
  let unsubscribeUrl: string | null = null;
  if (recipient.isSubscriber) {
    const token = signUnsubscribeToken(recipient.email);
    unsubscribeUrl = token
      ? `${SITE_ORIGIN}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
      : null;
  }

  const input = {
    firstName: recipient.firstName,
    variant,
    fallUrl,
    unsubscribeUrl,
  };
  return { html: fallSurveyHtml(input), text: fallSurveyText(input) };
}

export async function runFallSurvey(
  opts: RunFallSurveyOpts = {},
): Promise<RunFallSurveyResult> {
  const variant = opts.variant ?? "nga";
  if (!VARIANTS.includes(variant)) {
    return { ok: false, reason: "invalid_variant" };
  }

  // Fail loud on a malformed allow-list: silently dropping it would widen the
  // send from "these three retries" to the full eligible set.
  let only: Set<string> | null = null;
  if (Array.isArray(opts.only) && opts.only.length > 0) {
    if (opts.only.some((e) => typeof e !== "string")) {
      return { ok: false, reason: "invalid_only" };
    }
    only = new Set(opts.only.map((e) => e.trim().toLowerCase()));
  }

  const subject = opts.subject?.trim() || fallSurveySubject(variant);

  let audience: Awaited<ReturnType<typeof buildAudience>>;
  try {
    audience = await buildAudience();
  } catch (err) {
    console.error("[fall-survey] audience query failed:", err);
    return {
      ok: false,
      reason: "audience_query_failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const { segmentation } = audience;
  const recipients = only
    ? audience.recipients.filter((r) => only.has(r.email.toLowerCase()))
    : audience.recipients;

  if (opts.dryRun === true) {
    return {
      ok: true,
      dryRun: true,
      variant,
      subject,
      scanned: segmentation.scanned,
      subscribers: audience.subscribers,
      eligible_unique: audience.recipients.length,
      to_send: recipients.length,
      off_limits_excluded: segmentation.offLimits,
      ambiguous_excluded: segmentation.ambiguous,
      recipients: recipients.map((r) => ({
        name: r.name,
        email: r.email,
        isSubscriber: r.isSubscriber,
      })),
    };
  }

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: "resend_unconfigured" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;
  const sentEmails: string[] = [];
  const failedEmails: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (i > 0) await sleep(THROTTLE_MS);
    const { html, text } = renderFor(r, variant);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: r.email,
      bcc: ADMIN_EMAIL,
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

  await sendAdminQaCopy({ variant, subject, sent, failed, total: recipients.length });

  console.log(
    "[fall-survey]",
    JSON.stringify({ variant, to_send: recipients.length, sent, failed }),
    errors.length ? `errors: ${errors.slice(0, 5).join("; ")}` : "",
  );

  return {
    ok: true,
    dryRun: false,
    variant,
    subject,
    to_send: recipients.length,
    sent,
    failed,
    off_limits_excluded: segmentation.offLimits,
    ambiguous_excluded: segmentation.ambiguous,
    sent_emails: sentEmails,
    failed_emails: failedEmails,
  };
}

/**
 * Counts-only receipt so Sam can see a run landed without a copy of every
 * recipient's address sitting in his inbox. Deliberately carries no addresses —
 * the run's JSON response is where the per-recipient detail lives.
 */
async function sendAdminQaCopy(summary: {
  variant: FallSurveyVariant;
  subject: string;
  sent: number;
  failed: number;
  total: number;
}): Promise<void> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[Fall survey sent · ${summary.sent} of ${summary.total}] ${summary.subject}`,
      text: [
        `Variant: ${summary.variant}`,
        `Subject: ${summary.subject}`,
        `Attempted: ${summary.total}`,
        `Sent: ${summary.sent}`,
        `Failed: ${summary.failed}`,
        "",
        "Recipient addresses are in the run's JSON response, not here.",
      ].join("\n"),
    });
  } catch (err) {
    console.error("[fall-survey] admin QA copy failed:", err);
  }
}
