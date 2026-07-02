import { NextRequest, NextResponse } from "next/server";
import { EMAIL_RE } from "@/lib/notion-utils";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { Resend } from "resend";
import { c, s } from "@/lib/email/brand";
import { whatsappInviteHtml } from "@/lib/email/whatsapp-invite";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import { isFirstTimeParent } from "@/lib/notion-player-lookup";
import { site } from "@/data/site";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

// Per-route in-memory rate limit (5/hr, resets on deploy) — shared impl in
// src/lib/rate-limit.ts; each route keeps its own bucket, as before.
const { isRateLimited } = createRateLimiter();

interface YellowBallLeadBody {
  parent_name?: string;
  child_name?: string;
  age?: number;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  landing_page?: string;
  visitor_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
}

function validate(body: YellowBallLeadBody): string | null {
  if (!body.parent_name?.trim()) return "parent_name is required";
  if (!body.child_name?.trim()) return "child_name is required";
  if (typeof body.age !== "number" || body.age < 6 || body.age > 18) {
    return "age must be between 6 and 18";
  }
  if (!body.contact_email || !EMAIL_RE.test(body.contact_email.trim())) {
    return "valid contact_email is required";
  }
  if (!body.contact_phone || body.contact_phone.replace(/\D/g, "").length < 10) {
    return "valid contact_phone is required";
  }
  return null;
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

  let body: YellowBallLeadBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const parentName = body.parent_name!.trim();
  const childName = body.child_name!.trim();
  const age = body.age!;
  const email = body.contact_email!.trim().toLowerCase();
  const phone = body.contact_phone!.trim();
  const notes = body.notes?.trim() || "";

  const isFirstTimer = await isFirstTimeParent(email);

  const adminHtml = `
<div style="${s.wrapper}">
  <h1 style="${s.headingYellow} margin-bottom: 24px;">
    New Yellow Ball Inquiry
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="${s.tableRow}">
      <td style="${s.tableLabelWide}">Parent</td>
      <td style="${s.tableValue}">${parentName}</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Player</td>
      <td style="${s.tableValue}">${childName} (age ${age})</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Email</td>
      <td style="padding: 10px 8px;"><a href="mailto:${email}" style="${s.link}">${email}</a></td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Phone</td>
      <td style="padding: 10px 8px;"><a href="tel:${phone}" style="${s.link}">${phone}</a></td>
    </tr>
    ${
      notes
        ? `<tr style="${s.tableRow}">
      <td style="${s.tableLabel} vertical-align: top;">Notes</td>
      <td style="${s.tableValue} white-space: pre-wrap;">${notes}</td>
    </tr>`
        : ""
    }
  </table>
  <div style="${s.actionCalloutYellow}">
    <p style="${s.actionLabelYellow}">ACTION NEEDED</p>
    <p style="margin: 8px 0 0; font-size: 13px; color: ${c.text};">
      Reach out to ${parentName} within 24 hours to set up the eval for ${childName}.
    </p>
  </div>
</div>`;

  const parentHtml = `
<div style="${s.wrapper}">
  <h1 style="${s.headingYellow} margin-bottom: 8px;">
    Got it, ${parentName.split(" ")[0]}.
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for the Yellow Ball inquiry. A coach will reach out within 24 hours
    to set up ${childName.split(" ")[0]}&rsquo;s eval.
  </p>
  <div style="${s.card}">
    <p style="margin: 0 0 4px; font-size: 13px; color: ${c.muted}; text-transform: uppercase; letter-spacing: 1px;">About Yellow Ball</p>
    <p style="margin: 0; font-size: 14px; line-height: 1.6;">
      Yellow Ball is our coach-curated track for players 12+ rated 3.0 or
      above. Small groups of 3&ndash;5 athletes, custom scheduling, focused
      tournament prep.
    </p>
  </div>
  ${isFirstTimer ? whatsappInviteHtml() : ""}
  <div style="${s.footer}">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply here or text Sam at <a href="tel:${site.phone}" style="${s.link}">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court!<br/>
      <strong style="color: ${c.accentYellow};">&mdash; Coach Sam &amp; Coach Amine</strong><br/>
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
        subject: `Yellow Ball inquiry — ${childName} (age ${age})`,
        html: adminHtml,
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        replyTo: site.email,
        subject: "Your Yellow Ball inquiry — Next Gen Pickleball Academy",
        html: parentHtml,
      }),
    ]);

    const hasError = results.some((r) => r.error);
    if (hasError) {
      console.error("Resend error:", results.find((r) => r.error)?.error);
      return NextResponse.json(
        { error: "Failed to send confirmation. Please contact us directly." },
        { status: 500 },
      );
    }

    // AWAIT — Vercel tears down lambdas before fire-and-forget Promises
    // complete. Helper logs failures + has a 5s timeout, so this is safe.
    await ingestToOpenBrain({
      email,
      name: parentName,
      phone,
      business: "nga",
      source: "nga_yellowball_inquiry",
      interest: "yellow_ball",
      utm: {
        source: body.utm_source ?? undefined,
        medium: body.utm_medium ?? undefined,
        campaign: body.utm_campaign ?? undefined,
      },
      metadata: {
        child_name: childName,
        child_age: age,
        notes: notes || null,
        landing_page: body.landing_page || null,
        is_parent: true,
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
