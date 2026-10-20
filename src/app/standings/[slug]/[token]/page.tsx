import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findRotationLeagueSeason } from "@/data/rotation-league-seasons";
import { verifyLeagueStandingsLink } from "@/lib/league-standings-token";
import { readPlayoff, readStandings } from "@/lib/rotation-league/view";
import { LeagueStandings } from "@/components/rotation-league/LeagueStandings";
import { Bracket, entrantLabel } from "@/components/rotation-league/Bracket";

// The parent standings link for one rotation-league season, read live from
// Link & Dink. Reached ONLY through a signed, unguessable URL Coach Sam pastes
// into that group's WhatsApp. The token is verified BEFORE any Link & Dink
// call, so a bad link costs nothing and 404s. noindex, robots-disallowed, not
// in the sitemap, never cached (a capability URL must not sit in a shared
// cache), and no-referrer so the token never rides a Referer header off-site.
//
// Shows each child's first and last name, records and playoff results (Sam's
// call, 2026-10-20). No ages, no parent details, no attendance.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Season standings",
  description: "Standings and playoff results for a Next Gen season.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface PageProps {
  params: Promise<{ slug: string; token: string }>;
}

export default async function LeagueStandingsLinkPage({ params }: PageProps) {
  const { slug, token } = await params;
  const season = findRotationLeagueSeason(slug);
  if (!season || !verifyLeagueStandingsLink(token, season.slug)) notFound();

  const [standings, playoff] = await Promise.all([readStandings(season.slug), readPlayoff(season.slug)]);

  return (
    <div className="min-h-screen bg-ngpa-navy text-ngpa-white pb-28 md:pb-16">
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-x-0 top-0 h-72 bg-teal-glow pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 pt-14 sm:pt-20 pb-10">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">Next Gen</p>
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            {season.parentTitle}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            Rotating partners every round, so every player teams up with everyone. Ranked by win rate, adjusted
            for how many games each player has played, then point difference.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-12">
        {playoff.ok && playoff.locked && (
          <section>
            <h2 className="font-heading text-2xl font-black text-ngpa-white mb-4">Playoff</h2>
            {playoff.complete && (
              <div className="rounded-2xl border border-ngpa-lime/50 bg-ngpa-lime/10 px-4 py-3 mb-6">
                <p className="text-xs font-bold uppercase tracking-wider text-ngpa-lime">Champions</p>
                <p className="text-lg font-black text-ngpa-white">{entrantLabel(playoff.champion)}</p>
              </div>
            )}
            <Bracket slots={playoff.slots} />
          </section>
        )}

        <section>
          <h2 className="font-heading text-2xl font-black text-ngpa-white mb-4">Standings</h2>
          {standings.ok ? (
            <LeagueStandings rows={standings.standings} />
          ) : (
            <p className="text-sm text-ngpa-white/70">Standings aren&rsquo;t available right now. Check back soon.</p>
          )}
        </section>
      </div>
    </div>
  );
}
