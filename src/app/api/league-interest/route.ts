import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { site } from "@/data/site";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import {
  validateLeagueInterestForm,
  type LeagueInterestFormData,
  type LeagueLevel,
} from "@/lib/validate-league-interest";
import { findBand, type LeagueBand } from "@/data/leagues";
import { createLeagueInterest } from "@/lib/notion-league-interest";
import {
  leagueInterestWelcomeHtml,
  leagueInterestWelcomeSubject,
  leagueInterestWelcomeText,
} from "@/lib/email/league-interest-welcome";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const SCHEDULE_URL = "https://nextgenpbacademy.com/schedule";

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

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  let body: Partial<LeagueInterestFormData>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validateLeagueInterestForm(body);
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

  const parentName = body.parentName!.trim();
  const email = body.email!.trim().toLowerCase();
  const phone = body.phone?.trim() ?? "";
  const childFirstName = body.childFirstName!.trim();
  const childAge = Number(body.childAge);
  const childBirthYear = new Date().getFullYear() - childAge;
  const preferredBand = body.preferredBand as LeagueBand;
  const childLevel = (body.childLevel as LeagueLevel | undefined) ?? "";
  const notes = body.notes?.trim().slice(0, 1900) ?? "";
  const source = body.source ?? "Web";
  const parentFirst = parentName.split(" ")[0] || parentName;
  const bandInfo = findBand(preferredBand);
  const bandLabel = bandInfo?.label ?? preferredBand;

  const interestSummary = `${preferredBand}${childLevel ? ` · ${childLevel}` : ""} · age ${childAge}`;

  // Notion write — fails soft. The welcome email and Open Brain ingest still
  // run so Sam captures every submission via BCC + the demand signal.
  let notionStatus = "skipped";
  if (process.env.NOTION_API_KEY && process.env.NOTION_LEAGUE_INTEREST_DB_ID) {
    try {
      const result = await createLeagueInterest({
        parentName,
        email,
        phone,
        childFirstName,
        childBirthYear,
        preferredBand,
        childLevel,
        notes,
        source,
        marketingOptIn: true,
      });
      notionStatus = result.ok ? "created" : `failed: ${result.error}`;
      if (!result.ok) console.error("[league-interest]", result.error);
    } catch (err) {
      notionStatus = "error";
      console.error("[league-interest] notion error:", err);
    }
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[league-interest] RESEND_API_KEY missing — skipping emails");
  } else {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const adminHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 24px;">
    New League Interest
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8; width: 140px;">Parent</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(parentName)}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Email</td><td style="padding: 10px 8px;"><a href="mailto:${escape(email)}" style="color: #00D4FF;">${escape(email)}</a></td></tr>
    ${phone ? `<tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Phone</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(phone)}</td></tr>` : ""}
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Child</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(childFirstName)} (age ${childAge})</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Band</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(preferredBand)}${childLevel ? ` · ${escape(childLevel)}` : ""}</td></tr>
    ${notes ? `<tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Notes</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(notes)}</td></tr>` : ""}
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Source</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(source)}</td></tr>
    <tr><td style="padding: 10px 8px; color: #7A88B8;">Notion</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(notionStatus)}</td></tr>
  </table>
</div>`;

    try {
      await Promise.all([
        resend.emails.send({
          from: FROM_EMAIL,
          to: ADMIN_EMAIL,
          cc: CC_EMAIL,
          subject: `League Interest — ${childFirstName} (${preferredBand}${childLevel ? `, ${childLevel}` : ""})`,
          html: adminHtml,
        }),
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          bcc: CC_EMAIL,
          replyTo: site.email,
          subject: leagueInterestWelcomeSubject({ childFirst: childFirstName }),
          html: leagueInterestWelcomeHtml({
            parentFirst,
            childFirst: childFirstName,
            bandLabel,
            interestSummary,
            scheduleUrl: SCHEDULE_URL,
          }),
          text: leagueInterestWelcomeText({
            parentFirst,
            childFirst: childFirstName,
            bandLabel,
            interestSummary,
            scheduleUrl: SCHEDULE_URL,
          }),
        }),
      ]);
    } catch (err) {
      console.error("[league-interest] email send failed:", err);
    }
  }

  await ingestToOpenBrain({
    email,
    name: parentName,
    phone: phone || undefined,
    business: "nga",
    source: "nga_league_interest",
    interest: `League ${preferredBand}${childLevel ? ` · ${childLevel}` : ""}`,
    utm: {
      source: body.utm_source,
      medium: body.utm_medium,
      campaign: body.utm_campaign,
    },
    metadata: {
      child_first_name: childFirstName,
      child_age: childAge,
      child_birth_year: childBirthYear,
      preferred_band: preferredBand,
      child_level: childLevel || null,
      league_interest_source: source,
      notion_status: notionStatus,
      is_parent: true,
    },
  });

  return NextResponse.json({ success: true });
}
