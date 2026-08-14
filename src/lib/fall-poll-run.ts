import { Resend } from "resend";
import { fetchActiveFamilies } from "@/lib/notion-fall-poll";
import { fetchUnsubscribedEmails } from "@/lib/notion-newsletter";
import { signFallPollToken } from "@/lib/fall-poll-token";
import {
  fallPollInviteHtml,
  fallPollInviteSubject,
  fallPollInviteText,
  type FallPollLinks,
} from "@/lib/email/fall-poll-invite";

/**
 * Engine for the Fall 2026 season announcement + one-click poll blast.
 *
 * AUDIENCE = active families only (fetchActiveFamilies: any CRM row with
 * Status = Active, folded per family, minus any family with a Quarantine tick
 * anywhere) — MINUS newsletter opt-outs (fetchUnsubscribedEmails; an
 * unsubscribe is a person saying stop, not a per-sender preference, so it
 * suppresses this send too and a failed opt-out query fails the whole run
 * rather than risking a short suppression list).
 *
 * `linksOnly` returns each family's three signed poll links without sending —
 * the manual-send escape hatch (e.g. mailing from a personal account) that
 * keeps token minting server-side where the secret lives.
 *
 * NO SENT-FLAG COLUMN. A repeated live run re-sends. Always dryRun first, and
 * use `only` to retry just the addresses that failed.
 */

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL || "https://nextgenpbacademy.com";

/** ~3.3/sec, under Resend's 5/sec cap. */
const THROTTLE_MS = 300;

export interface FallPollRecipient {
  email: string;
  name: string;
  firstName: string;
}

export type RunFallPollResult =
  | {
      ok: true;
      dryRun: true;
      subject: string;
      scanned_rows: number;
      families_total: number;
      quarantined_excluded: number;
      unsubscribed_excluded: number;
      to_send: number;
      recipients: { name: string; email: string }[];
      links?: ({ email: string } & FallPollLinks)[];
    }
  | {
      ok: true;
      dryRun: false;
      subject: string;
      to_send: number;
      sent: number;
      failed: number;
      quarantined_excluded: number;
      unsubscribed_excluded: number;
      sent_emails: string[];
      failed_emails: string[];
    }
  | {
      ok: false;
      reason:
        | "invalid_only"
        | "audience_query_failed"
        | "resend_unconfigured"
        | "signing_unconfigured";
      error?: string;
    };

export interface RunFallPollOpts {
  dryRun?: boolean;
  /** Implies dryRun: return signed links per recipient, send nothing. */
  linksOnly?: boolean;
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

function linksFor(email: string): FallPollLinks | null {
  const tokens = {
    in: signFallPollToken(email, "in"),
    interested: signFallPollToken(email, "interested"),
    out: signFallPollToken(email, "out"),
  };
  if (!tokens.in || !tokens.interested || !tokens.out) return null;
  const url = (action: string, token: string) =>
    `${SITE_ORIGIN}/api/fall-poll?action=${action}&token=${encodeURIComponent(token)}`;
  return {
    inUrl: url("in", tokens.in),
    interestedUrl: url("interested", tokens.interested),
    outUrl: url("out", tokens.out),
  };
}

export async function runFallPollOutreach(
  opts: RunFallPollOpts = {},
): Promise<RunFallPollResult> {
  // Fail loud on a malformed allow-list: silently dropping it would widen the
  // send from "these three retries" to every active family.
  let only: Set<string> | null = null;
  if (Array.isArray(opts.only) && opts.only.length > 0) {
    if (opts.only.some((e) => typeof e !== "string")) {
      return { ok: false, reason: "invalid_only" };
    }
    only = new Set(opts.only.map((e) => e.trim().toLowerCase()));
  }

  const subject = opts.subject?.trim() || fallPollInviteSubject();

  let audience: Awaited<ReturnType<typeof fetchActiveFamilies>>;
  let unsubscribed: Set<string>;
  try {
    audience = await fetchActiveFamilies();
    unsubscribed = await fetchUnsubscribedEmails();
  } catch (err) {
    console.error("[fall-poll] audience query failed:", err);
    return {
      ok: false,
      reason: "audience_query_failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let unsubscribedExcluded = 0;
  const eligible: FallPollRecipient[] = [];
  for (const fam of audience.families) {
    if (unsubscribed.has(fam.email.toLowerCase())) {
      unsubscribedExcluded++;
      continue;
    }
    eligible.push({
      email: fam.email,
      name: fam.parentName,
      firstName: firstNameOf(fam.parentName),
    });
  }

  const recipients = only
    ? eligible.filter((r) => only.has(r.email.toLowerCase()))
    : eligible;

  const counts = {
    scanned_rows: audience.scannedRows,
    families_total: audience.familiesTotal,
    quarantined_excluded: audience.quarantinedExcluded,
    unsubscribed_excluded: unsubscribedExcluded,
  };

  if (opts.linksOnly === true) {
    const links: ({ email: string } & FallPollLinks)[] = [];
    for (const r of recipients) {
      const l = linksFor(r.email);
      if (!l) return { ok: false, reason: "signing_unconfigured" };
      links.push({ email: r.email, ...l });
    }
    return {
      ok: true,
      dryRun: true,
      subject,
      ...counts,
      to_send: recipients.length,
      recipients: recipients.map((r) => ({ name: r.name, email: r.email })),
      links,
    };
  }

  if (opts.dryRun === true) {
    return {
      ok: true,
      dryRun: true,
      subject,
      ...counts,
      to_send: recipients.length,
      recipients: recipients.map((r) => ({ name: r.name, email: r.email })),
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
    const input = { firstName: r.firstName, links: linksFor(r.email) };
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: r.email,
      bcc: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject,
      html: fallPollInviteHtml(input),
      text: fallPollInviteText(input),
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

  await sendAdminQaCopy({ subject, sent, failed, total: recipients.length });

  console.log(
    "[fall-poll]",
    JSON.stringify({ to_send: recipients.length, sent, failed }),
    errors.length ? `errors: ${errors.slice(0, 5).join("; ")}` : "",
  );

  return {
    ok: true,
    dryRun: false,
    subject,
    to_send: recipients.length,
    sent,
    failed,
    quarantined_excluded: counts.quarantined_excluded,
    unsubscribed_excluded: counts.unsubscribed_excluded,
    sent_emails: sentEmails,
    failed_emails: failedEmails,
  };
}

/** Counts-only receipt — no recipient addresses (fall-survey precedent). */
async function sendAdminQaCopy(summary: {
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
      subject: `[Fall poll sent · ${summary.sent} of ${summary.total}] ${summary.subject}`,
      text: [
        `Subject: ${summary.subject}`,
        `Attempted: ${summary.total}`,
        `Sent: ${summary.sent}`,
        `Failed: ${summary.failed}`,
        "",
        "Recipient addresses are in the run's JSON response, not here.",
      ].join("\n"),
    });
  } catch (err) {
    console.error("[fall-poll] admin QA copy failed:", err);
  }
}
