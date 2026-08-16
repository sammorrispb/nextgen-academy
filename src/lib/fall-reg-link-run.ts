import { Resend } from "resend";
import { playerCrmDbId } from "./notion-utils";
import {
  FALL_POLL_PROPERTY,
  primaryParentEmail,
} from "./notion-fall-poll";
import {
  fallRegistrationLinkHtml,
  fallRegistrationLinkSubject,
  fallRegistrationLinkText,
} from "./email/fall-registration-link";

/**
 * Backfill engine for the fall registration link.
 *
 * Send-on-confirm (in the fall-poll POST route) covers everyone who answers
 * from now on; this covers the families who already answered IN before that
 * shipped. It is a ONE-SHOT tool, not a scheduled job — there is deliberately
 * no cron, and no sent-flag column, so a second live run WILL re-mail. Always
 * dryRun first, then go live with an explicit `only` list.
 *
 * Two safety properties the spec pins:
 *  - Rows are folded per PRIMARY parent email, so the multi-row families (one
 *    parent, several kid rows — including stale "DELETE —" rows) get one email,
 *    not one per row.
 *  - The IN filter is applied BOTH in the Notion query and again client-side.
 *    The redundancy is the point: if the server-side filter ever drifts or is
 *    dropped, the client-side check still stops an OUT family being mailed a
 *    registration link.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";

/** ~3.3/sec, under Resend's 5/sec cap. */
const THROTTLE_MS = 300;

function notionHeaders(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function firstNameOf(parentName: string): string {
  const trimmed = (parentName ?? "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0]!;
}

export interface FallRegRecipient {
  email: string;
  firstName: string;
}

export type RunFallRegLinkResult =
  | {
      ok: true;
      dryRun: true;
      subject: string;
      scanned_rows: number;
      to_send: number;
      recipients: string[];
    }
  | {
      ok: true;
      dryRun: false;
      subject: string;
      to_send: number;
      sent: number;
      failed: number;
      sent_emails: string[];
      failed_emails: string[];
    }
  | {
      ok: false;
      reason: "audience_query_failed" | "resend_unconfigured" | "notion_unconfigured";
      error?: string;
    };

export interface RunFallRegLinkOpts {
  dryRun?: boolean;
  /** Restrict the send to these addresses (compared as primary parent email). */
  only?: string[];
}

/**
 * Send one registration link. Shared with the send-on-confirm path so the
 * template, from-address and reply-to can never drift between the two.
 * Returns false on any failure — callers decide whether that is fatal.
 */
export async function sendFallRegistrationLink(
  email: string,
  firstName: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[fall-reg-link] RESEND_API_KEY missing");
    return false;
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: email,
      subject: fallRegistrationLinkSubject(),
      html: fallRegistrationLinkHtml({ firstName }),
      text: fallRegistrationLinkText({ firstName }),
    });
    if (error) {
      console.error(`[fall-reg-link] send to ${email} failed:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[fall-reg-link] send to ${email} threw:`, err);
    return false;
  }
}

export async function runFallRegLinkOutreach(
  opts: RunFallRegLinkOpts,
): Promise<RunFallRegLinkResult> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { ok: false, reason: "notion_unconfigured" };
  if (!opts.dryRun && !process.env.RESEND_API_KEY) {
    return { ok: false, reason: "resend_unconfigured" };
  }

  const db = playerCrmDbId();
  const onlySet = opts.only?.length
    ? new Set(opts.only.map((e) => primaryParentEmail(e)))
    : null;

  const byEmail = new Map<string, FallRegRecipient>();
  let scannedRows = 0;
  let cursor: string | undefined;

  do {
    const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        filter: { property: FALL_POLL_PROPERTY, select: { equals: "In" } },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[fall-reg-link] query failed (${res.status}): ${text}`);
      return { ok: false, reason: "audience_query_failed", error: text };
    }
    const data = await res.json();
    for (const page of data.results ?? []) {
      scannedRows++;
      const props = page.properties ?? {};

      // Belt AND braces — see the module header.
      if (props[FALL_POLL_PROPERTY]?.select?.name !== "In") continue;

      const cell =
        props["Parent Email"]?.email ??
        (props["Parent Email"]?.rich_text ?? [])
          .map((t: { plain_text?: string }) => t.plain_text ?? "")
          .join("");
      const email = primaryParentEmail(cell ?? "");
      if (!email) continue;
      if (onlySet && !onlySet.has(email)) continue;
      // Not the dedup — the Map key already folds the family. This makes the
      // FIRST row's parent name win rather than the last, so the greeting is
      // stable regardless of row order.
      if (byEmail.has(email)) continue;

      const parentName = (props["Parent Name"]?.rich_text ?? [])
        .map((t: { plain_text?: string }) => t.plain_text ?? "")
        .join("");
      byEmail.set(email, { email, firstName: firstNameOf(parentName) });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  const recipients = [...byEmail.values()];
  const subject = fallRegistrationLinkSubject();

  if (opts.dryRun) {
    return {
      ok: true,
      dryRun: true,
      subject,
      scanned_rows: scannedRows,
      to_send: recipients.length,
      recipients: recipients.map((r) => r.email),
    };
  }

  const sentEmails: string[] = [];
  const failedEmails: string[] = [];
  for (const [i, r] of recipients.entries()) {
    const ok = await sendFallRegistrationLink(r.email, r.firstName);
    if (ok) sentEmails.push(r.email);
    else failedEmails.push(r.email);
    if (i < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS));
    }
  }

  return {
    ok: true,
    dryRun: false,
    subject,
    to_send: recipients.length,
    sent: sentEmails.length,
    failed: failedEmails.length,
    sent_emails: sentEmails,
    failed_emails: failedEmails,
  };
}
