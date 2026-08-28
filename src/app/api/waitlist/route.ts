import { NextRequest, NextResponse } from "next/server";
import { EMAIL_RE, createNotionPageSourceFailSoft } from "@/lib/notion-utils";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { Resend } from "resend";
import { site } from "@/data/site";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import { attributedSource } from "@/lib/attribution";
import {
  buildOpenNowOffers,
  fallRegistrationOpen,
} from "@/lib/open-now-offers";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

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

// Per-route in-memory rate limit (5/hr, resets on deploy) — shared impl in
// src/lib/rate-limit.ts; each route keeps its own bucket, as before.
const { isRateLimited } = createRateLimiter();

function parseContact(contact: string): {
  email: string | null;
  phone: string | null;
} {
  if (EMAIL_RE.test(contact.trim())) {
    return { email: contact.trim(), phone: null };
  }
  return { email: null, phone: contact.trim() };
}

// The two empty states that render the waitlist form. Whitelisted rather than
// escaped: these strings land in an HTML email, and an unknown value is a bug
// or an attack, never a new surface we forgot about.
const FORM_SURFACES = new Set(["schedule_empty", "home_upcoming_empty"]);
const PATH_RE = /^\/[A-Za-z0-9/_-]{0,64}$/;

function describeSurface(body: WaitlistBody): string {
  const surface = FORM_SURFACES.has(body.source ?? "") ? body.source : null;
  const page = body.page && PATH_RE.test(body.page) ? body.page : null;
  if (surface && page) return `${surface} (${page})`;
  return surface ?? page ?? "unknown";
}

interface WaitlistBody {
  parentName?: string;
  contact?: string;
  preferredArea?: string;
  marketingOptIn?: boolean;
  /** Which empty-state form fired — see FORM_SURFACES. */
  source?: string;
  /** Pathname the form was rendered on. */
  page?: string;
  // Attribution (optional) — UTM stash forwarded by the waitlist form
  // (UtmCapture → sessionStorage). Mapped to a Source select on the Notion
  // row via the shared attributedSource() vocab; absent = "Website".
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  ref?: string;
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
  droppedSource?: boolean;
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
    Source: { select: { name: attributedSource(body) } },
  };

  if (email) properties["Parent Email"] = { email };
  if (phone) properties["Parent Phone"] = { phone_number: phone };

  // Source is best-effort attribution; the waitlist row is not. If Notion
  // rejects the create because of Source (the 2026-08-25 miss: this DB never
  // gained the property, so a real signup emailed fine and never landed),
  // retry without it rather than lose the family.
  const { res, bodyText, droppedSource } = await createNotionPageSourceFailSoft({
    notionKey,
    databaseId: waitlistDb,
    properties,
    logPrefix: "[waitlist]",
  });

  if (!res.ok) {
    const text = bodyText || (await res.text().catch(() => ""));
    return { error: `Notion waitlist create failed (${res.status}): ${text}` };
  }
  const data = await res.json();
  return { id: data.id, droppedSource };
}

export async function POST(request: NextRequest) {
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

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
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

  // Same offers the empty-state block renders — a waitlist confirmation is the
  // one message these parents consented to, and most never opt into marketing,
  // so it has to carry what they can act on today.
  const offersHtml = buildOpenNowOffers(
    new Date().toISOString().slice(0, 10),
    fallRegistrationOpen(),
  )
    .map(
      (offer) => `
    <div style="background: #0C1F47; padding: 18px 20px; border-radius: 8px; margin: 0 0 12px;">
      <p style="margin: 0 0 4px; font-size: 11px; color: #AADC00; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700;">${offer.eyebrow}</p>
      <p style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #EEF2FF;">${offer.title}</p>
      <p style="margin: 0 0 10px; font-size: 14px; line-height: 1.6; color: #C7D0EE;">${offer.detail}</p>
      <a href="https://nextgenpbacademy.com${offer.href}" style="color: #00D4FF; font-weight: 600; font-size: 14px; text-decoration: none;">${offer.cta} &rarr;</a>
    </div>`,
    )
    .join("");

  let notionStatus = "skipped";
  if (process.env.NOTION_API_KEY && process.env.NOTION_WAITLIST_DB_ID) {
    try {
      const result = await createWaitlistEntry(required);
      // Say so when attribution was dropped — a silent "created" would hide
      // the schema drift that the retry papered over.
      notionStatus = result.id
        ? result.droppedSource
          ? "created (without Source — add a Source property to the waitlist DB)"
          : "created"
        : `failed: ${result.error}`;
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
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Signed Up From</td><td style="padding: 10px 8px; color: #EEF2FF;">${describeSurface(required)}</td></tr>
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
  <p style="margin: 24px 0 12px; font-size: 13px; color: #7A88B8; text-transform: uppercase; letter-spacing: 1px;">While you wait &mdash; open right now</p>
  ${offersHtml}
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

    // Open Brain ingest. Mirrors /api/lead — accepts email-bearing AND
    // phone-only leads. AWAIT so the Vercel lambda doesn't tear down the
    // fetch before it completes; helper has its own 5s timeout and logs +
    // returns on failure, so this never blocks the response.
    if (email || phone) {
      await ingestToOpenBrain({
        email: email ?? undefined,
        name: required.parentName,
        phone: phone ?? undefined,
        business: "nga",
        source: "nga_waitlist",
        interest: "Waitlist",
        metadata: {
          preferred_area: required.preferredArea,
          marketing_opt_in: !!required.marketingOptIn,
          phone_only: !email && !!phone,
          notion_status: notionStatus,
          is_parent: true,
        },
      });
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
