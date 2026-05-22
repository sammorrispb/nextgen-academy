import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { classifyLead, isMailable, type LeadRow } from "@/lib/lead-segmentation";
import {
  evalReengagementHtml,
  evalReengagementText,
  EVAL_REENGAGEMENT_SUBJECT,
} from "@/lib/email/eval-reengagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
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
}> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_DB_ID;
  if (!notionKey || !db) {
    throw new Error("NOTION_API_KEY or NOTION_DB_ID not configured");
  }

  const byEmail = new Map<string, Recipient>();
  let scanned = 0;
  let eligible = 0;
  let offLimits = 0;
  let ambiguous = 0;
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
      const row: LeadRow = {
        parentEmail: email,
        source: readSelect(p["Source"]),
        crEventsAttended: p["CR Events Attended"]?.number ?? null,
        crEventHistory: readText(p["CR Event History"]),
        lastCrEvent: readText(p["Last CR Event"]),
        season: readSelect(p["Season"]),
        notes: readText(p["Notes"]),
      };
      if (!isMailable(email)) continue;

      const { bucket } = classifyLead(row);
      if (bucket === "off_limits") offLimits++;
      else if (bucket === "ambiguous") ambiguous++;
      else {
        eligible++;
        const key = email.toLowerCase();
        if (!byEmail.has(key)) {
          const name = readText(p["Parent Name"]);
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
  };
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.NGA_ADMIN_SECRET || secret !== process.env.NGA_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { subject?: string; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const dryRun =
    req.nextUrl.searchParams.get("dryRun") === "1" || body.dryRun === true;
  const subject = body.subject?.trim() || EVAL_REENGAGEMENT_SUBJECT;

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

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      scanned: seg.scanned,
      eligible_unique: seg.recipients.length,
      eligible_rows: seg.eligible,
      off_limits: seg.offLimits,
      ambiguous: seg.ambiguous,
      subject,
      recipients: seg.recipients.map((r) => ({ name: r.name, email: r.email })),
    });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const r of seg.recipients) {
    const input = { parentFirst: r.parentFirst, newsletterUrl: NEWSLETTER_URL };
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: r.email,
      bcc: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject,
      html: evalReengagementHtml(input),
      text: evalReengagementText(input),
    });
    if (error) {
      failed++;
      errors.push(`${r.email}: ${error.message ?? String(error)}`);
    } else {
      sent++;
    }
  }

  const summary = {
    ok: true,
    eligible_unique: seg.recipients.length,
    sent,
    failed,
    off_limits_excluded: seg.offLimits,
    ambiguous_excluded: seg.ambiguous,
    subject,
    ...(errors.length ? { errors: errors.slice(0, 10) } : {}),
  };
  console.log("[eval-reengagement]", JSON.stringify({ ...summary, errors: undefined }));
  return NextResponse.json(summary);
}
