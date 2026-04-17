import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { validateLeadForm } from "@/lib/validate-lead";
import type { LeadFormData } from "@/lib/validate-lead";
import { site } from "@/data/site";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import { sendFunnelEvent } from "@/lib/funnelServer";
import { getRefSource } from "@/lib/urls";

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
    Season: { select: { name: "Spring 2026" } },
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

  let body: LeadFormData;
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
      <td style="padding: 10px 8px; color: #7A88B8;">Preferred Location</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${body.location || "No preference"}</td>
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

  const parentHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 8px;">
    Thanks for Reaching Out!
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${body.parentName},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for your interest in Next Gen Pickleball Academy! We\u2019ll be in touch within 24 hours to help find the right group for your child.
  </p>
  <div style="background: #0C1F47; padding: 20px; border-radius: 8px; margin: 24px 0;">
    <p style="margin: 0 0 4px; font-size: 13px; color: #7A88B8; text-transform: uppercase; letter-spacing: 1px;">In the meantime</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
      Check out our <a href="https://nextgenpbacademy.com/schedule" style="color: #00D4FF; font-weight: 600;">upcoming sessions</a> to see what\u2019s available.
    </p>
  </div>
  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1A3060;">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply to this email or text Sam at <a href="tel:${site.phone}" style="color: #00D4FF;">${site.phone}</a>.
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
          subject: "Thanks for Reaching Out — Next Gen Pickleball Academy",
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

    // Ingest to Open Brain master CRM (fire-and-forget)
    // Only include email if we actually have one — OB requires a valid email
    // for dedup. If the parent only provided a phone, we skip OB ingest for
    // now (they'll be picked up by the Notion → OB backfill script later).
    if (email) {
      void ingestToOpenBrain({
        email,
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
          utm_content: body.utm_content ?? null,
          utm_term: body.utm_term ?? null,
          referrer: body.referrer ?? null,
          landing_page: body.landing_page ?? null,
        },
      });
    }

    // Unified funnel: server-side lead_submitted event to the Hub.
    const marketingRef = getRefSource(
      body.landing_page ? new URL(body.landing_page).pathname : null,
    );
    void sendFunnelEvent({
      eventType: "lead_submitted",
      email,
      marketingRef,
      properties: {
        interest: "free_evaluation",
        child_age: Number(body.childAge),
        location: body.location || null,
        utm_source: body.utm_source ?? null,
        utm_medium: body.utm_medium ?? null,
        utm_campaign: body.utm_campaign ?? null,
      },
    });

    // Forward to Hub CRM (inbound_leads) so Sam can track Meta ad conversions.
    try {
      const [hubFirstName, ...hubRest] = body.parentName.trim().split(/\s+/);
      const hubLastName = hubRest.join(" ") || null;
      const hubRes = await fetch(
        `${process.env.HUB_SUPABASE_URL}/rest/v1/inbound_leads`,
        {
          method: "POST",
          headers: {
            apikey: process.env.HUB_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.HUB_SERVICE_ROLE_KEY!}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            email: email ?? null,
            phone: phone ?? null,
            first_name: hubFirstName || null,
            last_name: hubLastName,
            source: "nga_meta",
            source_ref: body.utm_source ?? null,
            intent: "free_eval",
            intent_confidence: 1.0,
            raw_text: `NGA free eval — child age ${body.childAge}, location ${body.location || "no preference"}`,
            extracted_data: {
              child_age: Number(body.childAge),
              location: body.location || null,
              utm_source: body.utm_source ?? null,
              utm_medium: body.utm_medium ?? null,
              utm_campaign: body.utm_campaign ?? null,
              utm_content: body.utm_content ?? null,
              utm_term: body.utm_term ?? null,
              referrer: body.referrer ?? null,
              landing_page: body.landing_page ?? null,
            },
            status: "new",
          }),
        },
      );
      if (!hubRes.ok) {
        console.warn(
          "[nga-lead] Hub inbound_leads insert failed:",
          hubRes.status,
          await hubRes.text(),
        );
      }
    } catch (e: unknown) {
      console.warn(
        "[nga-lead] Hub CRM forward error:",
        e instanceof Error ? e.message : e,
      );
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
