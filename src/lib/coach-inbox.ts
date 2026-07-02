/**
 * Coach Inbox (admin-reduction Phase 1b) — assembly layer for the four
 * decision queues Sam previously worked as scattered Notion status flips:
 * news triage, newsletter-draft approval, crew-interest review, and
 * CardFailed crew-commit re-activation.
 *
 * This lib owns (a) the one fetch that both /coach/inbox and the /coach
 * home-page badge share, so the badge count always equals the rows the inbox
 * displays, and (b) the decision→status maps: every status the inbox can
 * write is pinned here against the source lib's existing union — the inbox
 * NEVER invents a Notion status value. Pinned by e2e/coach-inbox.spec.ts.
 */

import { fetchNewNews, type NewsRow, type NewsStatus } from "@/lib/notion-news";
import {
  fetchPendingDrafts,
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

export const NEWS_DECISION_TO_STATUS = {
  approve: "Approved",
  reject: "Rejected",
} as const satisfies Record<string, NewsStatus>;

export const DRAFT_DECISION_TO_STATUS = {
  approve: "Approved",
  skip: "Skip",
} as const satisfies Record<string, Extract<NewsletterDraftStatus, "Approved" | "Skip">>;

export const CREW_DECISION_TO_STATUS = {
  reviewed: "Reviewed",
  closed: "Closed",
} as const satisfies Record<string, CrewInterestReviewStatus>;

export type NewsDecision = keyof typeof NEWS_DECISION_TO_STATUS;
export type DraftDecision = keyof typeof DRAFT_DECISION_TO_STATUS;
export type CrewDecision = keyof typeof CREW_DECISION_TO_STATUS;

export interface InboxQueues {
  news: NewsRow[];
  drafts: PendingNewsletterDraft[];
  crew: ActionableCrewInterest[];
  cardFailed: CrewCommit[];
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

/**
 * The weekly cron only ships drafts whose Drafted At is within the last
 * 7 days (on_or_after, date-only) — surface that so Sam knows whether an
 * approval will actually ride Thursday's send. Garbage/empty dates read as
 * stale, never throw.
 */
export function isDraftWithinShipWindow(draftedAt: string, now: Date): boolean {
  if (!draftedAt) return false;
  const drafted = Date.parse(
    draftedAt.includes("T") ? draftedAt : `${draftedAt}T00:00:00.000Z`,
  );
  if (Number.isNaN(drafted)) return false;
  const cutoffDay = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  // Compare on the date-only cutoff exactly like the cron's on_or_after.
  return draftedAt.slice(0, 10) >= cutoffDay && drafted <= now.getTime();
}

/** Badge math: one number = everything waiting on a decision. */
export function inboxPendingCount(queues: InboxQueues): number {
  return (
    queues.news.length +
    queues.drafts.length +
    queues.crew.length +
    queues.cardFailed.length
  );
}

/**
 * Fetch all four queues in parallel. Every underlying fetcher fails soft to
 * [] (missing env or a Notion blip), so a single dead DB never blanks the
 * whole inbox — and the extra allSettled guard keeps an unexpected throw in
 * one queue from taking down the others.
 */
export async function fetchInboxQueues(): Promise<InboxQueues> {
  const [news, drafts, crew, cardFailed] = await Promise.allSettled([
    fetchNewNews(),
    fetchPendingDrafts(),
    fetchActionableCrewInterest(),
    fetchCardFailedCommits(),
  ]);
  return {
    news: news.status === "fulfilled" ? news.value : [],
    drafts: drafts.status === "fulfilled" ? drafts.value : [],
    crew:
      crew.status === "fulfilled" ? filterCrewInboxRows(crew.value) : [],
    cardFailed: cardFailed.status === "fulfilled" ? cardFailed.value : [],
  };
}
