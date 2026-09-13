import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatLongDate } from "@/lib/format-date";
import { resolveStandingsView } from "@/lib/season-league-view";
import {
  PlayoffBoard,
  RankingNote,
  StandingsTable,
  WeekResults,
} from "@/components/season-league/StandingsTable";

// The parent/player standings link for one colour group of the Fall 2026
// Sunday season. Reached ONLY through a signed, unguessable URL that Coach Sam
// pastes into that group's WhatsApp; the token is verified before any Notion
// read and a bad one 404s (resolveStandingsView). noindex, not in the sitemap,
// disallowed in robots.txt, and never ISR-cached — a capability URL must not
// sit in a shared cache. Shows first names, records and scores. No ages, no
// parent details, no roster beyond the kids in the standings.
//
// This page is the one place the season's standings are shown to families —
// a deliberate, logged exception (Sam, 2026-09-13) to the growth-only rule the
// NGA league blueprint states for the separate /league product.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fall Season standings — Next Gen Pickleball Academy",
  description: "Standings and results for the Next Gen fall Sunday season.",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ group: string; token: string }>;
}

export default async function FallStandingsPage({ params }: PageProps) {
  const { group, token } = await params;
  const view = await resolveStandingsView(group, token);
  if (!view) notFound();

  return (
    <div className="min-h-screen bg-ngpa-navy text-ngpa-white pb-28 md:pb-16">
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-x-0 top-0 h-72 bg-teal-glow pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 pt-14 sm:pt-20 pb-10">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">
            {view.title}
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            {view.label}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            Sundays {view.timeLabel} at {view.venue}. Rotating partners, singles and
            doubles every week, and a seeded playoff on{" "}
            <time dateTime={view.playoffDate}>{formatLongDate(view.playoffDate)}</time>.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-12">
        {view.status !== "ok" && (
          <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
            Results aren&rsquo;t available right now — check back after the next Sunday.
          </div>
        )}

        {view.playoff && (
          <section>
            <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight mb-4">Playoff</h2>
            <PlayoffBoard playoff={view.playoff} />
          </section>
        )}

        <section>
          <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight mb-4">Standings</h2>
          <StandingsTable rows={view.standings} />
          <div className="mt-3">
            <RankingNote />
          </div>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight mb-4">Results</h2>
          <WeekResults weeks={view.weeks} />
        </section>

        <p className="text-xs text-ngpa-white/45 leading-relaxed">
          This page is just for our {view.label} families — please don&rsquo;t share the link outside
          the group. Questions about the standings? Ask Coach Sam on Sunday.
        </p>
      </div>
    </div>
  );
}
