import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { sendFunnelEvent } from "@/lib/funnelServer";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import { site } from "@/data/site";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

interface YellowBallLeadBody {
  parent_name?: string;
  child_name?: string;
  age?: number;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  landing_page?: string;
  visitor_id?: string | null;
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

  const adminHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #FFC107; font-size: 22px; margin-bottom: 24px;">
    New Yellow Ball Inquiry
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8; width: 140px;">Parent</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${parentName}</td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Player</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${childName} (age ${age})</td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Email</td>
      <td style="padding: 10px 8px;"><a href="mailto:${email}" style="color: #00D4FF;">${email}</a></td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Phone</td>
      <td style="padding: 10px 8px;"><a href="tel:${phone}" style="color: #00D4FF;">${phone}</a></td>
    </tr>
    ${
      notes
        ? `<tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8; vertical-align: top;">Notes</td>
      <td style="padding: 10px 8px; color: #EEF2FF; white-space: pre-wrap;">${notes}</td>
    </tr>`
        : ""
    }
  </table>
  <div style="margin-top: 24px; padding: 16px; background: #0C1F47; border-radius: 8px; border-left: 4px solid #FFC107;">
    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #FFC107;">ACTION NEEDED</p>
    <p style="margin: 8px 0 0; font-size: 13px; color: #EEF2FF;">
      Reach out to ${parentName} within 24 hours to set up the eval for ${childName}.
    </p>
  </div>
</div>`;

  const parentHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #FFC107; font-size: 22px; margin-bottom: 8px;">
    Got it, ${parentName.split(" ")[0]}.
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for the Yellow Ball inquiry. A coach will reach out within 24 hours
    to set up ${childName.split(" ")[0]}&rsquo;s eval.
  </p>
  <div style="background: #0C1F47; padding: 20px; border-radius: 8px; margin: 24px 0;">
    <p style="margin: 0 0 4px; font-size: 13px; color: #7A88B8; text-transform: uppercase; letter-spacing: 1px;">About Yellow Ball</p>
    <p style="margin: 0; font-size: 14px; line-height: 1.6;">
      Yellow Ball is our coach-curated track for players 12+ rated 3.0 or
      above. Small groups of 3&ndash;5 athletes, custom scheduling, focused
      tournament prep.
    </p>
  </div>
  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1A3060;">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply here or text Sam at <a href="tel:${site.phone}" style="color: #00D4FF;">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court!<br/>
      <strong style="color: #FFC107;">&mdash; Coach Sam &amp; Coach Amine</strong><br/>
      <span style="color: #7A88B8;">Next Gen Pickleball Academy</span><br/>
      <a href="https://nextgenpbacademy.com" style="color: #00D4FF;">nextgenpbacademy.com</a>
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

    void ingestToOpenBrain({
      email,
      name: parentName,
      phone,
      business: "nga",
      source: "nga_yellowball_inquiry",
      interest: "yellow_ball",
      metadata: {
        child_name: childName,
        child_age: age,
        notes: notes || null,
        landing_page: body.landing_page || null,
        is_parent: true,
      },
    });

    void sendFunnelEvent({
      eventType: "yellowball_lead_submitted",
      visitorId: body.visitor_id ?? null,
      email,
      marketingRef: "nga_yellowball",
      properties: {
        parent_name: parentName,
        child_age: age,
        source: "yellowball_inquiry",
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
