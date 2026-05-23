import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  CONTACT_INTEREST_OPTIONS,
  interestRequiresChildAge,
  validateContactForm,
} from "@/lib/validate-contact";
import type { ContactFormData, ContactInterest } from "@/lib/validate-contact";
import { normalizeKids } from "@/lib/validate-lead";
import type { Kid } from "@/lib/validate-lead";
import { site } from "@/data/site";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import { c, s } from "@/lib/email/brand";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_DB_ID = "1e5e34c258384c6cb5f3e846543ecfc7";

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

const INTEREST_LABEL: Record<ContactInterest, string> = Object.fromEntries(
  CONTACT_INTEREST_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ContactInterest, string>;

const PROGRAM_INTERESTS: ReadonlySet<ContactInterest> = new Set<ContactInterest>([
  "free-evaluation",
  "drop-in",
  "private-lessons",
  "yellow-ball",
]);

function escapeHtml(s: string): string {
  return s.replace(
    /[<>&]/g,
    (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[ch] || ch,
  );
}

function formatAttribution(body: ContactFormData): string {
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

function attributedSource(body: ContactFormData): string {
  const src = body.utm_source?.toLowerCase();
  if (src === "facebook" || src === "fb") return "Facebook Ad";
  if (src === "instagram" || src === "ig") return "Instagram Ad";
  if (src === "google") return "Google Ad";
  if (body.utm_source) return `Ad: ${body.utm_source}`;
  return "Website Contact Form";
}

function currentSeasonLabel(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (m >= 0 && m <= 1) return `Winter ${y}`;
  if (m === 11) return `Winter ${y + 1}`;
  if (m >= 2 && m <= 4) return `Spring ${y}`;
  if (m >= 5 && m <= 7) return `Summer ${y}`;
  return `Fall ${y}`;
}

async function findNotionPlayer(email: string): Promise<string | null> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return null;

  const res = await fetch(`${NOTION_API}/databases/${NOTION_DB_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      filter: { property: "Parent Email", email: { equals: email } },
      page_size: 1,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.length > 0 ? data.results[0].id : null;
}

async function createNotionRow(
  body: ContactFormData,
  kid: Kid | null,
  siblings: Kid[],
): Promise<{ id?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { error: "NOTION_API_KEY not configured" };

  const interest = body.interest as ContactInterest;
  const isProgramInterest = PROGRAM_INTERESTS.has(interest);
  const attribution = formatAttribution(body);
  const message = body.message?.trim();
  const trimmedKidName = kid?.name.trim() ?? "";

  const noteParts = [`Interest: ${INTEREST_LABEL[interest] ?? interest}`];
  if (kid) noteParts.push(`Child age: ${kid.age}`);
  if (siblings.length > 0) {
    noteParts.push(
      `Siblings on same submission: ${siblings
        .map((s) => `${s.name.trim() || "unnamed"} (${s.age})`)
        .join(", ")}`,
    );
  }
  if (message) noteParts.push(`Message: "${message}"`);
  if (attribution) noteParts.push(`Attribution: ${attribution}`);
  const notesContent = noteParts.join(". ");

  const titleText = isProgramInterest
    ? trimmedKidName || `Child of ${body.name}`
    : `${body.name} (${INTEREST_LABEL[interest] ?? interest})`;

  const notionStatus = isProgramInterest ? "Lead" : "Contact Inquiry";
  const notionLevel =
    interest === "free-evaluation" ? "Eval Needed" : "Contact Inquiry";
  const nextAction = isProgramInterest
    ? "Reach out within 24 hours"
    : "Respond within 1 business day";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    "Player Name": {
      title: [{ text: { content: titleText } }],
    },
    "Parent Name": {
      rich_text: [{ text: { content: body.name } }],
    },
    Level: { select: { name: notionLevel } },
    Status: { select: { name: notionStatus } },
    Source: { select: { name: attributedSource(body) } },
    Season: { select: { name: currentSeasonLabel() } },
    Notes: {
      rich_text: [{ text: { content: notesContent } }],
    },
    "Next Action": {
      rich_text: [{ text: { content: nextAction } }],
    },
    "Parent Email": { email: body.email },
  };

  if (kid) {
    properties.Age = { number: kid.age };
    properties.Audience = { select: { name: kid.age >= 17 ? "Adult" : "Youth" } };
  }

  if (body.phone && body.phone.trim()) {
    properties["Parent Phone"] = { phone_number: body.phone.trim() };
  }

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

  let body: ContactFormData;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validateContactForm(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Validation failed", errors },
      { status: 400 },
    );
  }

  // Strip child age if the chosen interest doesn't need it — defense in depth
  // against a client that left a stale value in the payload after toggling.
  if (!interestRequiresChildAge(body.interest)) {
    body.childAge = "";
    body.kids = [];
  }

  const interest = body.interest as ContactInterest;
  const interestLabel = INTEREST_LABEL[interest] ?? interest;
  const isProgramInterest = PROGRAM_INTERESTS.has(interest);
  // Only program interests carry kids; partnership / general inquiries write
  // a single inquiry row with no Age and Player Name = "<parent> (<interest>)".
  const kids = isProgramInterest ? normalizeKids(body) : [];

  let notionStatus = "skipped";
  if (process.env.NOTION_API_KEY) {
    try {
      const existingId = await findNotionPlayer(body.email);
      if (existingId) {
        notionStatus = "already exists";
      } else if (kids.length === 0) {
        // Non-program interest (or program interest without a kid — shouldn't
        // happen post-validation, but defensive): one inquiry row, no Age.
        const result = await createNotionRow(body, null, []);
        notionStatus = result.id ? "created" : `failed: ${result.error}`;
        if (result.error) console.error("Notion create failed:", result.error);
      } else {
        const results = await Promise.all(
          kids.map((kid, i) =>
            createNotionRow(
              body,
              kid,
              kids.filter((_, j) => j !== i),
            ),
          ),
        );
        const created = results.filter((r) => r.id).length;
        const failed = results.filter((r) => r.error);
        if (failed.length > 0) {
          notionStatus = `created ${created}/${kids.length} (failed: ${failed[0].error})`;
          console.error("Notion create failed:", failed[0].error);
        } else {
          notionStatus =
            kids.length === 1 ? "created" : `created ${created} rows`;
        }
      }
    } catch (err) {
      notionStatus = "error";
      console.error("Notion error:", err);
    }
  }

  const childAgeRow =
    kids.length > 0
      ? `<tr style="${s.tableRow}">
      <td style="${s.tableLabel} vertical-align: top;">${kids.length === 1 ? "Child" : `Kids (${kids.length})`}</td>
      <td style="${s.tableValue}">${kids
        .map((kid) => {
          const trimmed = kid.name.trim();
          const safeName = trimmed
            ? escapeHtml(trimmed)
            : "(name not provided)";
          return `${safeName} — ${kid.age} years old`;
        })
        .join("<br/>")}</td>
    </tr>`
      : "";

  const phoneRow = body.phone?.trim()
    ? `<tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Phone</td>
      <td style="padding: 10px 8px;"><a href="tel:${escapeHtml(body.phone.trim())}" style="${s.link}">${escapeHtml(body.phone.trim())}</a></td>
    </tr>`
    : "";

  const messageRow = body.message?.trim()
    ? `<tr style="${s.tableRow}">
      <td style="${s.tableLabel} vertical-align: top;">Message</td>
      <td style="${s.tableValue} white-space: pre-wrap;">${escapeHtml(body.message.trim())}</td>
    </tr>`
    : "";

  const attribution = formatAttribution(body);
  const attributionRow = attribution
    ? `<tr style="${s.tableRow}">
      <td style="${s.tableLabel} vertical-align: top;">Attribution</td>
      <td style="${s.tableValue} font-size: 12px; word-break: break-all;">${escapeHtml(attribution)}</td>
    </tr>`
    : "";

  const adminHtml = `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 24px;">
    New Contact Form Submission
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="${s.tableRow}">
      <td style="${s.tableLabelWide}">Interested in</td>
      <td style="${s.tableValue}"><strong>${escapeHtml(interestLabel)}</strong></td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Name</td>
      <td style="${s.tableValue}">${escapeHtml(body.name)}</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Email</td>
      <td style="padding: 10px 8px;"><a href="mailto:${escapeHtml(body.email)}" style="${s.link}">${escapeHtml(body.email)}</a></td>
    </tr>
    ${phoneRow}
    ${childAgeRow}
    ${messageRow}
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Notion CRM</td>
      <td style="${s.tableValue}">${notionStatus}</td>
    </tr>
    ${attributionRow}
  </table>
  <div style="${s.actionCallout}">
    <p style="${s.actionLabel}">ACTION NEEDED</p>
    <p style="margin: 8px 0 0; font-size: 13px; color: ${c.text};">
      Respond to ${escapeHtml(body.name)} within 1 business day regarding their ${escapeHtml(interestLabel)} inquiry.
    </p>
  </div>
</div>`;

  const parentHtml = `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 8px;">
    Thanks for Reaching Out!
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${escapeHtml(body.name)},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for getting in touch with Next Gen Pickleball Academy. We&rsquo;ve received your message about <strong>${escapeHtml(interestLabel)}</strong> and will get back to you within 1 business day.
  </p>
  <div style="${s.card}">
    <p style="margin: 0 0 4px; font-size: 13px; color: ${c.muted}; text-transform: uppercase; letter-spacing: 1px;">In the meantime</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
      Check out our <a href="https://nextgenpbacademy.com/schedule" style="${s.link} font-weight: 600;">upcoming sessions</a> to see what&rsquo;s available.
    </p>
  </div>
  <div style="${s.footer}">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply to this email or text Sam at <a href="tel:${site.phone}" style="${s.link}">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court!<br/>
      <strong style="color: ${c.accentLime};">— Coach Sam &amp; Coach Amine</strong><br/>
      <span style="color: ${c.muted};">Next Gen Pickleball Academy</span><br/>
      <a href="https://nextgenpbacademy.com" style="${s.link}">nextgenpbacademy.com</a>
    </p>
  </div>
</div>`;

  try {
    const resend = getResend();
    const subjectTail =
      kids.length === 1
        ? ` (${interestLabel}, child age ${kids[0].age})`
        : kids.length > 1
          ? ` (${interestLabel}, ${kids.length} kids: ${kids.map((k) => k.age).join(", ")})`
          : ` (${interestLabel})`;

    const results = await Promise.all([
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        cc: CC_EMAIL,
        subject: `New Contact — ${body.name}${subjectTail}`,
        html: adminHtml,
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: body.email,
        replyTo: site.email,
        subject: "Thanks for Reaching Out — Next Gen Pickleball Academy",
        html: parentHtml,
      }),
    ]);

    if (results.some((r) => r.error)) {
      console.error("Resend error:", results.find((r) => r.error)?.error);
      return NextResponse.json(
        { error: "Failed to send confirmation. Please contact us directly." },
        { status: 500 },
      );
    }

    // Awaited — Vercel tears down post-response promises before they complete,
    // mirroring the /api/lead pattern. OB helper has its own 5s timeout.
    await ingestToOpenBrain({
      email: body.email,
      name: body.name,
      phone: body.phone?.trim() || undefined,
      business: "nga",
      source: "nga_contact_form",
      interest,
      utm: {
        source: body.utm_source,
        medium: body.utm_medium,
        campaign: body.utm_campaign,
      },
      metadata: {
        interest_label: interestLabel,
        child_age: kids[0]?.age ?? null,
        kid_count: kids.length,
        kids:
          kids.length > 0
            ? kids.map((k) => ({ name: k.name.trim() || null, age: k.age }))
            : null,
        inquiry_message: body.message?.trim() || null,
        notion_status: notionStatus,
        is_parent: PROGRAM_INTERESTS.has(interest),
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
