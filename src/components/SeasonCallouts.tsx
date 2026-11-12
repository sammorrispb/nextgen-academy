import Link from "next/link";
import {
  FALL_PUBLIC_AREA,
  FALL_SEASON_END,
  FALL_SEASON_LABEL,
  FALL_SEASON_WEEKS,
  FALL_VENUE_SHORT,
} from "@/data/fall-2026";
import {
  FALL_SEASON_GROUPS,
  FALL_SEASON_PRICE_USD,
} from "@/data/fall-season-2026";
import {
  PICKLPARK_PUBLIC_AREA,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_SEASON_WEEKS,
  PICKLPARK_VENUE_SHORT,
} from "@/data/picklpark-2026";
import {
  PICKLPARK_LEAGUES,
  PICKLPARK_LEAGUES_FORMAT_LINE,
} from "@/data/picklpark-leagues-2026";
import { picklParkLeaguesOpen } from "@/lib/picklpark-registration-window";

/**
 * The two fall season cards on /schedule. Each shows only while its own season
 * is still running, and the component renders nothing once both are over:
 * the cards sat ungated and kept advertising two finished seasons.
 *
 * Bare cards with no wrapper of their own. The parent owns spacing, so an
 * ended season leaves no padded gap behind. `todayIso` is today in
 * America/New_York.
 */
export default function SeasonCallouts({ todayIso }: { todayIso: string }) {
  const fallRunning = todayIso <= FALL_SEASON_END;
  const picklParkRunning = picklParkLeaguesOpen(todayIso);
  if (!fallRunning && !picklParkRunning) return null;

  return (
    <>
      {fallRunning && (
        <Link
          href="/fall"
          className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-ngpa-lime/40 bg-ngpa-lime/10 p-5 sm:p-6 hover:border-ngpa-lime transition-colors"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-lime">
              New &middot; Fall 2026 Season
            </p>
            {/* Venue from the constants — this line hardcoded Wood MS and
                would have gone stale on the 2026-08-27 move to Walter Johnson. */}
            <p className="font-heading text-lg sm:text-xl font-bold text-ngpa-white mt-1">
              {FALL_SEASON_WEEKS === 6 ? "Six" : FALL_SEASON_WEEKS} Sundays at{" "}
              {FALL_VENUE_SHORT} in {FALL_PUBLIC_AREA}
            </p>
            {/* Dates, blocks and price all derived — this line hardcoded
                them and had already drifted: it advertised "8 spots per
                group" after Yellow moved to 10, and a public seat count is
                not ours to publish either way (2026-08-29 rule). */}
            <p className="text-sm text-ngpa-muted mt-0.5">
              {FALL_SEASON_LABEL} &middot;{" "}
              {FALL_SEASON_GROUPS.map((g, i) => (
                <span key={g.group}>
                  {i > 0 && ", "}
                  {g.label} {g.timeLabel}
                </span>
              ))}{" "}
              &middot; ${FALL_SEASON_PRICE_USD} per player, small groups.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-full bg-ngpa-lime text-ngpa-deep font-heading font-bold group-hover:brightness-110 transition-all min-h-[48px]">
            See both leagues &rarr;
          </span>
        </Link>
      )}

      {picklParkRunning && (
        <Link
          href="/picklpark"
          className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-ngpa-lime/40 bg-ngpa-lime/10 p-5 sm:p-6 hover:border-ngpa-lime transition-colors"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-lime">
              Fall 2026 Season &middot; Frederick
            </p>
            <p className="font-heading text-lg sm:text-xl font-bold text-ngpa-white mt-1">
              {PICKLPARK_SEASON_WEEKS === 6 ? "Six" : PICKLPARK_SEASON_WEEKS}{" "}
              Saturdays indoors at {PICKLPARK_VENUE_SHORT} in{" "}
              {PICKLPARK_PUBLIC_AREA}
            </p>
            <p className="text-sm text-ngpa-muted mt-0.5">
              {PICKLPARK_SEASON_LABEL} &middot;{" "}
              {PICKLPARK_LEAGUES.map((l, i) => (
                <span key={l.slug}>
                  {i > 0 && ", "}
                  {l.title} {l.timeLabel} ({l.ageLabel})
                </span>
              ))}{" "}
              &middot; {PICKLPARK_LEAGUES_FORMAT_LINE}. Coached by Next Gen,
              registered with The Pickl Park.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-full bg-ngpa-lime text-ngpa-deep font-heading font-bold group-hover:brightness-110 transition-all min-h-[48px]">
            See the league &rarr;
          </span>
        </Link>
      )}
    </>
  );
}
