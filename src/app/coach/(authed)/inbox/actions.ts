"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/coach-auth-server";
import {
  NEWS_DECISION_TO_STATUS,
  DRAFT_DECISION_TO_STATUS,
  CREW_DECISION_TO_STATUS,
  type NewsDecision,
  type DraftDecision,
  type CrewDecision,
} from "@/lib/coach-inbox";
import { setNewsStatus } from "@/lib/notion-news";
import {
  setDraftStatus,
  fetchDraftShipFields,
  willRideThursdaySend,
} from "@/lib/notion-newsletter-drafts";
import { setCrewInterestStatus } from "@/lib/notion-crew-interest";
import { updateCommit } from "@/lib/notion-crew-commits";

// Coach Inbox actions — cookie-authed one-tap decisions over the four Notion
// queues. Every write goes through the existing vetted lib (setNewsStatus /
// setDraftStatus / setCrewInterestStatus / updateCommit) and every status
// value comes from the decision maps in @/lib/coach-inbox, which are pinned
// against each DB's existing vocabulary — nothing here can invent a status.
// Red lines held server-side (never just in the UI):
//   - draft approval re-reads the rendered body inside setDraftStatus and
//     refuses an empty render (approval is approval of READ content);
//   - CardFailed re-activation demands an explicit confirmed flag — one
//     informed tap, no auto-retry, and no Stripe call here (the daily
//     autoreserve cron owns the charge).
// Wiring pinned by e2e/invariant-coach-inbox-authz.spec.ts.

export interface InboxActionResult {
  ok: boolean;
  message: string;
  /**
   * Set on a refused draft approval that the coach may still push through
   * with an explicit second tap (force) — e.g. the draft is past the
   * freshness window and will NOT ship Thursday, but approving anyway is a
   * legitimate informed choice (F4: refuse by default, force to override).
   */
  needsForce?: boolean;
}

const UNAUTHORIZED: InboxActionResult = {
  ok: false,
  message: "Unauthorized — sign in again.",
};

function refreshInbox() {
  revalidatePath("/coach/inbox");
  revalidatePath("/coach"); // pending-count badge
}

function validPageId(pageId: unknown): pageId is string {
  return typeof pageId === "string" && pageId.trim().length > 0;
}

export async function triageNewsAction(
  pageId: string,
  decision: NewsDecision,
): Promise<InboxActionResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  if (!validPageId(pageId)) return { ok: false, message: "Missing row id." };
  const status = NEWS_DECISION_TO_STATUS[decision];
  if (!status) return { ok: false, message: "Unknown decision." };

  const ok = await setNewsStatus(pageId, status);
  if (!ok) return { ok: false, message: "Notion update failed — try again." };
  refreshInbox();
  return {
    ok: true,
    message:
      status === "Approved"
        ? "Approved — ships in Thursday's newsletter."
        : "Rejected.",
  };
}

/**
 * One action for both draft decisions (F8) — the decision value maps through
 * DRAFT_DECISION_TO_STATUS so nothing here can invent a Notion status.
 *
 * Approve additionally re-checks the Thursday ship window SERVER-SIDE (F4):
 * the row's Drafted At / Expires At are re-fetched (never trusted from the
 * client) and run through willRideThursdaySend — the same helper that mirrors
 * the cron's own query filter. Out-of-window (or unverifiable) approvals are
 * REFUSED by default with needsForce set; a second, explicit force tap
 * approves anyway with a message that never claims the draft rides the send
 * unless the cron filter would actually include it.
 */
export async function decideDraftAction(
  pageId: string,
  decision: DraftDecision,
  opts?: { force?: boolean },
): Promise<InboxActionResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  if (!validPageId(pageId)) return { ok: false, message: "Missing row id." };
  const status = DRAFT_DECISION_TO_STATUS[decision];
  if (!status) return { ok: false, message: "Unknown decision." };

  let ridesSend: boolean | null = null; // null = couldn't verify
  if (status === "Approved") {
    const fields = await fetchDraftShipFields(pageId);
    ridesSend = fields ? willRideThursdaySend(fields, new Date()) : null;
    if (!opts?.force) {
      if (ridesSend === null) {
        return {
          ok: false,
          needsForce: true,
          message:
            "Couldn't verify the freshness window — try again, or approve anyway (it may NOT ship Thursday).",
        };
      }
      if (!ridesSend) {
        return {
          ok: false,
          needsForce: true,
          message:
            "This draft is past the freshness window — it will NOT ship Thursday. Regenerate it (or bump Drafted At in Notion), or approve anyway.",
        };
      }
    }
  }

  const result = await setDraftStatus(pageId, status);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.error ?? (status === "Approved" ? "Approve failed." : "Skip failed."),
    };
  }
  refreshInbox();
  if (status !== "Approved") {
    return { ok: true, message: "Skipped — won't ship." };
  }
  if (ridesSend === true) {
    return { ok: true, message: "Approved — rides Thursday's send." };
  }
  return {
    ok: true,
    message:
      ridesSend === false
        ? "Approved — but it's past the freshness window, so it will NOT ship Thursday. Regenerate or bump Drafted At in Notion."
        : "Approved — but the freshness window couldn't be verified; check Notion whether it rides Thursday's send.",
  };
}

export async function reviewCrewInterestAction(
  pageId: string,
  decision: CrewDecision,
): Promise<InboxActionResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  if (!validPageId(pageId)) return { ok: false, message: "Missing row id." };
  const status = CREW_DECISION_TO_STATUS[decision];
  if (!status) return { ok: false, message: "Unknown decision." };

  const ok = await setCrewInterestStatus(pageId, status);
  if (!ok) return { ok: false, message: "Notion update failed — try again." };
  refreshInbox();
  return {
    ok: true,
    message:
      status === "Reviewed"
        ? "Marked reviewed — the follow-up loop keeps working it."
        : "Closed.",
  };
}

export async function reactivateCommitAction(
  pageId: string,
  opts: { confirmed: boolean },
): Promise<InboxActionResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  if (!validPageId(pageId)) return { ok: false, message: "Missing row id." };
  // One INFORMED tap is the ceiling for off-session charges: without the
  // explicit confirm this action refuses — the gate lives here, not the UI.
  if (opts?.confirmed !== true) {
    return {
      ok: false,
      message: "Re-activation needs the confirm step — no charge was armed.",
    };
  }

  const ok = await updateCommit(pageId, { status: "Active" });
  if (!ok) return { ok: false, message: "Notion update failed — try again." };
  refreshInbox();
  return {
    ok: true,
    message:
      "Back to Active — the stored card will be charged on the next daily autoreserve run.",
  };
}
