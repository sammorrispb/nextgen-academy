import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { Resend } from "resend";
import { site } from "@/data/site";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import {
  validateCrewInterestForm,
  type CrewInterestFormData,
  type CrewLevel,
  type CrewDay,
  type CrewTimeOfDay,
  type CrewSubLevel,
} from "@/lib/validate-crew-interest";
import { forwardToCohortPool } from "@/lib/forward-to-cohort-pool";
import { createCrewInterest } from "@/lib/notion-crew-interest";
import { fetchUpcomingSessions } from "@/lib/notion-sessions";
import { matchSessionsForPreferences } from "@/lib/crew-matching";
import {
  formatCrewSessionLines,
  type CrewSessionLine,
} from "@/lib/email/crew-session-lines";
import {
  crewInterestWelcomeHtml,
  crewInterestWelcomeSubject,
  crewInterestWelcomeText,
} from "@/lib/email/crew-interest-welcome";
import { getClusterBySlug, resolveClusterSlug } from "@/lib/clusters";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const NEWSLETTER_URL = "https://nextgenpbacademy.com/newsletter";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

// Per-route in-memory rate limit (5/hr, resets on deploy) — shared impl in
// src/lib/rate-limit.ts; each route keeps its own bucket, as before.
const { isRateLimited } = createRateLimiter();

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  let body: Partial<CrewInterestFormData>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validateCrewInterestForm(body);
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
  const childLevel = body.childLevel as CrewLevel;
  const childSubLevel = (body.childSubLevel || "") as CrewSubLevel | "";
  const preferredDays = (body.preferredDays ?? []) as CrewDay[];
  const preferredTimeOfDay = (body.preferredTimeOfDay ?? []) as CrewTimeOfDay[];
  const preferredTime = body.preferredTime!.trim().slice(0, 200);
  const preferredLocation = body.preferredLocation?.trim().slice(0, 200) ?? "";
  const friendsWanted = body.friendsWanted?.trim().slice(0, 600) ?? "";
  const notes = body.notes?.trim().slice(0, 1900) ?? "";
  const source = body.source ?? "Web";
  const parentFirst = parentName.split(" ")[0] || parentName;

  // Cluster attribution from /clusters/[area] CTA. Legacy color slugs (teal/
  // lime/orange/cyan) from stale links resolve to their area; unknown slugs
  // silently drop so a stale link can never produce a 400 — best-effort.
  const clusterSlug = resolveClusterSlug(body.cluster);
  const cluster = clusterSlug ? getClusterBySlug(clusterSlug) : undefined;

  // Append cluster preference to notes so it lands in the existing Notion
  // notes column (no schema migration needed for v1; cluster filter is a
  // text search on the rich_text Notes property).
  const notesWithCluster = cluster
    ? [notes, `Preferred cluster: ${cluster.name}`].filter(Boolean).join("\n")
    : notes;

  const preferredSummary = `${childLevel} · ${preferredDays.join(", ")} · ${preferredTime}${preferredLocation ? ` · near ${preferredLocation}` : ""}`;

  // Notion write — fails soft. The welcome email and Open Brain ingest still
  // run so Sam has a copy of every submission via BCC + analytics.
  let notionStatus = "skipped";
  if (process.env.NOTION_API_KEY && process.env.NOTION_CREW_INTEREST_DB_ID) {
    try {
      const result = await createCrewInterest({
        parentName,
        email,
        phone,
        childFirstName,
        childBirthYear,
        childLevel,
        childSubLevel,
        preferredDays,
        preferredTime,
        preferredLocation,
        friendsWanted,
        notes: notesWithCluster,
        source,
        marketingOptIn: true,
      });
      notionStatus = result.ok ? "created" : `failed: ${result.error}`;
      if (!result.ok) console.error("[crew-interest]", result.error);
    } catch (err) {
      notionStatus = "error";
      console.error("[crew-interest] notion error:", err);
    }
  }

  // Open sessions that already fit this family — surfaced in the welcome email
  // so they can drop in this week while the crew forms. Fail-soft: a Notion
  // hiccup just means the email shows the generic schedule CTA instead.
  let matchedSessions: CrewSessionLine[] = [];
  try {
    const sessions = await fetchUpcomingSessions();
    const matched = matchSessionsForPreferences(
      { level: childLevel, days: preferredDays, area: preferredLocation },
      sessions,
    );
    matchedSessions = formatCrewSessionLines(matched, SITE_ORIGIN);
  } catch (err) {
    console.error("[crew-interest] session match failed:", err);
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[crew-interest] RESEND_API_KEY missing — skipping emails");
  } else {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const adminHtml = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 24px;">
    New Crew Interest
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8; width: 140px;">Parent</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(parentName)}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Email</td><td style="padding: 10px 8px;"><a href="mailto:${escape(email)}" style="color: #00D4FF;">${escape(email)}</a></td></tr>
    ${phone ? `<tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Phone</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(phone)}</td></tr>` : ""}
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Child</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(childFirstName)} (age ${childAge}, ${escape(childLevel)})</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Days</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(preferredDays.join(", "))}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Time</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(preferredTime)}</td></tr>
    ${preferredLocation ? `<tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Location</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(preferredLocation)}</td></tr>` : ""}
    ${friendsWanted ? `<tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Friends</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(friendsWanted)}</td></tr>` : ""}
    ${notes ? `<tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Notes</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(notes)}</td></tr>` : ""}
    ${cluster ? `<tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Cluster</td><td style="padding: 10px 8px; color: #EEF2FF;">${escape(cluster.name)}</td></tr>` : ""}
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
          subject: `Crew Interest — ${childFirstName} (${childLevel}, ${preferredDays.join("/")})${cluster ? ` · ${cluster.name}` : ""}`,
          html: adminHtml,
        }),
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          bcc: CC_EMAIL,
          replyTo: site.email,
          subject: crewInterestWelcomeSubject({ childFirst: childFirstName, cluster }),
          html: crewInterestWelcomeHtml({
            parentFirst,
            childFirst: childFirstName,
            preferredSummary,
            newsletterUrl: NEWSLETTER_URL,
            matchedSessions,
            cluster,
          }),
          text: crewInterestWelcomeText({
            parentFirst,
            childFirst: childFirstName,
            preferredSummary,
            newsletterUrl: NEWSLETTER_URL,
            matchedSessions,
            cluster,
          }),
        }),
      ]);
    } catch (err) {
      console.error("[crew-interest] email send failed:", err);
    }
  }

  await ingestToOpenBrain({
    email,
    name: parentName,
    phone: phone || undefined,
    business: "nga",
    source: "nga_crew_interest",
    interest: `${childLevel} · ${preferredDays.join("/")} · ${preferredTime}`,
    utm: {
      source: body.utm_source,
      medium: body.utm_medium,
      campaign: body.utm_campaign,
    },
    metadata: {
      child_first_name: childFirstName,
      child_age: childAge,
      child_level: childLevel,
      child_sub_level: childSubLevel || null,
      preferred_days: preferredDays,
      preferred_time: preferredTime,
      preferred_location: preferredLocation || null,
      friends_wanted: friendsWanted || null,
      crew_interest_source: source,
      notion_status: notionStatus,
      cluster: cluster?.slug ?? null,
      cluster_name: cluster?.name ?? null,
      is_parent: true,
    },
  });

  // Feed the Coach OS cohort pool so this Crew interest is auto-matched +
  // invoiced from the /cohorts dashboard. Fail-open — never blocks the response.
  await forwardToCohortPool({
    childFirstName,
    parentName,
    email,
    phone,
    childAge,
    childLevel,
    preferredDays,
    preferredTimeOfDay,
    preferredLocation,
    utm: {
      source: body.utm_source,
      medium: body.utm_medium,
      campaign: body.utm_campaign,
    },
  });

  return NextResponse.json({ success: true });
}
