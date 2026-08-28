import { Resend } from "resend";
import { primaryParentEmail } from "./notion-fall-poll";
import {
  fallVenueChangeHtml,
  fallVenueChangeSubject,
  fallVenueChangeText,
} from "./email/fall-venue-change";

/**
 * One-shot notifier for the Fall 2026 venue move (Wood MS → Walter Johnson HS,
 * 2026-08-27), sent to the families who had ALREADY PAID when the venue changed.
 *
 * Audience is the fall registrations DB, not the Player CRM: the people owed
 * this email are exactly the people holding a paid seat in THIS season. A
 * quarantine/DD-provenance pass would be wrong here for the same reason it is
 * wrong on the poll — this is service mail to a current customer about a thing
 * they bought, not marketing.
 *
 * Three properties the spec pins:
 *  - Only `Status = "Confirmed"` rows are mailed. The filter is applied BOTH in
 *    the Notion query and again client-side; the redundancy is deliberate, so a
 *    drifted server-side filter can't mail a refunded or cancelled family a
 *    "see you on the court" note.
 *  - Rows fold per parent email, so a two-kid family gets ONE email.
 *  - NO CHILD FIELDS are read. The row carries child first name, birth year and
 *    allergies; this engine reads parent name and parent email only, so the
 *    child-PII egress surface is unchanged by this feature.
 *
 * There is no sent-flag column, so a second live run RE-MAILS everyone. Always
 * dryRun first, and use `only` to retry a partial run.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
/** BCC, never CC — a parent must never see another family's address. */
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";

/** Only a paid, still-active seat earns this email. */
const CONFIRMED = "Confirmed";

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

function richText(prop: unknown): string {
  const rt = (prop as { rich_text?: { plain_text?: string }[] } | undefined)
    ?.rich_text;
  return (rt ?? []).map((t) => t.plain_text ?? "").join("");
}

export interface FallVenueChangeRecipient {
  email: string;
  firstName: string;
}

export type RunFallVenueChangeResult =
  | {
      ok: true;
      dryRun: true;
      subject: string;
      scanned_rows: number;
      confirmed_rows: number;
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
      reason:
        | "audience_query_failed"
        | "resend_unconfigured"
        | "notion_unconfigured";
      error?: string;
    };

export interface RunFallVenueChangeOpts {
  dryRun?: boolean;
  /** Restrict the send to these parent addresses (normalized before compare). */
  only?: string[];
}

export async function sendFallVenueChange(
  email: string,
  firstName: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[fall-venue-change] RESEND_API_KEY missing");
    return false;
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: email,
      bcc: ADMIN_EMAIL,
      subject: fallVenueChangeSubject(),
      html: fallVenueChangeHtml({ firstName }),
      text: fallVenueChangeText({ firstName }),
    });
    if (error) {
      console.error(`[fall-venue-change] send to ${email} failed:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[fall-venue-change] send to ${email} threw:`, err);
    return false;
  }
}

export async function runFallVenueChangeNotice(
  opts: RunFallVenueChangeOpts,
): Promise<RunFallVenueChangeResult> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_FALL_REGS_DB_ID;
  if (!notionKey || !db) return { ok: false, reason: "notion_unconfigured" };
  if (!opts.dryRun && !process.env.RESEND_API_KEY) {
    return { ok: false, reason: "resend_unconfigured" };
  }

  const onlySet = opts.only?.length
    ? new Set(opts.only.map((e) => primaryParentEmail(e)))
    : null;

  const byEmail = new Map<string, FallVenueChangeRecipient>();
  let scannedRows = 0;
  let confirmedRows = 0;
  let cursor: string | undefined;

  do {
    const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        filter: { property: "Status", select: { equals: CONFIRMED } },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[fall-venue-change] audience query failed (${res.status}): ${text}`,
      );
      return { ok: false, reason: "audience_query_failed", error: text };
    }
    const data = (await res.json()) as {
      results?: { properties?: Record<string, unknown> }[];
      has_more?: boolean;
      next_cursor?: string;
    };

    for (const page of data.results ?? []) {
      scannedRows++;
      const props = page.properties ?? {};

      // Belt AND braces — see the module header. A refunded or cancelled seat
      // must never receive a "your player's spot is held" email.
      const status = (props["Status"] as { select?: { name?: string } })?.select
        ?.name;
      if (status !== CONFIRMED) continue;
      confirmedRows++;

      const emailCell =
        (props["Parent Email"] as { email?: string })?.email ??
        richText(props["Parent Email"]);
      const email = primaryParentEmail(emailCell ?? "");
      if (!email) continue;
      if (onlySet && !onlySet.has(email)) continue;
      // Not the dedup — the Map key already folds the family. This makes the
      // FIRST row's parent name win rather than the last, so a two-kid family
      // gets a stable greeting regardless of row order.
      if (byEmail.has(email)) continue;

      byEmail.set(email, {
        email,
        firstName: firstNameOf(richText(props["Parent Name"])),
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  const recipients = [...byEmail.values()];
  const subject = fallVenueChangeSubject();

  if (opts.dryRun) {
    return {
      ok: true,
      dryRun: true,
      subject,
      scanned_rows: scannedRows,
      confirmed_rows: confirmedRows,
      to_send: recipients.length,
      recipients: recipients.map((r) => r.email),
    };
  }

  const sentEmails: string[] = [];
  const failedEmails: string[] = [];
  for (const [i, r] of recipients.entries()) {
    const ok = await sendFallVenueChange(r.email, r.firstName);
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
