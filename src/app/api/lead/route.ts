import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { validateLeadForm } from "@/lib/validate-lead";
import type { LeadFormData } from "@/lib/validate-lead";
import { site } from "@/data/site";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_DB_ID = "1e5e34c258384c6cb5f3e846543ecfc7";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limiter (resets on deploy)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ─── Notion Functions ────────────────────────────

function parseContact(contact: string): { email: string | null; phone: string | null } {
  if (EMAIL_RE.test(contact.trim())) {
    return { email: contact.trim(), phone: null };
  }
  return { email: null, phone: contact.trim() };
}

async function findNotionPlayer(contact: string): Promise<string | null> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return null;

  const { email, phone } = parseContact(contact);
  const filter = email
    ? { property: "Parent Email", email: { equals: email } }
    : { property: "Parent Phone", phone_number: { equals: phone } };

  const res = await fetch(`${NOTION_API}/databases/${NOTION_DB_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({ filter, page_size: 1 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.length > 0 ? data.results[0].id : null;
}

function formatAttribution(body: LeadFormData): string {
  const lines: string[] = [];
  if (body.utm_source) lines.push(`utm_source: ${body.utm_source}`);
  if (body.utm_medium) lines.push(`utm_medium: ${body.utm_medium}`);
  if (body.utm_campaign) lines.push(`utm_campaign: ${body.utm_campaign}`);
  if (body.utm_content) lines.push(`utm_content: ${body.utm_content}`);
  if (body.utm_term) lines.push(`utm_term: ${body.utm_term}`);
  if (body.referrer) lines.push(`referrer: ${body.referrer}`);
  if (body.landing_page) lines.push(`landing: ${body.landing_page}`);
  return lines.join(" | ");
}

function attributedSource(body: LeadFormData): string {
  // Map common ad sources to clean Notion select values.
  const src = body.utm_source?.toLowerCase();
  if (src === "facebook" || src === "fb") return "Facebook Ad";
  if (src === "instagram" || src === "ig") return "Instagram Ad";
  if (src === "google") return "Google Ad";
  if (body.utm_source) return `Ad: ${body.utm_source}`;
  return "Website Lead Form";
}

// Pick the cohort tag a fresh lead should be slotted into. New leads in May
// are signing up for Summer; spring slots are already filled or sub-piloting.
function currentSeasonLabel(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11
  if (m >= 0 && m <= 1) return `Winter ${y}`;
  if (m === 11) return `Winter ${y + 1}`;
  if (m >= 2 && m <= 4) return `Spring ${y}`;
  if (m >= 5 && m <= 7) return `Summer ${y}`;
  return `Fall ${y}`;
}

async function createNotionPlayer(
  body: LeadFormData,
): Promise<{ id?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { error: "NOTION_API_KEY not configured" };

  const { email, phone } = parseContact(body.contact);
  const attribution = formatAttribution(body);
  const notesContent = attribution
    ? `Lead form submission. Child age: ${body.childAge}. Attribution: ${attribution}`
    : `Lead form submission. Child age: ${body.childAge}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    "Player Name": {
      title: [{ text: { content: `Child of ${body.parentName}` } }],
    },
    Age: { number: Number(body.childAge) },
    "Parent Name": {
      rich_text: [{ text: { content: body.parentName } }],
    },
    Level: { select: { name: "Eval Needed" } },
    Status: { select: { name: "Lead" } },
    Source: { select: { name: attributedSource(body) } },
    Season: { select: { name: currentSeasonLabel() } },
    Audience: { select: { name: Number(body.childAge) >= 17 ? "Adult" : "Youth" } },
    Notes: {
      rich_text: [{ text: { content: notesContent } }],
    },
    "Next Action": {
      rich_text: [{ text: { content: "Reach out within 24 hours" } }],
    },
  };

  if (email) properties["Parent Email"] = { email };
  if (phone) properties["Parent Phone"] = { phone_number: phone };
  if (body.location) properties["Location"] = { select: { name: body.location } };

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_DB_ID },
      properties,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Notion create failed (${res.status}): ${text}` };
  }
  const data = await res.json();
  return { id: data.id };
}

// ─── Main Handler ────────────────────────────────

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return NextResponse.json(
      { error: "Email service is not configured. Please contact us directly." },
      { status: 500 },
    );
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  let body: LeadFormData & { visitor_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validateLeadForm(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
  }

  // ─── 1. Create Notion Player (dedup) ─────────
  let notionStatus = "skipped";
  if (process.env.NOTION_API_KEY) {
    try {
      const existingId = await findNotionPlayer(body.contact);
      if (existingId) {
        notionStatus = "already exists";
      } else {
        const result = await createNotionPlayer(body);
        notionStatus = result.id ? "created" : `failed: ${result.error}`;
        if (result.error) console.error("Notion create failed:", result.error);
      }
    } catch (err) {
      notionStatus = "error";
      console.error("Notion error:", err);
    }
  }

  const { email, phone } = parseContact(body.contact);
  const contactDisplay = email || phone || body.contact;

  // ─── 2. Send Emails ──────────────────────────
  const adminHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 24px;">
    New Website Lead
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8; width: 140px;">Parent Name</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${body.parentName}</td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Contact</td>
      <td style="padding: 10px 8px;"><a href="${email ? `mailto:${email}` : `tel:${phone}`}" style="color: #00D4FF;">${contactDisplay}</a></td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Child's Age</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${body.childAge} years old</td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Area (MoCo)</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${body.location || "Not provided — ask in reply"}</td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Notion CRM</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${notionStatus}</td>
    </tr>
    ${
      formatAttribution(body)
        ? `<tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8; vertical-align: top;">Attribution</td>
      <td style="padding: 10px 8px; color: #EEF2FF; font-size: 12px; word-break: break-all;">${formatAttribution(body)}</td>
    </tr>`
        : ""
    }
  </table>
  <div style="margin-top: 24px; padding: 16px; background: #0C1F47; border-radius: 8px; border-left: 4px solid #AADC00;">
    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #AADC00;">ACTION NEEDED</p>
    <p style="margin: 8px 0 0; font-size: 13px; color: #EEF2FF;">
      Reach out to ${body.parentName} within 24 hours to discuss placement for their ${body.childAge}-year-old.
    </p>
  </div>
</div>`;

  // Only send parent confirmation if we have an email
  const shouldEmailParent = !!email;

  const firstName = body.parentName.trim().split(/\s+/)[0] || body.parentName;
  const hasArea = !!body.location?.trim();
  const areaLine = hasArea
    ? `<li style="margin-bottom: 10px;">2\u20133 times that would work for a quick evaluation over the next week or two (weekday evenings and weekends both work)</li>`
    : `<li style="margin-bottom: 10px;">2\u20133 times that would work for a quick evaluation over the next week or two (weekday evenings and weekends both work)</li>
      <li style="margin-bottom: 10px;"><strong>Which part of Montgomery County you\u2019re in</strong> (e.g. Bethesda, Rockville, Silver Spring, Gaithersburg) so I can match you with the closest session</li>`;
  const areaAck = hasArea
    ? `<p style="font-size: 15px; line-height: 1.6;">I see you\u2019re in <strong style="color: #AADC00;">${body.location}</strong> \u2014 we run sessions in that area and nearby.</p>`
    : "";

  const parentHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 8px;">
    Let\u2019s Get Your Free Evaluation Scheduled
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${firstName},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for reaching out about Next Gen Pickleball Academy! I\u2019d love to get your ${body.childAge}-year-old on the court for a free evaluation so we can find the right Red / Orange / Green / Yellow group.
  </p>
  ${areaAck}
  <div style="background: #0C1F47; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #AADC00;">
    <p style="margin: 0 0 12px; font-family: Montserrat, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #AADC00; text-transform: uppercase; letter-spacing: 1px;">Reply to this email with</p>
    <ol style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.6; color: #EEF2FF;">
      ${areaLine}
    </ol>
    <p style="margin: 14px 0 0; font-size: 13px; color: #7A88B8;">
      I\u2019ll confirm a time and send venue details within 24 hours.
    </p>
  </div>
  <p style="font-size: 15px; line-height: 1.6;">
    In the meantime, take a look at our <a href="https://nextgenpbacademy.com/schedule" style="color: #00D4FF; font-weight: 600;">upcoming sessions</a> if you want a preview of what we run.
  </p>
  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1A3060;">
    <p style="font-size: 14px; line-height: 1.6;">
      Prefer to talk? Text or call me at <a href="tel:${site.phone}" style="color: #00D4FF;">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court!<br/>
      <strong style="color: #AADC00;">\u2014 Coach Sam &amp; Coach Amine</strong><br/>
      <span style="color: #7A88B8;">Next Gen Pickleball Academy</span><br/>
      <a href="https://nextgenpbacademy.com" style="color: #00D4FF;">nextgenpbacademy.com</a>
    </p>
  </div>
</div>`;

  try {
    const resend = getResend();

    const emailPromises = [
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        cc: CC_EMAIL,
        subject: `New Lead — ${body.parentName} (child age ${body.childAge})`,
        html: adminHtml,
      }),
    ];

    if (shouldEmailParent && email) {
      emailPromises.push(
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          replyTo: site.email,
          subject: "Let’s schedule your free evaluation — Next Gen Pickleball Academy",
          html: parentHtml,
        }),
      );
    }

    const results = await Promise.all(emailPromises);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      console.error("Resend error:", results.find((r) => r.error)?.error);
      return NextResponse.json(
        { error: "Failed to send confirmation. Please contact us directly." },
        { status: 500 },
      );
    }

    // Ingest to Open Brain master CRM (fire-and-forget).
    // OB accepts either email or phone as the dedup key; phone-only leads
    // now flow through instead of being dropped.
    if (email || phone) {
      void ingestToOpenBrain({
        email: email ?? undefined,
        name: body.parentName,
        phone: phone ?? undefined,
        business: "nga",
        source: "nga_lead_form",
        interest: `Age ${body.childAge}`,
        utm: {
          source: body.utm_source,
          medium: body.utm_medium,
          campaign: body.utm_campaign,
        },
        metadata: {
          child_age: Number(body.childAge),
          location: body.location || null,
          notion_status: notionStatus,
          is_parent: true,
          phone_only: !email && !!phone,
          utm_content: body.utm_content ?? null,
          utm_term: body.utm_term ?? null,
          referrer: body.referrer ?? null,
          landing_page: body.landing_page ?? null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email send failed:", err);
    return NextResponse.json(
      { error: "Failed to send confirmation. Please contact us directly." },
      { status: 500 },
    );
  }
}
