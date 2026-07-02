import { withCronAlert, type CronFailure } from "@/lib/cron-alert";
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
import {
  postSessionRebookHtml,
  postSessionRebookText,
} from "@/lib/email/post-session-rebook";
import { buildCrewId, signCommitToken } from "@/lib/commit-token";
import { sessionToSlug } from "@/lib/session-slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
// Real-time admin alerts go to both the academy inbox and Sam's personal inbox.
const ADMIN_NOTIFY = [ADMIN_EMAIL, "sam.morris2131@gmail.com"];
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

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

// Short date for the subject line — keeps it under the ~50-char target while
// still naming the exact day (e.g. "Sat, Jun 6") instead of "yesterday".
function formatShortDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
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

// Present → recap + book-next. No-show → a warm blame-free rebook nudge. The
// follow-up branches on the attendance the coach submitted at check-in; rows
// with no attendance recorded are handled separately (held + admin nudge).
async function sendOne(
  resend: Resend | null,
  row: DropInRegistration,
  kind: "present" | "noshow",
): Promise<SendOutcome> {
  const childFirst = row.childFirstName || "your player";
  const parentFirst = (row.parentName || "").split(/\s+/)[0] || "there";
  const sessionDateLong = formatLongDate(row.sessionDate);
  const scheduleUrl = `${SITE_ORIGIN}/schedule`;

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

  let subject: string;
  let html: string;
  let text: string;

  if (kind === "noshow") {
    subject = `We missed ${childFirst} — the next session is open`;
    html = postSessionRebookHtml({
      parentFirst,
      childFirst,
      sessionTitle: row.sessionTitle,
      sessionDateLong,
      scheduleUrl,
    });
    text = postSessionRebookText({
      parentFirst,
      childFirst,
      sessionTitle: row.sessionTitle,
      sessionDateLong,
      scheduleUrl,
    });
  } else {
    // The 4-week commit upsell only makes sense for someone who showed up.
    const commitUrl = await buildCommitUrl(row);
    subject = `${childFirst} got reps in ${formatShortDate(row.sessionDate)} — what's next`;
    html = postSessionHtml({
      parentFirst,
      childFirst,
      sessionTitle: row.sessionTitle,
      sessionDateLong,
      scheduleUrl,
      commitUrl,
    });
    text = postSessionText({
      parentFirst,
      childFirst,
      sessionTitle: row.sessionTitle,
      sessionDateLong,
      scheduleUrl,
      commitUrl,
    });
  }

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

// One summary email to the admins when a session's attendance was never
// submitted — so the parents aren't emailed off stale data and Sam knows to
// check the kids in. Held rows keep their Post Session Sent flag unset, so a
// re-fire after attendance is submitted picks them up.
async function sendAttendanceNudge(
  resend: Resend | null,
  blankRows: DropInRegistration[],
): Promise<boolean> {
  if (!resend || blankRows.length === 0) return false;

  // Group held rows by their session so the nudge links to one coach page each.
  const bySession = new Map<
    string,
    { title: string; date: string; kids: string[] }
  >();
  for (const r of blankRows) {
    const key = `${r.sessionTitle}|${r.sessionDate}`;
    const entry = bySession.get(key) ?? {
      title: r.sessionTitle,
      date: r.sessionDate,
      kids: [],
    };
    entry.kids.push(r.childFirstName || "(no name)");
    bySession.set(key, entry);
  }

  const blocks: string[] = [];
  for (const { title, date, kids } of bySession.values()) {
    const slug = sessionToSlug({ title, date });
    const coachUrl = slug ? `${SITE_ORIGIN}/coach/${slug}` : `${SITE_ORIGIN}/coach`;
    blocks.push(
      [
        `${title} — ${formatLongDate(date)}`,
        `  ${kids.length} player(s) with no attendance: ${kids.join(", ")}`,
        `  Check them in: ${coachUrl}`,
      ].join("\n"),
    );
  }

  const subject = `Attendance not submitted — ${blankRows.length} drop-in(s)`;
  const text = [
    `Attendance wasn't recorded for ${blankRows.length} confirmed drop-in(s).`,
    `No post-session email was sent to these parents (we don't email off unconfirmed attendance).`,
    ``,
    blocks.join("\n\n"),
    ``,
    `Mark each player Present or No-show, then re-run the post-session cron to send their follow-up. Marking attendance also updates the player's attendance count immediately.`,
  ].join("\n");

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    subject,
    text,
  });
  if (error) {
    console.error(
      "[cron/dropin-post-session] attendance nudge rejected",
      error.message ?? String(error),
    );
    return false;
  }
  return true;
}

export const GET = withCronAlert("dropin-post-session", async () => {
  const targetIso = yesterdayEtIso();
  // Confirmed-only window. We don't email post-session recaps to rows that
  // ended up Cancelled or Refunded — those parents already got a Coach-
  // voice cancellation broadcast.
  const candidates = await fetchUpcomingDropIns(targetIso, targetIso, {
    revalidate: 0,
  });
  const unsent = candidates.filter((r) => !r.postSessionSent);

  // Branch on the attendance the coach submitted at check-in:
  //   Present  → recap + book-next email
  //   No-show  → warm rebook nudge
  //   (blank)  → HELD: no parent email, flag left unset so a re-fire after the
  //              coach submits attendance picks it up; the admins get one nudge.
  const present = unsent.filter((r) => r.attendance === "Present");
  const noShow = unsent.filter((r) => r.attendance === "No-show");
  const blank = unsent.filter((r) => r.attendance !== "Present" && r.attendance !== "No-show");

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  if (!resend) {
    console.warn("[cron/dropin-post-session] RESEND_API_KEY missing — skipping sends");
  }

  const outcomes: SendOutcome[] = [];
  for (const row of present) {
    outcomes.push(await sendOne(resend, row, "present"));
  }
  for (const row of noShow) {
    outcomes.push(await sendOne(resend, row, "noshow"));
  }
  const adminNudged = await sendAttendanceNudge(resend, blank);

  // Per-item failures the old version console.error'd behind a 200. A held
  // roster with a failed admin nudge means the "attendance missing" signal
  // never reached Sam — that's a failure too.
  const failures: CronFailure[] = [];
  for (const o of outcomes) {
    if (o.error) {
      failures.push({
        signature:
          o.error === "no_resend_or_email" ? "no_resend_or_email" : "resend_rejected",
        ref: o.pageId,
        detail: o.error,
      });
    }
    if (o.emailSent && !o.flagged) {
      failures.push({
        signature: "flag_write_failed",
        ref: o.pageId,
        detail: "Post Session Sent flag did not stick; row will re-send next tick",
      });
    }
  }
  if (blank.length > 0 && resend && !adminNudged) {
    failures.push({
      signature: "attendance_nudge_failed",
      detail: `${blank.length} held drop-in(s), admin nudge did not send`,
    });
  }

  const summary = {
    target_date_et: targetIso,
    candidates: candidates.length,
    skipped_already_sent: candidates.length - unsent.length,
    present_sent: outcomes.filter((o) => o.emailSent && present.some((p) => p.id === o.pageId)).length,
    noshow_sent: outcomes.filter((o) => o.emailSent && noShow.some((n) => n.id === o.pageId)).length,
    held_no_attendance: blank.length,
    admin_nudged: adminNudged,
    errors: outcomes.filter((o) => o.error).length,
  };
  console.log("[cron/dropin-post-session]", JSON.stringify(summary));

  return {
    ok: failures.length === 0,
    attempted: outcomes.length,
    succeeded: outcomes.filter((o) => o.emailSent).length,
    failures,
    body: {
      ...summary,
      outcomes: outcomes.map((o) => ({
        pageId: o.pageId,
        childFirst: o.childFirst,
        emailSent: o.emailSent,
        flagged: o.flagged,
        ...(o.error ? { error: o.error } : {}),
      })),
      held: blank.map((r) => ({ pageId: r.id, childFirst: r.childFirstName })),
    },
  };
});
