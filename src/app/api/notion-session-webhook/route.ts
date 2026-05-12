import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { site } from "@/data/site";
import { inferCity } from "@/lib/venue-lookup";

/**
 * Triggered by a Notion automation when a new session row is created in the
 * NGA Sessions Schedule DB. Queries the NGA Waitlist DB for parents whose
 * `Preferred Area` matches the new session's inferred city (or "Anywhere in
 * MoCo"), and sends a one-off Resend notification to each.
 *
 * Auth: requires `NOTION_WEBHOOK_SECRET` env, passed by the Notion automation
 * in the `x-nga-webhook-secret` header.
 *
 * Body shape (the minimum the handler needs — the Notion automation can be
 * configured to send the full page payload but only these fields are read):
 *   {
 *     "sessionTitle": "Walter Johnson HS — Early",
 *     "sessionDate": "2026-06-14",
 *     "sessionLocation": "Walter Johnson HS Tennis Courts",
 *     "sessionLevel": "Orange" | null
 *   }
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

interface WebhookBody {
  sessionTitle?: string;
  sessionDate?: string;
  sessionLocation?: string;
  sessionLevel?: string | null;
}

interface WaitlistRow {
  pageId: string;
  parentName: string;
  email: string | null;
  preferredArea: string;
  status: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readPlainText(prop: any): string {
  if (!prop) return "";
  const arr = prop.rich_text ?? prop.title ?? [];
  if (!Array.isArray(arr)) return "";
  return arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readSelect(prop: any): string | null {
  return prop?.select?.name ?? null;
}

async function queryMatchingWaitlist(area: string): Promise<WaitlistRow[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const waitlistDb = process.env.NOTION_WAITLIST_DB_ID;
  if (!notionKey || !waitlistDb) return [];

  const res = await fetch(`${NOTION_API}/databases/${waitlistDb}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: "Status", select: { equals: "Active" } },
          {
            or: [
              { property: "Preferred Area", select: { equals: area } },
              {
                property: "Preferred Area",
                select: { equals: "Anywhere in MoCo" },
              },
            ],
          },
        ],
      },
      page_size: 100,
    }),
  });
  if (!res.ok) {
    console.error(
      "[session-webhook] waitlist query failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  return data.results.map((page) => ({
    pageId: page.id as string,
    parentName: readPlainText(page.properties["Parent Name"]),
    email: page.properties["Parent Email"]?.email ?? null,
    preferredArea: readSelect(page.properties["Preferred Area"]) ?? "",
    status: readSelect(page.properties["Status"]) ?? "Active",
  }));
}

function notifyHtml(parentName: string, body: Required<WebhookBody>): string {
  const dateLabel = new Date(`${body.sessionDate}T12:00:00Z`).toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  );
  return `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 8px;">
    A new session just opened near you.
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${parentName},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    You're on the Next Gen waitlist and a session just posted that matches your area. Here are the details:
  </p>
  <div style="background: #0C1F47; padding: 20px; border-radius: 8px; margin: 24px 0;">
    <p style="margin: 0 0 6px; font-size: 13px; color: #7A88B8; text-transform: uppercase; letter-spacing: 1px;">${body.sessionLevel ? `${body.sessionLevel} Ball` : "All levels"} &middot; ${dateLabel}</p>
    <p style="margin: 0; font-size: 17px; font-weight: 700; color: #EEF2FF;">${body.sessionTitle}</p>
    <p style="margin: 4px 0 0; font-size: 14px; color: #7A88B8;">${body.sessionLocation}</p>
  </div>
  <p style="font-size: 15px; line-height: 1.6;">
    Spots are first-come, first-served and each pickleball court is capped at 4 players.
  </p>
  <p style="margin: 28px 0;">
    <a href="https://nextgenpbacademy.com/schedule" style="display: inline-block; padding: 14px 28px; background: #00D4FF; color: #05132B; font-weight: 700; text-decoration: none; border-radius: 999px;">
      Register now &rarr;
    </a>
  </p>
  <p style="font-size: 13px; line-height: 1.6; color: #7A88B8;">
    Want off the waitlist? Reply to this email and we'll remove you.
  </p>
  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1A3060;">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply or text Sam at <a href="tel:${site.phone}" style="color: #00D4FF;">${site.phone}</a>.<br/>
      <strong style="color: #AADC00;">— Coach Sam &amp; Coach Amine</strong>
    </p>
  </div>
</div>`;
}

export async function POST(request: NextRequest) {
  const expected = process.env.NOTION_WEBHOOK_SECRET;
  if (!expected) {
    console.error("[session-webhook] NOTION_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const provided = request.headers.get("x-nga-webhook-secret");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !body.sessionTitle ||
    !body.sessionDate ||
    !body.sessionLocation
  ) {
    return NextResponse.json(
      {
        error:
          "Required fields: sessionTitle, sessionDate, sessionLocation (sessionLevel optional)",
      },
      { status: 400 },
    );
  }

  const city = inferCity(body.sessionLocation) ?? "Anywhere in MoCo";
  const matches = await queryMatchingWaitlist(city);

  if (matches.length === 0) {
    return NextResponse.json({ success: true, area: city, notified: 0 });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("[session-webhook] RESEND_API_KEY missing");
    return NextResponse.json(
      { error: "Email service unavailable" },
      { status: 500 },
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const filled: Required<WebhookBody> = {
    sessionTitle: body.sessionTitle,
    sessionDate: body.sessionDate,
    sessionLocation: body.sessionLocation,
    sessionLevel: body.sessionLevel ?? null,
  };

  let sent = 0;
  let failed = 0;
  for (const row of matches) {
    if (!row.email) continue;
    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: row.email,
        replyTo: site.email,
        subject: `New ${filled.sessionLevel ? `${filled.sessionLevel} Ball ` : ""}session in ${city} — register now`,
        html: notifyHtml(row.parentName, filled),
      });
      if (result.error) {
        failed++;
        console.error("[session-webhook] resend error for", row.email, result.error);
      } else {
        sent++;
      }
    } catch (err) {
      failed++;
      console.error("[session-webhook] send failed for", row.email, err);
    }
  }

  return NextResponse.json({
    success: true,
    area: city,
    matched: matches.length,
    sent,
    failed,
  });
}
