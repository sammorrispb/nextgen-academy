import { revalidatePath } from "next/cache";
import {
  findDropInPageByCheckoutId,
  updateDropInStatus,
} from "@/lib/notion-dropins";
import {
  decrementSessionRegistered,
  findSessionIdByDateAndTime,
} from "@/lib/notion-sessions";
import { sessionToSlug } from "@/lib/session-slug";

export type CancelStatus = "Cancelled" | "Refunded";

export type CancelResult =
  | { ok: true; idempotent?: boolean; decremented: boolean; pageId: string }
  | { ok: false; reason: "not_found" | "update_failed" };

/**
 * Cancel or mark refunded a paid drop-in. Idempotent. Only decrements the
 * session's Registered count if the row was previously in Confirmed state.
 * Always revalidates /schedule and the session's slug page.
 *
 * Shared by /api/cancel-registration (manual curl) and the Stripe
 * charge.refunded webhook handler and the coach-page server action.
 */
export async function cancelDropIn(
  checkoutSessionId: string,
  newStatus: CancelStatus,
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
  }

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
