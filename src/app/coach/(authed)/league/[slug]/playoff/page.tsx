import Link from "next/link";
import { notFound } from "next/navigation";
import { findRotationLeagueSeason } from "@/data/rotation-league-seasons";
import { formatLongDate } from "@/lib/format-date";
import { previewPlayoff, readPlayoff, readWeek } from "@/lib/rotation-league/view";
import { Bracket, entrantLabel } from "@/components/rotation-league/Bracket";
import CheckInList from "../[week]/CheckInList";
import TeamBuilder from "./TeamBuilder";
import { PlayoffScoreForm, UnlockTeamsButton } from "./PlayoffControls";

export const dynamic = "force-dynamic";

// Playoff day: check in who's here, review the snake-seeded teams (swap kids
// if needed), lock them, then score the double-elimination bracket game by
// game. The bracket is recomputed by Link & Dink from the scores on every read.
export default async function LeaguePlayoffPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const season = findRotationLeagueSeason(slug);
  if (!season || season.playoffWeek === null) notFound();
  const week = season.playoffWeek;

  const [players, preview, bracket] = await Promise.all([
    readWeek(season.slug, week),
    previewPlayoff(season.slug),
    readPlayoff(season.slug),
  ]);
  const locked = bracket.ok && bracket.locked;
  const date = season.weekDates[week];
  const scoredAny = bracket.ok && bracket.slots.some((s) => s.status === "played");

  return (
    <>
      <Link
        href="/coach/league"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← All seasons
      </Link>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">{season.name}</p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Playoff · week {week}
        {date && <span className="ml-3 text-xl font-bold text-ngpa-white/60">{formatLongDate(date)}</span>}
      </h1>
      {season.note && (
        <p className="text-xs text-amber-200/80 border border-amber-300/30 bg-amber-300/5 rounded-xl px-3 py-2 mb-6 max-w-2xl">
          {season.note}
        </p>
      )}

      {!bracket.ok ? (
        <p className="rounded-2xl border border-red-400/40 bg-red-400/5 px-4 py-3 text-sm text-red-200">{bracket.message}</p>
      ) : !locked ? (
        <div className="space-y-10">
          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">1. Who&rsquo;s here</h2>
            {players.ok ? (
              <CheckInList
                slug={season.slug}
                week={week}
                players={players.players
                  .filter((p) => p.status === "active" || p.present)
                  .map((p) => ({ external_ref: p.external_ref, name: p.name, present: p.present }))}
              />
            ) : (
              <p className="text-sm text-red-300">{players.message}</p>
            )}
          </section>
          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">2. Teams</h2>
            {preview.ok ? (
              <TeamBuilder
                key={preview.teams.map((t) => t.players.map((p) => p.external_ref).join(",")).join("|")}
                slug={season.slug}
                teams={preview.teams.map((t) => t.players)}
              />
            ) : (
              <p className="text-sm text-red-300">{preview.message}</p>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-8">
          {bracket.complete && (
            <div className="rounded-2xl border border-ngpa-lime/50 bg-ngpa-lime/10 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-ngpa-lime">Champions</p>
              <p className="text-lg font-black text-ngpa-white">{entrantLabel(bracket.champion)}</p>
            </div>
          )}
          {!scoredAny && <UnlockTeamsButton slug={season.slug} />}
          <Bracket
            slots={bracket.slots}
            renderAction={(s) =>
              s.can_score ? (
                <PlayoffScoreForm
                  slug={season.slug}
                  slot={s.id}
                  scoreA={s.score_a}
                  scoreB={s.score_b}
                  played={s.status === "played"}
                  gameTargets={[...season.gameTargets]}
                  defaultTarget={season.gameTarget}
                />
              ) : null
            }
          />
        </div>
      )}
    </>
  );
}
