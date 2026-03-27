import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { validateFreeTrialForm } from "@/lib/validate-free-trial";
import type { FreeTrialFormData } from "@/lib/validate-free-trial";
import { fetchFreeTrialSessions, LOCATIONS } from "@/lib/courtreserve";
import { locations } from "@/data/locations";
import { site } from "@/data/site";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const CR_BASE = "https://api.courtreserve.com";
const NOTION_API = "https://api.notion.com/v1";
const NOTION_DB_ID = "1e5e34c258384c6cb5f3e846543ecfc7";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

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

// ─── CourtReserve Member Functions ───────────────

function getCrAuth(locationName: string): string | null {
  const loc = LOCATIONS.find((l) => l.location === locationName);
  if (!loc) return null;
  const prefix = `COURTRESERVE_${loc.key.toUpperCase()}_`;
  const username = process.env[`${prefix}USERNAME`];
  const password = process.env[`${prefix}PASSWORD`];
  if (!username || !password) return null;
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

async function findCrMember(
  email: string,
  orgId: number,
  auth: string,
): Promise<{ OrganizationMemberId?: number } | null> {
  const params = new URLSearchParams({
    OrgId: String(orgId),
    email,
  });
  const res = await fetch(`${CR_BASE}/api/v1/member/get?${params}`, {
    headers: { Authorization: auth, "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const members = Array.isArray(data?.Data) ? data.Data : Array.isArray(data) ? data : [];
  return members.length > 0 ? members[0] : null;
}

async function createCrMember(
  body: FreeTrialFormData,
  orgId: number,
  auth: string,
): Promise<{ OrganizationMemberId?: number; error?: string }> {
  const res = await fetch(`${CR_BASE}/api/v1/member/create`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      FirstName: body.parentFirstName,
      LastName: body.parentLastName,
      Email: body.parentEmail,
      Phone: body.parentPhone,
      OrganizationId: orgId,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `CR create failed (${res.status}): ${text}` };
  }
  const data = await res.json();
  return data?.Data ?? data ?? {};
}

// ─── Notion Functions ────────────────────────────

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
      filter: {
        property: "Parent Email",
        email: { equals: email },
      },
      page_size: 1,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.length > 0 ? data.results[0].id : null;
}

async function createNotionPlayer(
  body: FreeTrialFormData,
  sessionLabel: string,
): Promise<{ id?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { error: "NOTION_API_KEY not configured" };

  const notesText = [
    `Free Trial RSVP: ${sessionLabel}`,
    body.howHeard ? `How heard: ${body.howHeard}` : "",
    body.notes || "",
  ]
    .filter(Boolean)
    .join(". ");

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_DB_ID },
      properties: {
        "Player Name": {
          title: [{ text: { content: `${body.childFirstName} ${body.childLastName}` } }],
        },
        Age: { number: Number(body.childAge) },
        "Parent Name": {
          rich_text: [{ text: { content: `${body.parentFirstName} ${body.parentLastName}` } }],
        },
        "Parent Email": { email: body.parentEmail },
        "Parent Phone": { phone_number: body.parentPhone },
        Location: { select: { name: body.location } },
        Level: { select: { name: "Eval Needed" } },
        Status: { select: { name: "Lead" } },
        Source: { select: { name: "Free Trial" } },
        Season: { select: { name: "Spring 2026" } },
        Notes: {
          rich_text: [{ text: { content: notesText } }],
        },
        "Next Action": {
          rich_text: [{ text: { content: "Register for free trial session on CR" } }],
        },
      },
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

  let body: FreeTrialFormData;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validateFreeTrialForm(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
  }

  // Look up session from live CR data
  const allSessions = await fetchFreeTrialSessions();
  const session = allSessions.find((s) => String(s.eventId) === body.sessionId);
  const sessionLabel = session?.label ?? (body.sessionLabel || `Event #${body.sessionId}`);

  // Look up location address
  const location = locations.find((l) => l.name === body.location);
  const locationAddress = location
    ? `${location.address}, ${location.city}, ${location.state} ${location.zip}`
    : body.location;

  // ─── 1. Create CR Member (dedup) ─────────────
  let crMemberId: string | number = "N/A";
  let crStatus = "skipped";
  const crAuth = getCrAuth(body.location);
  const orgId = session?.orgId ?? LOCATIONS.find((l) => l.location === body.location)?.orgId;

  if (crAuth && orgId) {
    try {
      const existing = await findCrMember(body.parentEmail, orgId, crAuth);
      if (existing?.OrganizationMemberId) {
        crMemberId = existing.OrganizationMemberId;
        crStatus = "already exists";
      } else {
        const result = await createCrMember(body, orgId, crAuth);
        if (result.OrganizationMemberId) {
          crMemberId = result.OrganizationMemberId;
          crStatus = "created";
        } else {
          crStatus = `failed: ${result.error || "unknown"}`;
          console.error("CR member creation failed:", result.error);
        }
      }
    } catch (err) {
      crStatus = "error";
      console.error("CR member error:", err);
    }
  }

  // ─── 2. Create Notion Player (dedup) ─────────
  let notionStatus = "skipped";
  if (process.env.NOTION_API_KEY) {
    try {
      const existingId = await findNotionPlayer(body.parentEmail);
      if (existingId) {
        notionStatus = "already exists";
      } else {
        const result = await createNotionPlayer(body, sessionLabel);
        notionStatus = result.id ? "created" : `failed: ${result.error}`;
        if (result.error) console.error("Notion create failed:", result.error);
      }
    } catch (err) {
      notionStatus = "error";
      console.error("Notion error:", err);
    }
  }

  // ─── 3. Send Emails ──────────────────────────
  const adminHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 24px;">
    New Free Trial RSVP
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8; width: 140px;">Parent Name</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${body.parentFirstName} ${body.parentLastName}</td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Email</td>
      <td style="padding: 10px 8px;"><a href="mailto:${body.parentEmail}" style="color: #00D4FF;">${body.parentEmail}</a></td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Phone</td>
      <td style="padding: 10px 8px;"><a href="tel:${body.parentPhone}" style="color: #00D4FF;">${body.parentPhone}</a></td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Child</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${body.childFirstName} ${body.childLastName} (age ${body.childAge})</td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Session</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${sessionLabel}</td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Location</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">Dill Dinkers ${body.location}<br/>${locationAddress}</td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">CR Member</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">ID: ${crMemberId} (${crStatus})</td>
    </tr>
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Notion CRM</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${notionStatus}</td>
    </tr>
    ${body.howHeard ? `
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">How They Heard</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${body.howHeard}</td>
    </tr>` : ""}
    ${body.notes ? `
    <tr style="border-bottom: 1px solid #1A3060;">
      <td style="padding: 10px 8px; color: #7A88B8;">Notes</td>
      <td style="padding: 10px 8px; color: #EEF2FF;">${body.notes}</td>
    </tr>` : ""}
  </table>
  <div style="margin-top: 24px; padding: 16px; background: #0C1F47; border-radius: 8px; border-left: 4px solid #AADC00;">
    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #AADC00;">ACTION NEEDED</p>
    <p style="margin: 8px 0 0; font-size: 13px; color: #EEF2FF;">
      CR member account ${crStatus === "created" ? "was auto-created" : crStatus === "already exists" ? "already existed" : "could not be created"}.
      Register them for the session: <strong>${sessionLabel}</strong>
    </p>
  </div>
</div>`;

  const parentHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 8px;">
    You're In!
  </h1>
  <p style="font-size: 16px; color: #7A88B8; margin-bottom: 24px;">
    ${body.childFirstName}'s free pickleball trial is booked.
  </p>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${body.parentFirstName},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for signing up ${body.childFirstName} for a free trial session at Next Gen Pickleball Academy!
  </p>
  <div style="background: #0C1F47; padding: 20px; border-radius: 8px; margin: 24px 0;">
    <p style="margin: 0 0 4px; font-size: 13px; color: #7A88B8; text-transform: uppercase; letter-spacing: 1px;">Your Session</p>
    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #EEF2FF;">${sessionLabel}</p>
    <p style="margin: 8px 0 0; font-size: 14px; color: #7A88B8;">
      Dill Dinkers ${body.location}<br/>${locationAddress}
    </p>
  </div>
  <h2 style="font-family: Montserrat, Arial, sans-serif; color: #EEF2FF; font-size: 16px; margin: 24px 0 12px;">What to Bring</h2>
  <ul style="font-size: 14px; line-height: 1.8; padding-left: 20px; color: #EEF2FF;">
    <li>Athletic shoes (closed-toe, non-marking soles)</li>
    <li>Comfortable athletic clothing</li>
    <li>Water bottle</li>
    <li style="color: #AADC00; font-weight: 600;">We provide all paddles and balls!</li>
  </ul>
  <h2 style="font-family: Montserrat, Arial, sans-serif; color: #EEF2FF; font-size: 16px; margin: 24px 0 12px;">What to Expect</h2>
  <p style="font-size: 14px; line-height: 1.6;">
    Your child will join our beginner group and learn pickleball rules, fundamentals, and play real games with other kids their age. A coach will assess your child's skill level during the session.
  </p>
  <h2 style="font-family: Montserrat, Arial, sans-serif; color: #EEF2FF; font-size: 16px; margin: 24px 0 12px;">After the Session</h2>
  <p style="font-size: 14px; line-height: 1.6;">
    Within 24 hours, we'll follow up with a group recommendation for your child based on their assessment, along with details on how to continue.
  </p>
  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1A3060;">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply to this email or text Sam at <a href="tel:${site.phone}" style="color: #00D4FF;">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court!<br/>
      <strong style="color: #AADC00;">— Coach Sam &amp; Coach Amine</strong><br/>
      <span style="color: #7A88B8;">Next Gen Pickleball Academy</span><br/>
      <a href="https://nextgenpbacademy.com" style="color: #00D4FF;">nextgenpbacademy.com</a>
    </p>
  </div>
</div>`;

  try {
    const resend = getResend();
    const [adminResult, parentResult] = await Promise.all([
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        cc: CC_EMAIL,
        subject: `New Free Trial RSVP — ${body.childFirstName} ${body.childLastName}`,
        html: adminHtml,
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: body.parentEmail,
        replyTo: site.email,
        subject: `You're In! ${body.childFirstName}'s Free Pickleball Trial is Booked`,
        html: parentHtml,
      }),
    ]);

    if (adminResult.error || parentResult.error) {
      console.error("Resend error:", adminResult.error || parentResult.error);
      return NextResponse.json(
        { error: "Failed to send confirmation emails. Please contact us directly." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email send failed:", err);
    return NextResponse.json(
      { error: "Failed to send confirmation emails. Please contact us directly." },
      { status: 500 },
    );
  }
}
