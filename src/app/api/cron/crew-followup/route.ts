import { withCronAlert, type CronFailure } from "@/lib/cron-alert";
import { EMAIL_RE } from "@/lib/notion-utils";
import { Resend } from "resend";
import {
  fetchActionableCrewInterest,
  markCrewInterestFlag,
  type ActionableCrewInterest,
} from "@/lib/notion-crew-interest";
import { fetchUpcomingSessions } from "@/lib/notion-sessions";
import {
  findCandidateMatches,
  matchSessionsForPreferences,
  ageFromBirthYear,
  type CrewCandidate,
} from "@/lib/crew-matching";
import { crewFollowupStage } from "@/lib/crew-followup";
import {
  formatCrewSessionLines,
  type CrewSessionLine,
} from "@/lib/email/crew-session-lines";
import {
  crewFollowupParentHtml,
  crewFollowupParentSubject,
  crewFollowupParentText,
} from "@/lib/email/crew-followup-parent";
import { c, s } from "@/lib/email/brand";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "sam.morris2131@gmail.com";
const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

function toCandidate(row: ActionableCrewInterest): CrewCandidate {
  return {
    id: row.id,
    childFirstName: row.childFirstName,
    childBirthYear: row.childBirthYear,
    childLevel: row.childLevel,
    childSubLevel: row.childSubLevel,
    preferredDays: row.preferredDays,
    preferredArea: row.preferredArea,
  };
}

function preferredSummary(row: ActionableCrewInterest): string {
  const base = `${row.childLevel}${row.childSubLevel ? ` (${row.childSubLevel})` : ""} · ${row.preferredDays.join(", ")} · ${row.preferredTime}`;
  return row.preferredArea ? `${base} · near ${row.preferredArea}` : base;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface NudgeEntry {
  row: ActionableCrewInterest;
  candidateSummaries: string[];
  matchingSessions: number;
}

function buildDigestHtml(entries: NudgeEntry[], now: Date): string {
  const cards = entries
    .map((e) => {
      const age = ageFromBirthYear(e.row.childBirthYear, now);
      const matchLines = e.candidateSummaries.length
        ? e.candidateSummaries
            .map(
              (m) =>
                `<li style="margin:0 0 4px 0;color:${c.text};font-size:13px;">${esc(m)}</li>`,
            )
            .join("")
        : `<li style="margin:0;color:${c.muted};font-size:13px;">No other open submissions match yet.</li>`;
      return `<div style="${s.card}">
  <p style="margin:0 0 6px 0;color:${c.text};font-size:15px;font-weight:700;">${esc(e.row.childFirstName)} — ${esc(e.row.childLevel)}${e.row.childSubLevel ? ` (${esc(e.row.childSubLevel)})` : ""}${age !== null ? `, age ${age}` : ""}</p>
  <p style="margin:0 0 4px 0;color:${c.muted};font-size:13px;">${esc(e.row.preferredDays.join(", "))} · ${esc(e.row.preferredTime)}${e.row.preferredArea ? ` · ${esc(e.row.preferredArea)}` : ""}</p>
  <p style="margin:0 0 4px 0;color:${c.muted};font-size:13px;">Parent: ${esc(e.row.parentName)} · ${esc(e.row.parentEmail)}${e.row.parentPhone ? ` · ${esc(e.row.parentPhone)}` : ""}</p>
  <p style="margin:10px 0 4px 0;color:${c.accentLime};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Possible crew (${e.candidateSummaries.length}) · ${e.matchingSessions} open session${e.matchingSessions === 1 ? "" : "s"} fit</p>
  <ul style="margin:0;padding-left:18px;">${matchLines}</ul>
</div>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <h1 style="${s.heading} margin:0 0 8px 0;">Crew follow-up — ${entries.length} family${entries.length === 1 ? "" : "ies"} waiting 3+ days</h1>
    <p style="margin:0 0 20px 0;color:${c.muted};font-size:13px;line-height:1.5;">These Crew Interest rows haven't matched a crew yet. Below each is the strongest day/level/area overlap from other open submissions — enough to spin up a Crew Poll if a slot is taking shape.</p>
    ${cards}
    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:12px;">Automated nudge from the crew-followup cron. Parents at 7+ days get a re-engagement email separately.</p>
    </div>
  </div>
</body></html>`;
}

export const GET = withCronAlert("crew-followup", async () => {
  const failures: CronFailure[] = [];
  const now = new Date();
  const rows = await fetchActionableCrewInterest();

  // One sessions read, shared across every row's match. A miss used to be
  // console.error'd and swallowed — every match silently came back empty, so
  // parents got a "no matching sessions" email off broken data. Fail soft the
  // same way (still send) but alert.
  let sessions: Awaited<ReturnType<typeof fetchUpcomingSessions>> = [];
  try {
    sessions = await fetchUpcomingSessions();
  } catch (err) {
    console.error("[cron/crew-followup] sessions fetch failed:", err);
    // Class name only — raw exception text stays in the log line above.
    failures.push({
      signature: "sessions_fetch_failed",
      detail: err instanceof Error ? err.constructor.name : typeof err,
    });
  }

  const pool = rows.map(toCandidate);
  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  if (!resend) {
    console.warn(
      "[cron/crew-followup] RESEND_API_KEY missing — skipping all sends",
    );
  }

  const nudges: NudgeEntry[] = [];
  let reengaged = 0;
  let reengageErrors = 0;
  let reengageSkippedNoResend = 0;

  for (const row of rows) {
    const stage = crewFollowupStage(
      {
        createdTime: row.createdTime,
        nudgeSent: row.nudgeSent,
        reengagementSent: row.reengagementSent,
      },
      now,
    );
    if (stage === "none") continue;

    const matchedSessions: CrewSessionLine[] = formatCrewSessionLines(
      matchSessionsForPreferences(
        { level: row.childLevel, days: row.preferredDays, area: row.preferredArea },
        sessions,
      ),
      SITE_ORIGIN,
    );

    if (stage === "nudge") {
      const matches = findCandidateMatches(toCandidate(row), pool, now).slice(
        0,
        5,
      );
      const candidateSummaries = matches.map((m) => {
        const age = ageFromBirthYear(m.candidate.childBirthYear, now);
        return `${m.candidate.childFirstName}${age !== null ? ` (age ${age})` : ""} — ${m.sharedDays.join("/")}`;
      });
      nudges.push({
        row,
        candidateSummaries,
        matchingSessions: matchedSessions.length,
      });
      continue;
    }

    // stage === "reengage": parent email with matching open sessions.
    if (!resend && EMAIL_RE.test(row.parentEmail)) {
      reengageSkippedNoResend++;
    }
    if (resend && EMAIL_RE.test(row.parentEmail)) {
      const parentFirst = (row.parentName || "").split(/\s+/)[0] || "there";
      const childFirst = row.childFirstName || "your player";
      const input = {
        parentFirst,
        childFirst,
        preferredSummary: preferredSummary(row),
        matchedSessions,
        scheduleUrl: `${SITE_ORIGIN}/schedule`,
        crewUrl: `${SITE_ORIGIN}/crew`,
      };
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: row.parentEmail,
        bcc: CC_EMAIL,
        replyTo: REPLY_TO,
        subject: crewFollowupParentSubject({ childFirst }),
        html: crewFollowupParentHtml(input),
        text: crewFollowupParentText(input),
      });
      if (error) {
        reengageErrors++;
        console.error("[cron/crew-followup] reengage send failed", error);
        failures.push({
          signature: "reengage_send_failed",
          ref: row.id,
          detail: error.message ?? String(error),
        });
        continue; // Don't flag — retry next tick.
      }
      reengaged++;
      // Flip both flags so a stale nudge never fires after the bigger touch.
      // A false return = the write didn't stick → this parent gets the SAME
      // email again tomorrow. Surface it instead of silently duplicating.
      const reengFlagged = await markCrewInterestFlag(row.id, "Reengagement Sent");
      const nudgeFlagged = await markCrewInterestFlag(row.id, "Nudge Sent");
      if (!reengFlagged || !nudgeFlagged) {
        failures.push({
          signature: "flag_write_failed",
          ref: row.id,
          detail:
            "Reengagement/Nudge Sent flag did not stick; parent will be re-emailed next tick",
        });
      }
    }
  }

  // Single internal digest covering every 3-day nudge. Flag the rows only if
  // the digest actually sent, so a Resend failure replays them next tick.
  let digestSent = false;
  if (nudges.length && resend) {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      cc: CC_EMAIL,
      replyTo: REPLY_TO,
      subject: `Crew follow-up — ${nudges.length} family${nudges.length === 1 ? "" : "ies"} to review`,
      html: buildDigestHtml(nudges, now),
    });
    if (error) {
      console.error("[cron/crew-followup] digest send failed", error);
      failures.push({
        signature: "digest_send_failed",
        detail: error.message ?? String(error),
      });
    } else {
      digestSent = true;
      for (const n of nudges) {
        const flagged = await markCrewInterestFlag(n.row.id, "Nudge Sent");
        if (!flagged) {
          failures.push({
            signature: "flag_write_failed",
            ref: n.row.id,
            detail:
              "Nudge Sent flag did not stick; row repeats in tomorrow's digest",
          });
        }
      }
    }
  }

  // Due sends with no Resend key used to skip silently behind a 200.
  if (!resend && (nudges.length > 0 || reengageSkippedNoResend > 0)) {
    failures.push({
      signature: "resend_not_configured",
      detail: `${nudges.length} nudge(s) + ${reengageSkippedNoResend} re-engagement(s) due but RESEND_API_KEY is unset`,
    });
  }

  const summary = {
    actionable: rows.length,
    nudges: nudges.length,
    digest_sent: digestSent,
    reengaged,
    reengage_errors: reengageErrors,
  };
  console.log("[cron/crew-followup]", JSON.stringify(summary));
  return {
    attempted: reengaged + reengageErrors + (nudges.length > 0 ? 1 : 0),
    succeeded: reengaged + (digestSent ? 1 : 0),
    failures,
    body: summary,
  };
});
