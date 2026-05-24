import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  fetchUpcomingDropIns,
  markDropInFlag,
  type DropInRegistration,
} from "@/lib/notion-dropins";
import {
  fetchSessionById,
  findSessionIdByDateAndTime,
} from "@/lib/notion-sessions";
import {
  postSessionHtml,
  postSessionText,
} from "@/lib/email/post-session";
import { buildCrewId, signCommitToken } from "@/lib/commit-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";

/**
 * Yesterday's ISO date (YYYY-MM-DD) in America/New_York. Same shape as the
 * 24h-reminder cron's tomorrowEtIso, mirrored here so the two crons can
 * diverge independently if scheduling logic ever changes.
 */
function yesterdayEtIso(now: Date = new Date()): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(yesterday);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

function formatLongDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface SendOutcome {
  pageId: string;
  parentEmail: string;
  childFirst: string;
  emailSent: boolean;
  flagged: boolean;
  error?: string;
}

async function buildCommitUrl(
  row: DropInRegistration,
): Promise<string | undefined> {
  if (!row.parentEmail || !row.childFirstName) return undefined;
  const sessionId = await findSessionIdByDateAndTime(
    row.sessionDate,
    row.sessionStartTime,
  );
  if (!sessionId) return undefined;
  const session = await fetchSessionById(sessionId);
  if (!session || !session.level) return undefined;
  const crewId = buildCrewId({
    level: session.level,
    date: row.sessionDate,
    startTime: row.sessionStartTime,
    location: row.location,
  });
  const token = signCommitToken({
    parentEmail: row.parentEmail,
    childFirstName: row.childFirstName,
    crewId,
  });
  if (!token) return undefined;
  return `${SITE_ORIGIN}/commit/${token}`;
}

async function sendOne(
  resend: Resend | null,
  row: DropInRegistration,
): Promise<SendOutcome> {
  const childFirst = row.childFirstName || "your player";
  const parentFirst = (row.parentName || "").split(/\s+/)[0] || "there";
  const sessionDateLong = formatLongDate(row.sessionDate);
  const scheduleUrl = `${SITE_ORIGIN}/schedule`;
  const commitUrl = await buildCommitUrl(row);

  const outcome: SendOutcome = {
    pageId: row.id,
    parentEmail: row.parentEmail,
    childFirst,
    emailSent: false,
    flagged: false,
  };

  if (
    !resend ||
    !row.parentEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.parentEmail)
  ) {
    outcome.error = "no_resend_or_email";
    return outcome;
  }

  const subject = `${childFirst} got reps in yesterday — what's next`;
  const html = postSessionHtml({
    parentFirst,
    childFirst,
    sessionTitle: row.sessionTitle,
    sessionDateLong,
    scheduleUrl,
    commitUrl,
  });
  const text = postSessionText({
    parentFirst,
    childFirst,
    sessionTitle: row.sessionTitle,
    sessionDateLong,
    scheduleUrl,
    commitUrl,
  });

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: row.parentEmail,
    bcc: ADMIN_EMAIL,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
  });
  if (error) {
    outcome.error = `resend: ${error.message ?? String(error)}`;
    console.error("[cron/dropin-post-session] Resend rejected", outcome.error);
    return outcome;
  }
  outcome.emailSent = true;
  outcome.flagged = await markDropInFlag(row.id, "Post Session Sent");
  return outcome;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetIso = yesterdayEtIso();
  // Confirmed-only window. We don't email post-session recaps to rows that
  // ended up Cancelled or Refunded — those parents already got a Coach-
  // voice cancellation broadcast.
  const candidates = await fetchUpcomingDropIns(targetIso, targetIso, {
    revalidate: 0,
  });
  const toSend = candidates.filter((r) => !r.postSessionSent);

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  if (!resend) {
    console.warn("[cron/dropin-post-session] RESEND_API_KEY missing — skipping sends");
  }

  const outcomes: SendOutcome[] = [];
  for (const row of toSend) {
    outcomes.push(await sendOne(resend, row));
  }

  const summary = {
    target_date_et: targetIso,
    candidates: candidates.length,
    skipped_already_sent: candidates.length - toSend.length,
    attempted: toSend.length,
    email_sent: outcomes.filter((o) => o.emailSent).length,
    errors: outcomes.filter((o) => o.error).length,
  };
  console.log("[cron/dropin-post-session]", JSON.stringify(summary));

  return NextResponse.json({
    ok: true,
    ...summary,
    outcomes: outcomes.map((o) => ({
      pageId: o.pageId,
      childFirst: o.childFirst,
      emailSent: o.emailSent,
      flagged: o.flagged,
      ...(o.error ? { error: o.error } : {}),
    })),
  });
}
