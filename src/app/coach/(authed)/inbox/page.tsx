import Link from "next/link";
import {
  fetchInboxQueues,
  inboxPendingCount,
  pendingBadgeLabel,
} from "@/lib/coach-inbox";
import {
  willRideThursdaySend,
  nextNewsletterFire,
  formatNewsletterDeadline,
} from "@/lib/notion-newsletter-drafts";
import { newsLinkHref } from "@/lib/notion-news";
import { formatLongDate } from "@/lib/format-date";
import {
  NewsRowActions,
  DraftCard,
  CrewRowActions,
  CommitReactivate,
} from "./InboxRows";

export const dynamic = "force-dynamic";

function SectionHeader({
  title,
  count,
  hint,
}: {
  title: string;
  count: number;
  hint: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="font-heading text-xl font-black text-ngpa-white tracking-tight flex items-center gap-2">
        {title}
        {count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-ngpa-teal text-ngpa-navy text-xs font-black">
            {count}
          </span>
        )}
      </h2>
      <p className="text-sm text-ngpa-white/65 mt-1 max-w-2xl">{hint}</p>
    </div>
  );
}

function EmptyQueue({ label }: { label: string }) {
  return (
    <div className="px-5 py-4 rounded-2xl border border-ngpa-slate/40 bg-ngpa-panel/40 text-ngpa-white/55 text-sm">
      {label}
    </div>
  );
}

export default async function CoachInboxPage() {
  const queues = await fetchInboxQueues();
  const pending = inboxPendingCount(queues);
  const now = new Date();
  // DST-correct deadline copy, rendered FROM the next cron fire in ET — the
  // cron is UTC-fixed, so the ET wall time is an hour earlier Nov–Mar and a
  // hardcoded string would lie half the year.
  const deadline = formatNewsletterDeadline(nextNewsletterFire(now));

  return (
    <>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Inbox
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Pending decisions
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-10 max-w-2xl">
        {pending === 0
          ? "Nothing waiting — all four queues are clear."
          : `${pendingBadgeLabel(pending, queues.newsHasMore)} item${pending === 1 && !queues.newsHasMore ? "" : "s"} across news triage, newsletter drafts, crew interest, and failed card commits. One tap each, no Notion tabs.`}
      </p>

      {/* 1 — Newsletter drafts first: the only queue with a hard deadline. */}
      <section className="mb-12">
        <SectionHeader
          title="Newsletter drafts"
          count={queues.drafts.length}
          hint={`Approve before ${deadline} to ride this week's parent newsletter. Only drafts from the last 7 days ship; Skip suppresses a row for good.`}
        />
        {queues.drafts.length === 0 ? (
          <EmptyQueue label="No drafts awaiting review. The Wednesday drafter writes the next one." />
        ) : (
          <div className="space-y-4">
            {queues.drafts.map((d) => (
              <DraftCard
                key={d.pageId}
                pageId={d.pageId}
                weekTitle={d.weekTitle}
                draftedAt={formatLongDate(d.draftedAt)}
                withinShipWindow={willRideThursdaySend(d, now)}
                bodyHtml={d.html}
                bodyUnavailable={d.bodyUnavailable}
              />
            ))}
          </div>
        )}
      </section>

      {/* 2 — News triage */}
      <section className="mb-12">
        <SectionHeader
          title="News triage"
          count={queues.news.length}
          hint="Scraped youth-pickleball stories. Approve = eligible for the next newsletter's news block (up to 4 ship); Reject = never resurfaces."
        />
        {queues.news.length === 0 ? (
          <EmptyQueue label="No new stories. The scraper runs every morning." />
        ) : (
          <div className="space-y-3">
            {queues.news.map((n) => {
              // Scraper-sourced URL: scheme-checked before it becomes an
              // anchor (same allowlist as the draft renderer). Unsafe or
              // empty → plain text, no link.
              const href = newsLinkHref(n.url);
              return (
                <div
                  key={n.pageId}
                  className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 px-5 py-5 sm:px-6"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-ngpa-white/55 mb-1">
                    {n.source || "Unknown source"}
                    {n.published ? ` · ${formatLongDate(n.published)}` : ""}
                  </p>
                  <p className="font-heading text-lg font-black text-ngpa-white tracking-tight mb-1">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-ngpa-teal transition-colors underline decoration-ngpa-slate/60 underline-offset-4"
                      >
                        {n.title || href}
                      </a>
                    ) : (
                      n.title || n.url
                    )}
                  </p>
                  {n.summary && (
                    <p className="text-sm text-ngpa-white/70 leading-relaxed mb-3">
                      {n.summary}
                    </p>
                  )}
                  <NewsRowActions pageId={n.pageId} />
                </div>
              );
            })}
            {queues.newsHasMore && (
              <p className="text-sm text-ngpa-white/55 pt-1">
                Showing the {queues.news.length} newest — more stories are
                waiting in Notion.
              </p>
            )}
          </div>
        )}
      </section>

      {/* 3 — Crew interest */}
      <section className="mb-12">
        <SectionHeader
          title="Crew interest"
          count={queues.crew.length}
          hint="New submissions from /crew. Mark reviewed to acknowledge (the follow-up loop keeps matching them); Close when a family is routed or done. Spinning up a poll stays your call, in Notion."
        />
        {queues.crew.length === 0 ? (
          <EmptyQueue label="No new crew-interest submissions." />
        ) : (
          <div className="space-y-3">
            {queues.crew.map((r) => (
              <div
                key={r.id}
                className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 px-5 py-5 sm:px-6"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-ngpa-white/55 mb-1">
                  Submitted {formatLongDate(r.createdTime)}
                </p>
                <p className="font-heading text-lg font-black text-ngpa-white tracking-tight">
                  {r.childFirstName} · {r.childLevel}
                  {r.childSubLevel ? ` (${r.childSubLevel})` : ""}
                </p>
                <p className="text-sm text-ngpa-white/70 mt-0.5 mb-3">
                  {r.preferredDays.join("/") || "No days given"}
                  {r.preferredTime ? ` · ${r.preferredTime}` : ""}
                  {r.preferredArea ? ` · ${r.preferredArea}` : ""} — parent:{" "}
                  {r.parentName}
                </p>
                <CrewRowActions pageId={r.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4 — CardFailed commits */}
      <section className="mb-12">
        <SectionHeader
          title="Failed card commits"
          count={queues.cardFailed.length}
          hint="Crew auto-reserve parked these after a failed stored-card charge. Sort out the card with the parent, then re-activate — one informed tap, never automatic."
        />
        {queues.cardFailed.length === 0 ? (
          <EmptyQueue label="No failed cards. Auto-reserve is running clean." />
        ) : (
          <div className="space-y-3">
            {queues.cardFailed.map((c) => (
              <div
                key={c.id}
                className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-amber-400/30 px-5 py-5 sm:px-6"
              >
                <p className="font-heading text-lg font-black text-ngpa-white tracking-tight">
                  {c.childFirstName} · crew {c.crewId || "?"}
                </p>
                <p className="text-sm text-ngpa-white/70 mt-0.5">
                  {c.parentName} · {c.weeksReserved}/{c.weeksCommitted} weeks
                  reserved
                  {c.lastChargeAt
                    ? ` · last charge ${formatLongDate(c.lastChargeAt)}`
                    : ""}
                </p>
                {c.lastError && (
                  <p className="text-sm text-amber-300/90 leading-relaxed mt-2 mb-3">
                    {c.lastError}
                  </p>
                )}
                <div className="mt-3">
                  <CommitReactivate
                    pageId={c.id}
                    childFirstName={c.childFirstName}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-sm text-ngpa-white/55">
        <Link href="/coach" className="hover:text-ngpa-teal transition-colors">
          ← Back to dashboard
        </Link>
      </p>
    </>
  );
}
