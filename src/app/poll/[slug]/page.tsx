import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchPollBySlug, fetchPollResponses } from "@/lib/notion-crew-polls";
import PollVoteForm from "@/components/PollVoteForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vote on a session — Next Gen Pickleball Academy",
  description:
    "Coach Sam is forming a new pickleball crew. Tell us if this slot works for your kid.",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PollPage({ params }: PageProps) {
  const { slug } = await params;
  const poll = await fetchPollBySlug(slug);
  if (!poll) notFound();

  const closed = poll.status !== "Open";

  const responses = closed ? [] : await fetchPollResponses(poll.id);
  const yesCount = responses.filter((r) => r.vote === "Yes").length;
  const maybeCount = responses.filter((r) => r.vote === "Maybe").length;

  return (
    <div className="min-h-screen bg-ngpa-navy text-ngpa-white">
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-x-0 top-0 h-72 bg-teal-glow pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-20 pb-12">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">
            Crew Poll
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            {poll.title}
          </h1>
          <p className="mt-5 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            Sam is putting together a new crew. Tell us if this slot works for
            your kid and we&rsquo;ll text the group when the headcount hits.
          </p>

          <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            <Cell label="Day" value={poll.day || "—"} />
            <Cell
              label="Time"
              value={
                poll.startTime
                  ? `${poll.startTime}${poll.endTime ? `–${poll.endTime}` : ""}`
                  : "—"
              }
            />
            <Cell label="Location" value={poll.location || "—"} />
            <Cell label="Level" value={poll.level || "Any"} />
          </div>

          {!closed && (
            <div className="mt-6 inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-teal/30">
              <span
                className="w-2 h-2 rounded-full bg-ngpa-teal animate-pulse"
                aria-hidden="true"
              />
              <span className="font-mono text-sm sm:text-base font-bold text-ngpa-white">
                {yesCount} in
              </span>
              <span className="text-ngpa-white/50" aria-hidden="true">
                |
              </span>
              <span className="text-sm sm:text-base text-ngpa-white/80">
                need {poll.minPartySize} to lock it in
              </span>
              {maybeCount > 0 && (
                <>
                  <span className="text-ngpa-white/50" aria-hidden="true">
                    |
                  </span>
                  <span className="text-sm sm:text-base text-ngpa-white/60">
                    {maybeCount} maybe
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="bg-ngpa-navy py-12 sm:py-16 px-4 sm:px-6 lg:px-10">
        <div className="max-w-2xl mx-auto">
          {closed ? (
            <div className="bg-ngpa-panel/80 backdrop-blur rounded-2xl p-8 sm:p-10 border border-ngpa-slate/60 text-center">
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white mb-3 tracking-tight">
                This poll is closed.
              </h2>
              <p className="text-ngpa-white/75 text-base sm:text-lg mb-6">
                {poll.status === "Confirmed"
                  ? "The crew is locked in. If you'd like to join a future session, see what's open."
                  : "Catch the next one — Sam shares new poll links on WhatsApp."}
              </p>
              <Link
                href="/schedule"
                className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
              >
                See open sessions
              </Link>
            </div>
          ) : (
            <PollVoteForm
              pollSlug={poll.slug}
              pollTitle={poll.title}
              pollLevel={poll.level}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-xl border border-ngpa-slate/60 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ngpa-teal mb-0.5">
        {label}
      </p>
      <p className="text-sm font-bold text-ngpa-white truncate">{value}</p>
    </div>
  );
}
