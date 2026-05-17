import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { c, s } from "@/lib/email/brand";
import {
  validateSchoolsLeadForm,
  ORG_TYPE_LABELS,
  FREQUENCY_LABELS,
  STUDENT_BUCKET_LABELS,
  AGE_RANGE_LABELS,
  ORG_TYPE_NOTION,
  FREQUENCY_NOTION,
  STUDENT_BUCKET_NOTION,
  AGE_RANGE_NOTION,
  type SchoolsLeadFormData,
  type OrgType,
  type Frequency,
  type StudentCountBucket,
  type AgeRange,
} from "@/lib/validate-schools";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import { site } from "@/data/site";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const NOTION_API = "https://api.notion.com/v1";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

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

function attributedSource(body: SchoolsLeadFormData): string {
  const src = body.utm_source?.toLowerCase();
  if (src === "facebook" || src === "fb") return "Facebook Ad";
  if (src === "instagram" || src === "ig") return "Instagram Ad";
  if (src === "google") return "Google Ad";
  if (body.utm_source) return `Ad: ${body.utm_source}`;
  return "Schools Inquiry Form";
}

function formatAttribution(body: SchoolsLeadFormData): string {
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

async function findExistingOrgLead(
  dbId: string,
  email: string,
): Promise<string | null> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return null;

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      filter: { property: "Contact Email", email: { equals: email } },
      page_size: 1,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.length > 0 ? data.results[0].id : null;
}

async function createOrgLead(
  dbId: string,
  body: SchoolsLeadFormData,
): Promise<{ id?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { error: "NOTION_API_KEY not configured" };

  const orgTypeNotion = ORG_TYPE_NOTION[body.orgType as OrgType] ?? "Other";
  const frequencyNotion =
    FREQUENCY_NOTION[body.frequency as Frequency] ?? "Other";
  const studentBucketNotion =
    STUDENT_BUCKET_NOTION[body.studentCount as StudentCountBucket] ?? "";
  const ageRangeNotion =
    AGE_RANGE_NOTION[body.ageRange as AgeRange] ?? "";

  const attribution = formatAttribution(body);
  const notesParts: string[] = [];
  if (body.notes?.trim()) notesParts.push(body.notes.trim());
  if (attribution) notesParts.push(`Attribution: ${attribution}`);
  const notesContent = notesParts.join("\n\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Organization: { title: [{ text: { content: body.orgName } }] },
    "Contact Name": {
      rich_text: [{ text: { content: body.contactName } }],
    },
    "Contact Email": { email: body.email },
    "Org Type": { select: { name: orgTypeNotion } },
    "Group Size": { select: { name: studentBucketNotion } },
    "Age Range": { select: { name: ageRangeNotion } },
    Format: { select: { name: frequencyNotion } },
    Status: { select: { name: "Lead" } },
    Source: { select: { name: attributedSource(body) } },
    "Next Action": {
      rich_text: [
        { text: { content: "Send quote within 1 business day" } },
      ],
    },
  };

  if (body.phone?.trim()) {
    properties["Contact Phone"] = { phone_number: body.phone.trim() };
  }
  if (body.role?.trim()) {
    properties["Role"] = {
      rich_text: [{ text: { content: body.role.trim() } }],
    };
  }
  if (body.preferredDates?.trim()) {
    properties["Preferred Dates"] = {
      rich_text: [{ text: { content: body.preferredDates.trim() } }],
    };
  }
  if (body.location?.trim()) {
    properties["Location"] = {
      rich_text: [{ text: { content: body.location.trim() } }],
    };
  }
  if (notesContent) {
    properties["Notes"] = {
      rich_text: [{ text: { content: notesContent.slice(0, 2000) } }],
    };
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: dbId },
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

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return NextResponse.json(
      {
        error: "Email service is not configured. Please contact us directly.",
      },
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

  let body: SchoolsLeadFormData & { visitor_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validateSchoolsLeadForm(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Validation failed", errors },
      { status: 400 },
    );
  }

  // ─── Notion CRM (institutional DB) ─────────
  let notionStatus = "skipped";
  const dbId = process.env.NOTION_INSTITUTIONAL_DB_ID;
  if (process.env.NOTION_API_KEY && dbId) {
    try {
      const existingId = await findExistingOrgLead(dbId, body.email);
      if (existingId) {
        notionStatus = "already exists";
      } else {
        const result = await createOrgLead(dbId, body);
        notionStatus = result.id ? "created" : `failed: ${result.error}`;
        if (result.error) console.error("Notion create failed:", result.error);
      }
    } catch (err) {
      notionStatus = "error";
      console.error("Notion error:", err);
    }
  } else if (!dbId) {
    notionStatus = "skipped (no NOTION_INSTITUTIONAL_DB_ID)";
  }

  const orgTypeLabel = ORG_TYPE_LABELS[body.orgType as OrgType] ?? "Other";
  const frequencyLabel =
    FREQUENCY_LABELS[body.frequency as Frequency] ?? "Other";
  const studentBucketLabel =
    STUDENT_BUCKET_LABELS[body.studentCount as StudentCountBucket] ?? "";
  const ageRangeLabel = AGE_RANGE_LABELS[body.ageRange as AgeRange] ?? "";

  // ─── Emails ────────────────────────────────
  const adminHtml = `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 24px;">
    New Schools/Camp Inquiry
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="${s.tableRow}">
      <td style="padding: 10px 8px; color: ${c.muted}; width: 160px;">Organization</td>
      <td style="${s.tableValue}"><strong>${body.orgName}</strong></td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Contact</td>
      <td style="${s.tableValue}">
        ${body.contactName}${body.role ? ` — ${body.role}` : ""}<br/>
        <a href="mailto:${body.email}" style="${s.link}">${body.email}</a>
        ${body.phone ? ` · <a href="tel:${body.phone}" style="${s.link}">${body.phone}</a>` : ""}
      </td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Org Type</td>
      <td style="${s.tableValue}">${orgTypeLabel}</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Group Size</td>
      <td style="${s.tableValue}">${studentBucketLabel}</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Ages</td>
      <td style="${s.tableValue}">${ageRangeLabel}</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Format</td>
      <td style="${s.tableValue}">${frequencyLabel}</td>
    </tr>
    ${
      body.preferredDates
        ? `<tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Preferred Dates</td>
      <td style="${s.tableValue}">${body.preferredDates}</td>
    </tr>`
        : ""
    }
    ${
      body.location
        ? `<tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Location</td>
      <td style="${s.tableValue}">${body.location}</td>
    </tr>`
        : ""
    }
    ${
      body.notes
        ? `<tr style="${s.tableRow}">
      <td style="${s.tableLabel} vertical-align: top;">Notes</td>
      <td style="${s.tableValue} white-space: pre-wrap;">${body.notes}</td>
    </tr>`
        : ""
    }
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Notion CRM</td>
      <td style="${s.tableValue}">${notionStatus}</td>
    </tr>
    ${
      formatAttribution(body)
        ? `<tr style="${s.tableRow}">
      <td style="${s.tableLabel} vertical-align: top;">Attribution</td>
      <td style="${s.tableValue} font-size: 12px; word-break: break-all;">${formatAttribution(body)}</td>
    </tr>`
        : ""
    }
  </table>
  <div style="${s.actionCallout}">
    <p style="${s.actionLabel}">ACTION NEEDED</p>
    <p style="margin: 8px 0 0; font-size: 13px; color: ${c.text};">
      Send a quote to ${body.contactName} within 1 business day.
    </p>
  </div>
</div>`;

  const orgHtml = `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 8px;">
    Thanks — we got your inquiry!
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${body.contactName},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for reaching out about pickleball at <strong>${body.orgName}</strong>. We&rsquo;ll review the details
    and send a tailored quote within 1 business day.
  </p>
  <div style="${s.card}">
    <p style="margin: 0 0 4px; font-size: 13px; color: ${c.muted}; text-transform: uppercase; letter-spacing: 1px;">What&rsquo;s next</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
      You&rsquo;ll get a proposal with a quote, recommended format, and a sample
      lesson plan. We can also issue a Certificate of Insurance naming your
      organization on request.
    </p>
  </div>
  <div style="${s.footer}">
    <p style="font-size: 14px; line-height: 1.6;">
      Need to talk sooner? Reply to this email or text Sam at <a href="tel:${site.phone}" style="${s.link}">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      <strong style="color: ${c.accentLime};">— Coach Sam &amp; Coach Amine</strong><br/>
      <span style="color: ${c.muted};">Next Gen Pickleball Academy</span><br/>
      <a href="https://nextgenpbacademy.com" style="${s.link}">nextgenpbacademy.com</a>
    </p>
  </div>
</div>`;

  try {
    const resend = getResend();

    const results = await Promise.all([
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        cc: CC_EMAIL,
        subject: `New Schools/Camp Inquiry — ${body.orgName}`,
        html: adminHtml,
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: body.email,
        replyTo: site.email,
        subject:
          "We got your inquiry — Next Gen Pickleball Academy",
        html: orgHtml,
      }),
    ]);

    const hasError = results.some((r) => r.error);
    if (hasError) {
      console.error("Resend error:", results.find((r) => r.error)?.error);
      return NextResponse.json(
        {
          error: "Failed to send confirmation. Please contact us directly.",
        },
        { status: 500 },
      );
    }

    // AWAIT — Vercel tears down lambdas before fire-and-forget Promises
    // complete. Helper logs failures + has a 5s timeout, so this is safe.
    await ingestToOpenBrain({
      email: body.email,
      name: body.contactName,
      phone: body.phone || undefined,
      business: "nga",
      source: "nga_schools_form",
      interest: `${orgTypeLabel} — ${frequencyLabel}`,
      utm: {
        source: body.utm_source,
        medium: body.utm_medium,
        campaign: body.utm_campaign,
      },
      metadata: {
        org_name: body.orgName,
        org_type: body.orgType,
        role: body.role || null,
        student_count: body.studentCount,
        age_range: body.ageRange,
        frequency: body.frequency,
        preferred_dates: body.preferredDates || null,
        location: body.location || null,
        notion_status: notionStatus,
        is_institutional: true,
        utm_content: body.utm_content ?? null,
        utm_term: body.utm_term ?? null,
        referrer: body.referrer ?? null,
        landing_page: body.landing_page ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email send failed:", err);
    return NextResponse.json(
      { error: "Failed to send confirmation. Please contact us directly." },
      { status: 500 },
    );
  }
}
