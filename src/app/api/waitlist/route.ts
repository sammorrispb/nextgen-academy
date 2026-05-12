import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { site } from "@/data/site";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_AREAS = new Set([
  "Anywhere in MoCo",
  "Rockville",
  "North Bethesda",
  "Bethesda",
  "Potomac",
  "Chevy Chase",
  "Kensington",
  "Silver Spring",
  "Gaithersburg",
  "Derwood",
  "Aspen Hill",
  "Olney",
  "Sandy Spring",
]);

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

function parseContact(contact: string): {
  email: string | null;
  phone: string | null;
} {
  if (EMAIL_RE.test(contact.trim())) {
    return { email: contact.trim(), phone: null };
  }
  return { email: null, phone: contact.trim() };
}

interface WaitlistBody {
  parentName?: string;
  contact?: string;
  preferredArea?: string;
  marketingOptIn?: boolean;
}

function validate(body: WaitlistBody): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!body.parentName?.trim()) errors.parentName = "Your name is required";
  if (!body.contact?.trim()) {
    errors.contact = "Email or phone number is required";
  } else if (
    !EMAIL_RE.test(body.contact) &&
    body.contact.replace(/\D/g, "").length < 10
  ) {
    errors.contact = "Enter a valid email or 10-digit phone";
  }
  if (!body.preferredArea?.trim()) {
    errors.preferredArea = "Pick an area";
  } else if (!ALLOWED_AREAS.has(body.preferredArea)) {
    errors.preferredArea = "Invalid area";
  }
  return errors;
}

async function createWaitlistEntry(body: Required<WaitlistBody>): Promise<{
  id?: string;
  error?: string;
}> {
  const notionKey = process.env.NOTION_API_KEY;
  const waitlistDb = process.env.NOTION_WAITLIST_DB_ID;
  if (!notionKey || !waitlistDb) {
    return { error: "Notion waitlist DB not configured" };
  }

  const { email, phone } = parseContact(body.contact);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    "Parent Name": {
      title: [{ text: { content: body.parentName } }],
    },
    "Preferred Area": { select: { name: body.preferredArea } },
    Status: { select: { name: "Active" } },
    "Marketing Opt-In": { checkbox: !!body.marketingOptIn },
  };

  if (email) properties["Parent Email"] = { email };
  if (phone) properties["Parent Phone"] = { phone_number: phone };

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: waitlistDb },
      properties,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Notion waitlist create failed (${res.status}): ${text}` };
  }
  const data = await res.json();
  return { id: data.id };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  let body: WaitlistBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validate(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Validation failed", errors },
      { status: 400 },
    );
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("[waitlist] RESEND_API_KEY missing");
    return NextResponse.json(
      { error: "Email service is not configured. Please contact us directly." },
      { status: 500 },
    );
  }

  const required = body as Required<WaitlistBody>;
  const { email, phone } = parseContact(required.contact);
  const contactDisplay = email || phone || required.contact;

  let notionStatus = "skipped";
  if (process.env.NOTION_API_KEY && process.env.NOTION_WAITLIST_DB_ID) {
    try {
      const result = await createWaitlistEntry(required);
      notionStatus = result.id ? "created" : `failed: ${result.error}`;
      if (result.error) console.error("[waitlist]", result.error);
    } catch (err) {
      notionStatus = "error";
      console.error("[waitlist] notion error:", err);
    }
  }

  const adminHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 24px;">
    New Waitlist Signup
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8; width: 140px;">Parent</td><td style="padding: 10px 8px; color: #EEF2FF;">${required.parentName}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Contact</td><td style="padding: 10px 8px;"><a href="${email ? `mailto:${email}` : `tel:${phone}`}" style="color: #00D4FF;">${contactDisplay}</a></td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Preferred Area</td><td style="padding: 10px 8px; color: #EEF2FF;">${required.preferredArea}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Marketing Opt-In</td><td style="padding: 10px 8px; color: #EEF2FF;">${required.marketingOptIn ? "Yes" : "No"}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Notion DB</td><td style="padding: 10px 8px; color: #EEF2FF;">${notionStatus}</td></tr>
  </table>
</div>`;

  const parentHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 8px;">
    You're on the waitlist.
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${required.parentName},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for adding yourself to the Next Gen waitlist for <strong style="color: #AADC00;">${required.preferredArea}</strong>. We&rsquo;ll email you the day new sessions open near you &mdash; usually 30 days ahead of the session date.
  </p>
  <div style="background: #0C1F47; padding: 20px; border-radius: 8px; margin: 24px 0;">
    <p style="margin: 0 0 4px; font-size: 13px; color: #7A88B8; text-transform: uppercase; letter-spacing: 1px;">While you wait</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
      Want your child evaluated before the next cohort opens? <a href="https://nextgenpbacademy.com/free-evaluation" style="color: #00D4FF; font-weight: 600;">Book a free 30-min evaluation &rarr;</a>
    </p>
  </div>
  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1A3060;">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply to this email or text Sam at <a href="tel:${site.phone}" style="color: #00D4FF;">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      <strong style="color: #AADC00;">— Coach Sam &amp; Coach Amine</strong><br/>
      <span style="color: #7A88B8;">Next Gen Pickleball Academy</span>
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
        subject: `Waitlist — ${required.parentName} (${required.preferredArea})`,
        html: adminHtml,
      }),
    ];
    if (email) {
      emailPromises.push(
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          replyTo: site.email,
          subject: "You're on the Next Gen waitlist",
          html: parentHtml,
        }),
      );
    }
    const results = await Promise.all(emailPromises);
    const hasError = results.some((r) => r.error);
    if (hasError) {
      console.error("[waitlist] resend error:", results.find((r) => r.error)?.error);
      return NextResponse.json(
        { error: "Failed to send confirmation. Please contact us directly." },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[waitlist] email send failed:", err);
    return NextResponse.json(
      { error: "Failed to send confirmation. Please contact us directly." },
      { status: 500 },
    );
  }
}
