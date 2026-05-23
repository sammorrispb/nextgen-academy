import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { normalizeKids, validateLeadForm } from "@/lib/validate-lead";
import type { Kid, LeadFormData } from "@/lib/validate-lead";
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

async function createNotionPlayerRow(
  body: LeadFormData,
  kid: Kid,
  siblings: Kid[],
): Promise<{ id?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { error: "NOTION_API_KEY not configured" };

  const { email, phone } = parseContact(body.contact);
  const attribution = formatAttribution(body);
  const parentNote = body.notes?.trim();
  const trimmedName = kid.name.trim();
  const titleText = trimmedName || `Child of ${body.parentName}`;
  const parts = [`Lead form submission. Child age: ${kid.age}`];
  if (siblings.length > 0) {
    parts.push(
      `Siblings on same submission: ${siblings
        .map((s) => `${s.name.trim() || "unnamed"} (${s.age})`)
        .join(", ")}`,
    );
  }
  if (parentNote) parts.push(`Parent says: "${parentNote}"`);
  if (attribution) parts.push(`Attribution: ${attribution}`);
  const notesContent = parts.join(". ");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    "Player Name": {
      title: [{ text: { content: titleText } }],
    },
    Age: { number: kid.age },
    "Parent Name": {
      rich_text: [{ text: { content: body.parentName } }],
    },
    Level: { select: { name: "Eval Needed" } },
    Status: { select: { name: "Lead" } },
    Source: { select: { name: attributedSource(body) } },
    Season: { select: { name: currentSeasonLabel() } },
    Audience: { select: { name: kid.age >= 17 ? "Adult" : "Youth" } },
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

  const kids = normalizeKids(body);

  // ─── 1. Create Notion Player rows (one per kid; parent-level dedup) ───
  // Dedup intentionally stays at the parent-email/phone level: if a parent
  // already has a row in the CRM, we don't auto-create N more — that risks
  // duplicating an existing family if the form is re-submitted. Coach can
  // add siblings manually until a richer per-kid dedup ships.
  let notionStatus = "skipped";
  if (process.env.NOTION_API_KEY) {
    try {
      const existingId = await findNotionPlayer(body.contact);
      if (existingId) {
        notionStatus = "already exists";
      } else {
        const results = await Promise.all(
          kids.map((kid, i) =>
            createNotionPlayerRow(
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

  const { email, phone } = parseContact(body.contact);
  const contactDisplay = email || phone || body.contact;

  // ─── 2. Send Emails ──────────────────────────
  const adminHtml = `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 24px;">
    New Website Lead
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="${s.tableRow}">
      <td style="${s.tableLabelWide}">Parent Name</td>
      <td style="${s.tableValue}">${body.parentName}</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Contact</td>
      <td style="padding: 10px 8px;"><a href="${email ? `mailto:${email}` : `tel:${phone}`}" style="${s.link}">${contactDisplay}</a></td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel} vertical-align: top;">${kids.length === 1 ? "Child" : `Kids (${kids.length})`}</td>
      <td style="${s.tableValue}">${kids
        .map((kid) => {
          const trimmed = kid.name.trim();
          const safeName = trimmed
            ? trimmed.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[ch] || ch)
            : "(name not provided)";
          return `${safeName} — ${kid.age} years old`;
        })
        .join("<br/>")}</td>
    </tr>
    ${
      body.notes?.trim()
        ? `<tr style="${s.tableRow}">
      <td style="${s.tableLabel} vertical-align: top;">Parent Notes</td>
      <td style="${s.tableValue} white-space: pre-wrap;">${body.notes.trim().replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[ch] || ch)}</td>
    </tr>`
        : ""
    }
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Preferred Location</td>
      <td style="${s.tableValue}">${body.location || "No preference"}</td>
    </tr>
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
      Reach out to ${body.parentName} within 24 hours to discuss placement for ${kids.length === 1 ? `their ${kids[0].age}-year-old` : `${kids.length} kids`}.
    </p>
  </div>
</div>`;

  // Only send parent confirmation if we have an email
  const shouldEmailParent = !!email;

  const parentHtml = `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 8px;">
    Thanks for Reaching Out!
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${body.parentName},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for your interest in Next Gen Pickleball Academy! We\u2019ll be in touch within 24 hours to help find the right group for your child.
  </p>
  <div style="${s.card}">
    <p style="margin: 0 0 4px; font-size: 13px; color: ${c.muted}; text-transform: uppercase; letter-spacing: 1px;">In the meantime</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
      Check out our <a href="https://nextgenpbacademy.com/schedule" style="${s.link} font-weight: 600;">upcoming sessions</a> to see what\u2019s available.
    </p>
  </div>
  <div style="${s.footer}">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply to this email or text Sam at <a href="tel:${site.phone}" style="${s.link}">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court!<br/>
      <strong style="color: ${c.accentLime};">\u2014 Coach Sam &amp; Coach Amine</strong><br/>
      <span style="color: ${c.muted};">Next Gen Pickleball Academy</span><br/>
      <a href="https://nextgenpbacademy.com" style="${s.link}">nextgenpbacademy.com</a>
    </p>
  </div>
</div>`;

  try {
    const resend = getResend();

    const kidsSubjectTail =
      kids.length === 1
        ? `(child age ${kids[0].age})`
        : `(${kids.length} kids: ${kids.map((k) => k.age).join(", ")})`;
    const emailPromises = [
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        cc: CC_EMAIL,
        subject: `New Lead — ${body.parentName} ${kidsSubjectTail}`,
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

    // Ingest to Open Brain master CRM. AWAIT — Vercel drops post-response
    // Promises before they complete; `void` here was silently losing ~half
    // of all leads. Helper has its own 5s timeout + log-on-failure, so OB
    // downtime cannot block the response.
    // OB accepts either email or phone as the dedup key; phone-only leads
    // now flow through instead of being dropped.
    if (email || phone) {
      const firstKidAge = kids[0]?.age;
      await ingestToOpenBrain({
        email: email ?? undefined,
        name: body.parentName,
        phone: phone ?? undefined,
        business: "nga",
        source: "nga_lead_form",
        interest:
          kids.length === 1
            ? `Age ${firstKidAge}`
            : `${kids.length} kids (ages ${kids.map((k) => k.age).join(", ")})`,
        utm: {
          source: body.utm_source,
          medium: body.utm_medium,
          campaign: body.utm_campaign,
        },
        metadata: {
          child_age: firstKidAge ?? null,
          kid_count: kids.length,
          kids: kids.map((k) => ({ name: k.name.trim() || null, age: k.age })),
          location: body.location || null,
          parent_notes: body.notes?.trim() || null,
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
