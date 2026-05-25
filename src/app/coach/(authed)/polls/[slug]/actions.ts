"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Resend } from "resend";
import {
  COACH_SESSION_COOKIE,
  verifySessionCookieValue,
} from "@/lib/coach-auth";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";
import {
  fetchPollBySlug,
  fetchPollResponses,
  updatePollStatus,
  type PollStatus,
} from "@/lib/notion-crew-polls";
import {
  crewConfirmedHtml,
  crewConfirmedText,
} from "@/lib/email/crew-confirmed";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

async function requireCoach(): Promise<string | null> {
  const c = await cookies();
  const value = c.get(COACH_SESSION_COOKIE)?.value;
  const email = value ? verifySessionCookieValue(value) : null;
  return email && isAllowedCoachEmail(email) ? email : null;
}

export interface ConfirmCrewResult {
  ok: boolean;
  message: string;
  emailsSent?: number;
}

export interface ConfirmCrewInput {
  pollSlug: string;
  selectedResponseIds: string[];
  firstSessionDate: string;
}

function formatLongDate(date: string): string {
  if (!date) return "TBD";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function confirmCrewAction(
  input: ConfirmCrewInput,
): Promise<ConfirmCrewResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };

  const poll = await fetchPollBySlug(input.pollSlug);
  if (!poll) return { ok: false, message: "Poll not found" };
  if (poll.status === "Confirmed" || poll.status === "Cancelled") {
    return { ok: false, message: `Poll is already ${poll.status}` };
  }

  if (!Array.isArray(input.selectedResponseIds) || input.selectedResponseIds.length === 0) {
    return { ok: false, message: "Pick at least one parent to notify" };
  }

  const all = await fetchPollResponses(poll.id);
  const selected = all.filter((r) => input.selectedResponseIds.includes(r.id));
  if (selected.length === 0) {
    return { ok: false, message: "Selected parents not found" };
  }

  const crewDescription = [
    poll.day,
    poll.startTime + (poll.endTime ? `–${poll.endTime}` : ""),
    poll.location,
    poll.level || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const firstSessionLong = formatLongDate(input.firstSessionDate);
  const scheduleUrl = `${SITE_ORIGIN}/schedule`;

  let sent = 0;
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    for (const r of selected) {
      if (!r.email) continue;
      const parentFirst = r.parentName.split(" ")[0] || r.parentName;
      try {
        const { error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: r.email,
          bcc: ADMIN_EMAIL,
          replyTo: ADMIN_EMAIL,
          subject: `${r.childFirstName}'s crew is set — book session 1`,
          html: crewConfirmedHtml({
            parentFirst,
            childFirst: r.childFirstName,
            crewDescription,
            firstSessionLong,
            scheduleUrl,
          }),
          text: crewConfirmedText({
            parentFirst,
            childFirst: r.childFirstName,
            crewDescription,
            firstSessionLong,
            scheduleUrl,
          }),
        });
        if (!error) sent += 1;
      } catch (err) {
        console.error("[confirmCrewAction] send failed", r.email, err);
      }
    }
  } else {
    console.warn("[confirmCrewAction] RESEND_API_KEY missing — skipping emails");
  }

  const nextStatus: PollStatus = "Confirmed";
  const flipped = await updatePollStatus(poll.id, nextStatus);
  if (!flipped) {
    return {
      ok: false,
      message: `Emailed ${sent}, but couldn't flip poll Status — update Notion manually`,
      emailsSent: sent,
    };
  }

  revalidatePath(`/coach/polls/${poll.slug}`);
  revalidatePath("/coach/polls");
  return {
    ok: true,
    message: `Crew confirmed · ${sent} parent${sent === 1 ? "" : "s"} emailed`,
    emailsSent: sent,
  };
}
