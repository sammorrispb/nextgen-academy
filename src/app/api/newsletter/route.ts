import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { site } from "@/data/site";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import {
  newsletterWelcomeHtml,
  newsletterWelcomeText,
} from "@/lib/email/newsletter-welcome";
import {
  signReferralToken,
  verifyReferralToken,
} from "@/lib/referral-token";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const SITE_ORIGIN = "https://nextgenpbacademy.com";
const SCHEDULE_URL = `${SITE_ORIGIN}/schedule`;
const CREW_INTEREST_URL = `${SITE_ORIGIN}/crew`;

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

interface NewsletterBody {
  parentName?: string;
  email?: string;
  childAge?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  /** Signed referral token captured from the ?ref=<token> query string. */
  ref?: string;
}

function validate(body: NewsletterBody): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!body.parentName?.trim()) errors.parentName = "Your name is required";
  if (!body.email?.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(body.email.trim())) {
    errors.email = "Please enter a valid email address";
  }
  if (!body.childAge) {
    errors.childAge = "Child's age is required";
  } else {
    const age = Number(body.childAge);
    if (isNaN(age) || age < 6 || age > 16) {
      errors.childAge = "Age must be between 6 and 16";
    }
  }
  return errors;
}

interface NotionLookup {
  pageId?: string;
  alreadyWelcomed?: boolean;
}

// Query the subscribers DB by Email. Returns the existing page id (and whether
// it has already been welcomed) so we can dedup the welcome send.
async function findSubscriberByEmail(
  email: string,
): Promise<NotionLookup | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_NEWSLETTER_DB_ID;
  if (!notionKey || !db) return null;

  const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: "Email", email: { equals: email } },
      page_size: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[newsletter] notion query failed (${res.status}): ${text}`);
    return null;
  }
  const data = await res.json();
  const page = data.results?.[0];
  if (!page) return null;
  return {
    pageId: page.id,
    alreadyWelcomed: page.properties?.["Welcome Sent"]?.checkbox === true,
  };
}

async function createSubscriber(
  parentName: string,
  email: string,
  childAge: number,
  referralToken: string | null,
  referredBy: string | null,
): Promise<{ pageId?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_NEWSLETTER_DB_ID;
  if (!notionKey || !db) {
    return { error: "Notion newsletter DB not configured" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    "Parent Name": { title: [{ text: { content: parentName } }] },
    Email: { email },
    "Child Age": { number: childAge },
    Status: { select: { name: "Active" } },
    "Marketing Opt-In": { checkbox: true },
    "Welcome Sent": { checkbox: false },
    "Referral Rewarded": { checkbox: false },
    "Coupons Issued": { number: 0 },
  };
  if (referralToken) {
    properties["Referral Token"] = {
      rich_text: [{ text: { content: referralToken } }],
    };
  }
  if (referredBy) {
    properties["Referred By"] = { email: referredBy };
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: db },
      properties,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Notion newsletter create failed (${res.status}): ${text}` };
  }
  const data = await res.json();
  return { pageId: data.id };
}

async function markWelcomeSent(pageId: string): Promise<void> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return;
  try {
    await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        properties: { "Welcome Sent": { checkbox: true } },
      }),
    });
  } catch (err) {
    console.error("[newsletter] markWelcomeSent failed:", err);
  }
}

export async function POST(request: NextRequest) {
  let body: NewsletterBody;
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

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("[newsletter] RESEND_API_KEY missing");
    return NextResponse.json(
      { error: "Email service is not configured. Please contact us directly." },
      { status: 500 },
    );
  }

  const parentName = body.parentName!.trim();
  const email = body.email!.trim().toLowerCase();
  const childAge = Number(body.childAge);
  const parentFirst = parentName.split(" ")[0] || parentName;

  // Decode the ref token if present. Self-referrals (someone clicking their
  // own forward link) are silently dropped — we just create the row without
  // a Referred By value.
  let referredBy: string | null = null;
  if (body.ref) {
    const referrer = verifyReferralToken(body.ref);
    if (referrer && referrer !== email) {
      referredBy = referrer;
    }
  }
  const referralToken = signReferralToken(email);

  // Notion dedup-and-create. Skipped gracefully if env vars missing.
  let notionStatus = "skipped";
  let pageId: string | undefined;
  let alreadyWelcomed = false;
  if (process.env.NOTION_API_KEY && process.env.NOTION_NEWSLETTER_DB_ID) {
    try {
      const existing = await findSubscriberByEmail(email);
      if (existing?.pageId) {
        pageId = existing.pageId;
        alreadyWelcomed = !!existing.alreadyWelcomed;
        notionStatus = "duplicate";
      } else {
        const result = await createSubscriber(
          parentName,
          email,
          childAge,
          referralToken,
          referredBy,
        );
        pageId = result.pageId;
        notionStatus = result.pageId ? "created" : `failed: ${result.error}`;
        if (result.error) console.error("[newsletter]", result.error);
      }
    } catch (err) {
      notionStatus = "error";
      console.error("[newsletter] notion error:", err);
    }
  }

  // Suppress the welcome send only when a known subscriber was already welcomed
  // (idempotent re-submit). New rows and rows that never got the welcome still
  // receive it.
  const shouldSendWelcome = !alreadyWelcomed;

  const adminHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 24px;">
    New Newsletter Signup
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8; width: 140px;">Parent</td><td style="padding: 10px 8px; color: #EEF2FF;">${parentName}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Email</td><td style="padding: 10px 8px;"><a href="mailto:${email}" style="color: #00D4FF;">${email}</a></td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Child Age</td><td style="padding: 10px 8px; color: #EEF2FF;">${childAge}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Notion DB</td><td style="padding: 10px 8px; color: #EEF2FF;">${notionStatus}</td></tr>
  </table>
</div>`;

  try {
    const resend = getResend();
    const emailPromises = [
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        cc: CC_EMAIL,
        subject: `Newsletter — ${parentName} (age ${childAge})`,
        html: adminHtml,
      }),
    ];
    if (shouldSendWelcome) {
      const referralUrl = referralToken
        ? `${SITE_ORIGIN}/newsletter?ref=${encodeURIComponent(referralToken)}`
        : null;
      const welcomeInput = {
        parentFirst,
        scheduleUrl: SCHEDULE_URL,
        crewInterestUrl: CREW_INTEREST_URL,
        referralUrl,
      };
      emailPromises.push(
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          bcc: ADMIN_EMAIL,
          replyTo: site.email,
          subject: "You're in the Next Gen crew",
          html: newsletterWelcomeHtml(welcomeInput),
          text: newsletterWelcomeText(welcomeInput),
        }),
      );
    }
    const results = await Promise.all(emailPromises);
    const hasError = results.some((r) => r.error);
    if (hasError) {
      console.error(
        "[newsletter] resend error:",
        results.find((r) => r.error)?.error,
      );
      return NextResponse.json(
        { error: "Failed to send confirmation. Please contact us directly." },
        { status: 500 },
      );
    }

    // Flip Welcome Sent after a successful send so re-submits stay idempotent.
    if (shouldSendWelcome && pageId) {
      await markWelcomeSent(pageId);
    }

    // Open Brain ingest — awaited so the Vercel lambda doesn't tear down the
    // fetch before it completes; helper has its own 5s timeout + log-on-failure.
    await ingestToOpenBrain({
      email,
      name: parentName,
      business: "nga",
      source: "nga_newsletter_signup",
      interest: `Age ${childAge}`,
      utm: {
        source: body.utm_source,
        medium: body.utm_medium,
        campaign: body.utm_campaign,
      },
      metadata: {
        child_age: childAge,
        marketing_opt_in: true,
        notion_status: notionStatus,
        is_parent: true,
        referred_by: referredBy ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[newsletter] email send failed:", err);
    return NextResponse.json(
      { error: "Failed to send confirmation. Please contact us directly." },
      { status: 500 },
    );
  }
}
