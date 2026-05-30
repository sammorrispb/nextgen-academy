import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import {
  findDropInPageByCheckoutId,
  markDropInFlag,
  updateDropInStatus,
  type DropInRegistration,
} from "@/lib/notion-dropins";
import {
  decrementSessionRegistered,
  findSessionIdByDateAndTime,
} from "@/lib/notion-sessions";
import { sessionToSlug } from "@/lib/session-slug";
import {
  cancelConfirmationHtml,
  cancelConfirmationText,
} from "@/lib/email/cancel-confirmation";
import { sendSms, cancelConfirmationSms } from "@/lib/sms";

export type CancelStatus = "Cancelled" | "Refunded";

export type CancelResult =
  | { ok: true; idempotent?: boolean; decremented: boolean; pageId: string }
  | { ok: false; reason: "not_found" | "update_failed" };

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

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

function formatShortDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Fire-and-not-thrown comms send. Bound to a successful Status flip in
 * cancelDropIn(). Suppressed if `Cancellation Notified` is already true —
 * that flag is owned jointly by this helper and the session-wide broadcast
 * (cancelSessionAction in /coach/[slug]/actions.ts) so we never double-send.
 *
 * Errors are logged and swallowed: a comms failure must not block the
 * cancel flow itself, which is the source of truth for the seat being
 * freed and the refund (if any) being recorded.
 */
async function sendCancelConfirmation(
  dropIn: DropInRegistration,
  newStatus: CancelStatus,
  refundedAmountUsd?: number,
): Promise<void> {
  if (dropIn.cancellationNotified) return;

  const parentFirst =
    (dropIn.parentName || "").split(/\s+/)[0] || "there";
  const childFirst = dropIn.childFirstName || "your player";
  const scheduleUrl = `${SITE_ORIGIN}/schedule`;
  const sessionDateLong = formatLongDate(dropIn.sessionDate);
  const sessionDateShort = formatShortDate(dropIn.sessionDate);
  // For a partial refund the coach passes the actual amount returned; default
  // to the full amount paid (full refund / webhook path).
  const amountUsd = (refundedAmountUsd ?? dropIn.amountPaidUsd).toFixed(2);

  let emailSent = false;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (
    resendApiKey &&
    dropIn.parentEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dropIn.parentEmail)
  ) {
    try {
      const resend = new Resend(resendApiKey);
      const subject = `Cancellation confirmed — ${dropIn.sessionTitle || sessionDateLong}`;
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: dropIn.parentEmail,
        bcc: ADMIN_EMAIL,
        replyTo: REPLY_TO,
        subject,
        html: cancelConfirmationHtml({
          parentFirst,
          childFirst,
          sessionTitle: dropIn.sessionTitle,
          sessionDateLong,
          sessionStart: dropIn.sessionStartTime,
          status: newStatus,
          amountUsd,
          scheduleUrl,
        }),
        text: cancelConfirmationText({
          parentFirst,
          childFirst,
          sessionTitle: dropIn.sessionTitle,
          sessionDateLong,
          sessionStart: dropIn.sessionStartTime,
          status: newStatus,
          amountUsd,
          scheduleUrl,
        }),
      });
      if (error) {
        console.error(
          "[cancel-dropin] Resend rejected cancel confirmation",
          error,
        );
      } else {
        emailSent = true;
      }
    } catch (err) {
      console.error("[cancel-dropin] cancel email threw", err);
    }
  }

  if (dropIn.parentPhone) {
    try {
      await sendSms({
        to: dropIn.parentPhone,
        body: cancelConfirmationSms({
          childFirst,
          sessionTitle: dropIn.sessionTitle,
          sessionDateShort,
          status: newStatus,
          scheduleUrl,
        }),
        consent: dropIn.smsConsent,
        tag: `cancel-confirm:${dropIn.id}`,
      });
    } catch (err) {
      console.error("[cancel-dropin] cancel sms threw", err);
    }
  }

  if (emailSent) {
    await markDropInFlag(dropIn.id, "Cancellation Notified");
  }
}

/**
 * Cancel or mark refunded a paid drop-in. Idempotent. Only decrements the
 * session's Registered count if the row was previously in Confirmed state.
 * Always revalidates /schedule and the session's slug page.
 *
 * Shared by /api/cancel-registration (manual curl), the Stripe
 * charge.refunded webhook handler, the coach-page server action, and the
 * parent self-serve cancel page. Sends a Coach-voice cancel confirmation
 * (email + opt-in SMS) on every non-idempotent flip — UNLESS the
 * Cancellation Notified flag is already true, which means the session-wide
 * broadcast already covered the parent.
 */
export async function cancelDropIn(
  checkoutSessionId: string,
  newStatus: CancelStatus,
  refundedAmountUsd?: number,
): Promise<CancelResult> {
  const dropIn = await findDropInPageByCheckoutId(checkoutSessionId);
  if (!dropIn) return { ok: false, reason: "not_found" };

  if (dropIn.status === newStatus) {
    return { ok: true, idempotent: true, decremented: false, pageId: dropIn.id };
  }

  const shouldDecrement = dropIn.status === "Confirmed";

  const updated = await updateDropInStatus(dropIn.id, newStatus);
  if (!updated) return { ok: false, reason: "update_failed" };

  if (shouldDecrement) {
    const sessionId = await findSessionIdByDateAndTime(
      dropIn.sessionDate,
      dropIn.sessionStartTime,
    );
    if (sessionId) await decrementSessionRegistered(sessionId, 1);
    // A two-hour bundle held a seat in the second slot too — free both.
    if (dropIn.secondSlotStartTime) {
      const secondId = await findSessionIdByDateAndTime(
        dropIn.secondSlotDate,
        dropIn.secondSlotStartTime,
      );
      if (secondId) await decrementSessionRegistered(secondId, 1);
    }
  }

  // Comms — send Coach-voice confirmation if we haven't already. Wrapped
  // so a comms failure doesn't roll back the cancel.
  await sendCancelConfirmation(dropIn, newStatus, refundedAmountUsd);

  revalidatePath("/schedule");
  if (dropIn.sessionTitle && dropIn.sessionDate) {
    const slug = sessionToSlug({
      title: dropIn.sessionTitle,
      date: dropIn.sessionDate,
    });
    if (slug) revalidatePath(`/schedule/${slug}`);
  }
  // Coach pages are dynamic but this keeps the cancellation reactive end-to-end.
  revalidatePath("/coach");

  return { ok: true, decremented: shouldDecrement, pageId: dropIn.id };
}
