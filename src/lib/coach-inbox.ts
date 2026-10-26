/**
 * Coach Inbox (admin-reduction Phase 1b) — assembly layer for the three
 * decision queues Sam previously worked as scattered Notion status flips:
 * newsletter-draft approval, crew-interest review, and CardFailed
 * crew-commit re-activation. (News triage was retired with the news scraper
 * on 2026-10-26: the weekly newsletter stopped rendering approved stories.)
 *
 * This lib owns (a) the one fetch that both /coach/inbox and the /coach
 * home-page badge share, so the badge count always equals the rows the inbox
 * displays, and (b) the decision→status maps: every status the inbox can
 * write is pinned here against the source lib's existing union — the inbox
 * NEVER invents a Notion status value. Pinned by e2e/coach-inbox.spec.ts.
 */

import {
  fetchPendingDrafts,
  fetchPendingDraftCount,
  type PendingNewsletterDraft,
  type NewsletterDraftStatus,
} from "@/lib/notion-newsletter-drafts";
import {
  fetchActionableCrewInterest,
  type ActionableCrewInterest,
  type CrewInterestReviewStatus,
} from "@/lib/notion-crew-interest";
import {
  fetchCardFailedCommits,
  type CrewCommit,
} from "@/lib/notion-crew-commits";

export const DRAFT_DECISION_TO_STATUS = {
  approve: "Approved",
  skip: "Skip",
} as const satisfies Record<string, Extract<NewsletterDraftStatus, "Approved" | "Skip">>;

export const CREW_DECISION_TO_STATUS = {
  reviewed: "Reviewed",
  closed: "Closed",
} as const satisfies Record<string, CrewInterestReviewStatus>;

export type DraftDecision = keyof typeof DRAFT_DECISION_TO_STATUS;
export type CrewDecision = keyof typeof CREW_DECISION_TO_STATUS;

export interface InboxQueues {
  drafts: PendingNewsletterDraft[];
  crew: ActionableCrewInterest[];
  cardFailed: CrewCommit[];
}

/** Count-only mirror of InboxQueues for the /coach home badge (F6). */
export interface InboxCounts {
  drafts: number;
  crew: number;
  cardFailed: number;
}

/**
 * The crew queue shows only Status=New submissions — a "Reviewed" row is a
 * decision Sam already made (the follow-up cron keeps working it), so it
 * would otherwise sit in the inbox forever and the badge would never clear.
 */
export function filterCrewInboxRows(
  rows: ActionableCrewInterest[],
): ActionableCrewInterest[] {
  return rows.filter((r) => r.status === "New");
}

// "Will this draft ride Thursday's send?" now lives with the cron's own
// query math: willRideThursdaySend in @/lib/notion-newsletter-drafts (F2 —
// eligibility is computed against the NEXT Thursday 22:00 UTC fire via the
// same shipWindowBounds helper queryApprovedRows uses, so the inbox hint and
// the cron filter can never drift).

/** Badge math: one number = everything waiting on a decision. */
export function inboxPendingCount(queues: InboxQueues): number {
  return (
    queues.drafts.length +
    queues.crew.length +
    queues.cardFailed.length
  );
}

/** Same badge math over the count-only shape (F6). */
export function inboxCountsTotal(counts: InboxCounts): number {
  return counts.drafts + counts.crew + counts.cardFailed;
}

/**
 * Fetch all three queues in parallel. Every underlying fetcher fails soft to
 * [] (missing env or a Notion blip), so a single dead DB never blanks the
 * whole inbox — and the extra allSettled guard keeps an unexpected throw in
 * one queue from taking down the others.
 */
export async function fetchInboxQueues(): Promise<InboxQueues> {
  const [drafts, crew, cardFailed] = await Promise.allSettled([
    fetchPendingDrafts(),
    fetchActionableCrewInterest(),
    fetchCardFailedCommits(),
  ]);
  return {
    drafts: drafts.status === "fulfilled" ? drafts.value : [],
    crew:
      crew.status === "fulfilled" ? filterCrewInboxRows(crew.value) : [],
    cardFailed: cardFailed.status === "fulfilled" ? cardFailed.value : [],
  };
}

/**
 * Count-only fetch for the /coach home badge (F6): O(3) Notion queries, and
 * crucially NO draft-body hydration — fetchPendingDrafts fetches each
 * pending row's blocks (an N+1 the badge never needs), so the home page uses
 * fetchPendingDraftCount instead. The full body-hydrating fetchInboxQueues
 * stays inbox-page-only. Same fail-soft posture: a dead queue counts 0.
 * (Drafts may over-count a row whose body would render empty — see
 * fetchPendingDraftCount; the badge still equals what the inbox shows in
 * every non-degenerate case.)
 */
export async function fetchInboxCounts(): Promise<InboxCounts> {
  const [draftCount, crew, cardFailed] = await Promise.allSettled([
    fetchPendingDraftCount(),
    fetchActionableCrewInterest(),
    fetchCardFailedCommits(),
  ]);
  return {
    drafts: draftCount.status === "fulfilled" ? draftCount.value : 0,
    crew:
      crew.status === "fulfilled"
        ? filterCrewInboxRows(crew.value).length
        : 0,
    cardFailed: cardFailed.status === "fulfilled" ? cardFailed.value.length : 0,
  };
}
