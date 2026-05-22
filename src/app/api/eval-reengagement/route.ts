import { NextRequest, NextResponse } from "next/server";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Lead CRM database id — a non-secret constant, mirroring /api/lead (which
// hardcodes the same id rather than reading an env var). Env override allowed.
const LEAD_DB_ID =
  process.env.NOTION_DB_ID || "1e5e34c258384c6cb5f3e846543ecfc7";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const NEWSLETTER_URL = "https://nextgenpbacademy.com/newsletter";

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

interface Recipient {
  email: string;
  parentFirst: string;
  name: string;
}

/** Query the lead CRM and return the deduped, DD-clean (eligible) recipients. */
async function fetchEligibleRecipients(): Promise<{
  recipients: Recipient[];
  scanned: number;
  eligible: number;
  offLimits: number;
  ambiguous: number;
  test: number;
}> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = LEAD_DB_ID;
  if (!notionKey) {
    throw new Error("NOTION_API_KEY not configured");
  }

  const byEmail = new Map<string, Recipient>();
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
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
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
      };

      const { bucket } = classifyLead(row);
      if (bucket === "off_limits") offLimits++;
      else if (bucket === "ambiguous") ambiguous++;
      else {
        eligible++;
        const key = email.toLowerCase();
        if (!byEmail.has(key)) {
          byEmail.set(key, {
            email,
            name,
            parentFirst: name.split(/\s+/)[0] || "there",
          });
        }
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

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.NGA_ADMIN_SECRET || secret !== process.env.NGA_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { subject?: string; dryRun?: boolean; only?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const dryRun =
    req.nextUrl.searchParams.get("dryRun") === "1" || body.dryRun === true;
  const subject = body.subject?.trim() || EVAL_REENGAGEMENT_SUBJECT;
  // Optional allow-list: restrict the send to these emails (e.g. retrying only
  // the addresses that failed a prior run, so already-sent rows aren't redone).
  const only =
    Array.isArray(body.only) && body.only.length
      ? new Set(body.only.map((e) => e.trim().toLowerCase()))
      : null;

  let seg;
  try {
    seg = await fetchEligibleRecipients();
  } catch (err) {
    console.error("[eval-reengagement] CRM query failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "CRM query failed" },
      { status: 500 },
    );
  }

  // Apply the optional allow-list (used to retry only previously-failed sends).
  const recipients = only
    ? seg.recipients.filter((r) => only.has(r.email.toLowerCase()))
    : seg.recipients;

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      scanned: seg.scanned,
      eligible_unique: seg.recipients.length,
      to_send: recipients.length,
      eligible_rows: seg.eligible,
      off_limits: seg.offLimits,
      ambiguous: seg.ambiguous,
      test_excluded: seg.test,
      subject,
      recipients: recipients.map((r) => ({ name: r.name, email: r.email })),
    });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const sentEmails: string[] = [];
  const failedEmails: string[] = [];
  // Throttle to stay under Resend's 5 req/sec limit (~3.3/sec here).
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (i > 0) await new Promise((res) => setTimeout(res, 300));
    const input = { parentFirst: r.parentFirst, newsletterUrl: NEWSLETTER_URL };
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: r.email,
      replyTo: REPLY_TO,
      subject,
      html: evalReengagementHtml(input),
      text: evalReengagementText(input),
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

  const summary = {
    ok: true,
    to_send: recipients.length,
    sent,
    failed,
    off_limits_excluded: seg.offLimits,
    ambiguous_excluded: seg.ambiguous,
    subject,
    sent_emails: sentEmails,
    failed_emails: failedEmails,
  };
  console.log(
    "[eval-reengagement]",
    JSON.stringify({ to_send: recipients.length, sent, failed }),
    errors.length ? `errors: ${errors.slice(0, 5).join("; ")}` : "",
  );
  return NextResponse.json(summary);
}
