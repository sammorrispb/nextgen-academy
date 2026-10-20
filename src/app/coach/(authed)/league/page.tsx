import Link from "next/link";
import { ROTATION_LEAGUE_SEASONS } from "@/data/rotation-league-seasons";
import { formatLongDate } from "@/lib/format-date";
import { readStandings } from "@/lib/rotation-league/view";
import { leagueStandingsPath, signLeagueStandingsLink } from "@/lib/league-standings-token";
import CopyLinkButton from "../fall-season/CopyLinkButton";
import SyncRosterButton from "./SyncRosterButton";
import { LeagueStandings } from "@/components/rotation-league/LeagueStandings";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

// Rotation-league seasons that run on Link & Dink. Roster, check-ins, rounds
// and scores live there; NGA sends the roster from its registrations.
export default async function LeagueIndexPage() {
  const standings = await Promise.all(ROTATION_LEAGUE_SEASONS.map((s) => readStandings(s.slug)));

  return (
    <>
      <Link
        href="/coach"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← Coach home
      </Link>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">Link &amp; Dink engine</p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Rotating-partner league
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-8 max-w-2xl">
        Sync the roster, open a week, tap who&rsquo;s here, pick how many rounds, preview, save, then score
        every game on one page. Partners and opponents balance across the whole season.
      </p>

      <div className="space-y-12">
        {ROTATION_LEAGUE_SEASONS.map((season, i) => {
          const s = standings[i];
          const token = signLeagueStandingsLink(season.slug);
          const parentUrl = token ? `${SITE_ORIGIN}${leagueStandingsPath(season.slug, token)}` : null;
          return (
            <section key={season.slug}>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight">
                    {season.name}
                  </h2>
                  <p className="text-sm text-ngpa-white/60">
                    {season.courts} courts · {season.targetGamesPerPlayer} games each · to {season.gameTarget}, win
                    by {season.winBy}
                  </p>
                </div>
                <SyncRosterButton slug={season.slug} />
              </div>
              {season.note && (
                <p className="text-xs text-amber-200/80 border border-amber-300/30 bg-amber-300/5 rounded-xl px-3 py-2 mb-4">
                  {season.note}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mb-6">
                {season.playWeeks.map((w) => (
                  <Link
                    key={w}
                    href={`/coach/league/${season.slug}/${w}`}
                    className="px-4 py-2 rounded-full border border-ngpa-slate/60 text-sm font-bold text-ngpa-white hover:border-ngpa-teal hover:text-ngpa-teal transition-colors min-h-[44px] inline-flex items-center"
                  >
                    Week {w}
                    {season.weekDates[w] && (
                      <span className="ml-2 font-normal text-ngpa-white/55">{formatLongDate(season.weekDates[w])}</span>
                    )}
                  </Link>
                ))}
                {season.playoffWeek !== null && (
                  <Link
                    href={`/coach/league/${season.slug}/playoff`}
                    className="px-4 py-2 rounded-full border border-ngpa-lime/60 text-sm font-bold text-ngpa-lime hover:bg-ngpa-lime/10 transition-colors min-h-[44px] inline-flex items-center"
                  >
                    Playoff · week {season.playoffWeek}
                  </Link>
                )}
              </div>

              <div className="mb-6 rounded-xl border border-ngpa-slate/40 px-3 py-2 text-xs text-ngpa-white/70">
                {parentUrl ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      Parent standings link (full names; share only in this group&rsquo;s WhatsApp):
                    </span>
                    <CopyLinkButton url={parentUrl} />
                  </div>
                ) : (
                  <span>Parent link is off: set STANDINGS_LINK_SECRET to turn it on.</span>
                )}
              </div>

              {s.ok ? (
                <LeagueStandings rows={s.standings} />
              ) : (
                <p className="text-sm text-ngpa-white/60">{s.message}</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
