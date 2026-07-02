"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/coach-auth-server";
import {
  NEWS_DECISION_TO_STATUS,
  DRAFT_DECISION_TO_STATUS,
  CREW_DECISION_TO_STATUS,
  type NewsDecision,
  type CrewDecision,
} from "@/lib/coach-inbox";
import { setNewsStatus } from "@/lib/notion-news";
import { setDraftStatus } from "@/lib/notion-newsletter-drafts";
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

export async function approveDraftAction(
  pageId: string,
): Promise<InboxActionResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  if (!validPageId(pageId)) return { ok: false, message: "Missing row id." };

  const result = await setDraftStatus(pageId, DRAFT_DECISION_TO_STATUS.approve);
  if (!result.ok) {
    return { ok: false, message: result.error ?? "Approve failed." };
  }
  refreshInbox();
  return { ok: true, message: "Approved — rides Thursday's 6pm ET send." };
}

export async function skipDraftAction(
  pageId: string,
): Promise<InboxActionResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  if (!validPageId(pageId)) return { ok: false, message: "Missing row id." };

  const result = await setDraftStatus(pageId, DRAFT_DECISION_TO_STATUS.skip);
  if (!result.ok) {
    return { ok: false, message: result.error ?? "Skip failed." };
  }
  refreshInbox();
  return { ok: true, message: "Skipped — won't ship." };
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
