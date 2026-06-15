import { Resend } from "resend";
import {
  fetchPollBySlug,
  fetchPollResponses,
  updatePollStatus,
  type PollStatus,
} from "@/lib/notion-crew-polls";
import { crewConfirmedHtml, crewConfirmedText } from "@/lib/email/crew-confirmed";

/**
 * Shared crew-confirm fan-out — the single path behind both the coach
 * `confirmCrewAction` (button) and the agent-callable `POST /api/coach/crew-confirm`
 * (Bearer). It validates the poll, emails every selected parent the
 * crew-confirmed note, then flips the poll Status to "Confirmed". Pulling it out
 * of the "use server" action means an out-of-band caller fires the IDENTICAL
 * fan-out instead of writing the Notion Status directly and silently dropping
 * the parent emails.
 *
 * Auth and request-scoped `revalidatePath` stay with the callers (the action has
 * a coach session to refresh; the agent route does not), exactly as attendance
 * keeps OB fire-and-forget in the action but awaits it on the route.
 */

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

export interface ConfirmCrewInput {
  pollSlug: string;
  selectedResponseIds: string[];
  firstSessionDate: string;
}

export interface ConfirmCrewResult {
  ok: boolean;
  message: string;
  emailsSent?: number;
  /** Present on success/idempotent so a caller can revalidate the slug. */
  slug?: string;
  /** True when the poll was already Confirmed/Cancelled — a no-op (no email, no
   *  Status write). Lets retry-happy agent callers be idempotent. */
  idempotent?: boolean;
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

export async function confirmCrew(
  input: ConfirmCrewInput,
): Promise<ConfirmCrewResult> {
  const poll = await fetchPollBySlug(input.pollSlug);
  if (!poll) return { ok: false, message: "Poll not found" };
  if (poll.status === "Confirmed" || poll.status === "Cancelled") {
    // Idempotency guard: a re-fire on an already-decided poll skips the email
    // loop AND the Status write so an agent retry never re-emails a locked crew.
    return {
      ok: false,
      message: `Poll is already ${poll.status}`,
      idempotent: true,
      slug: poll.slug,
    };
  }

  if (
    !Array.isArray(input.selectedResponseIds) ||
    input.selectedResponseIds.length === 0
  ) {
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
        console.error("[confirmCrew] send failed", r.email, err);
      }
    }
  } else {
    console.warn("[confirmCrew] RESEND_API_KEY missing — skipping emails");
  }

  const nextStatus: PollStatus = "Confirmed";
  const flipped = await updatePollStatus(poll.id, nextStatus);
  if (!flipped) {
    return {
      ok: false,
      message: `Emailed ${sent}, but couldn't flip poll Status — update Notion manually`,
      emailsSent: sent,
      slug: poll.slug,
    };
  }

  return {
    ok: true,
    message: `Crew confirmed · ${sent} parent${sent === 1 ? "" : "s"} emailed`,
    emailsSent: sent,
    slug: poll.slug,
  };
}
