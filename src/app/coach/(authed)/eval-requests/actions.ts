"use server";

// Server actions for the /coach/eval-requests queue (flow change 2026-07-02:
// parent bookings are REQUESTS until Sam confirms). Thin requireCoach
// wrappers over the shared cores — confirmEvalRequest (which reuses
// sendEvalConfirmation UNCHANGED; trigger parity pinned by
// e2e/invariant-eval-confirmation-trigger-parity.spec.ts) and the CONDITIONAL
// releaseEvalSlot (Booking-Id-guarded; race behavior pinned by
// e2e/invariant-eval-book-egress.spec.ts). No fan-out lives here.

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/coach-auth-server";
import { confirmEvalRequest, releaseEvalSlot } from "@/lib/notion-eval-slots";

export interface EvalRequestActionResult {
  ok: boolean;
  message: string;
}

/** Confirm: fires the real parent confirmation (+ .ics + CRM Eval-Date
 * stamp) via the shared engine, then promotes the row Requested → Booked. */
export async function confirmEvalRequestAction(
  slotId: string,
  bookingId: string,
): Promise<EvalRequestActionResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized — sign in again." };

  const result = await confirmEvalRequest(slotId, bookingId);
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/coach/eval-requests");
  const crmNote = result.crmUpdated
    ? "CRM Eval Date stamped."
    : "Sent (CRM row not found — stamp it manually if needed).";
  const statusNote = result.statusPatched
    ? ""
    : " Status update failed — mark the row Booked in Notion.";
  return {
    ok: true,
    message: `Confirmation sent to ${result.to}. ${crmNote}${statusNote}`,
  };
}

/** Release / reschedule: reopens the slot (conditional on the Booking Id —
 * never clears a row another booking now owns). NO automated email to the
 * parent in v1 — Sam reaches out personally using the contact info on the
 * queue row. */
export async function releaseEvalRequestAction(
  slotId: string,
  bookingId: string,
): Promise<EvalRequestActionResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized — sign in again." };

  const result = await releaseEvalSlot(slotId, bookingId);
  revalidatePath("/coach/eval-requests");
  if (result === "released") {
    return {
      ok: true,
      message:
        "Slot reopened. Reach out to the family directly to reschedule — no email was sent.",
    };
  }
  if (result === "kept_foreign") {
    return {
      ok: false,
      message:
        "Row changed since this page loaded (another booking owns it now) — refresh the queue.",
    };
  }
  return { ok: false, message: "Release failed — check the Eval Slots db in Notion." };
}
