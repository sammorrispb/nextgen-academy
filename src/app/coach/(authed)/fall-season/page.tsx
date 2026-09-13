import Link from "next/link";
import {
  SEASON_LEAGUE_GROUPS,
  SEASON_LEAGUE_PLAYOFF_WEEK,
  seasonLeagueGroupSlug,
} from "@/data/season-league-2026";
import { formatLongDate } from "@/lib/format-date";
import { probeSeasonLeagueSchema } from "@/lib/notion-season-league";
import { buildStandingsView, loadLeagueSnapshot } from "@/lib/season-league-view";
import { signStandingsLink, standingsLinkPath } from "@/lib/standings-link-token";
import { RankingNote, StandingsTable } from "@/components/season-league/StandingsTable";
import CopyLinkButton from "./CopyLinkButton";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

// The season-play hub: both leagues, six Sundays each, the standings, and the
// parent links. Roster + games are read live (no ISR on a coach page).
export default async function FallSeasonIndexPage() {
  const [probe, ...snapshots] = await Promise.all([
    probeSeasonLeagueSchema(),
    ...SEASON_LEAGUE_GROUPS.map((g) => loadLeagueSnapshot(g.group)),
  ]);

  return (
    <>
      <Link
        href="/coach"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← Coach home
      </Link>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Fall 2026 · Walter Johnson
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Season play
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-8 max-w-2xl">
        Rotating partners, singles and doubles every round, standings for the
        parents, and a seeded double-elimination playoff on week {SEASON_LEAGUE_PLAYOFF_WEEK}.
        Open a Sunday, check in who&rsquo;s here, preview, save, score.
      </p>

      {probe.status === "config_missing" && (
        <Banner tone="amber">
          <strong>Not configured yet.</strong> Set <code>NOTION_SEASON_LEAGUE_DB_ID</code> (and share the
          database with the Player DB integration) — until then nothing can be saved.
        </Banner>
      )}
      {probe.status === "query_failed" && (
        <Banner tone="red">
          <strong>Can&rsquo;t reach the games database.</strong> Check that it is shared with the
          Player DB integration and that the id is right.
        </Banner>
      )}
      {probe.status === "mismatch" && (
        <Banner tone="red">
          <strong>The games database is missing properties.</strong>{" "}
          {probe.missing.length > 0 && <>Missing: {probe.missing.join(", ")}. </>}
          {probe.mistyped.length > 0 && <>Wrong type: {probe.mistyped.join(", ")}. </>}
          Fix the schema in Notion before Sunday — a save 400s otherwise.
        </Banner>
      )}

      <div className="space-y-12">
        {SEASON_LEAGUE_GROUPS.map((option, i) => {
          const snapshot = snapshots[i];
          const view = buildStandingsView(snapshot);
          const slug = seasonLeagueGroupSlug(option.group);
          const token = signStandingsLink(option.group);
          const parentUrl = token ? `${SITE_ORIGIN}${standingsLinkPath(option.group, token)}` : null;
          return (
            <section key={option.group}>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight">
                    {option.label}
                  </h2>
                  <p className="text-sm text-ngpa-white/60">
                    {option.timeLabel} · {snapshot.confirmed.length} confirmed
                    {snapshot.rosterStatus !== "ok" && (
                      <span className="text-amber-300"> · roster unavailable ({snapshot.rosterStatus})</span>
                    )}
                    {snapshot.rowsStatus === "query_failed" && (
                      <span className="text-red-300"> · games unavailable</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {parentUrl ? (
                    <>
                      <a
                        href={parentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-xs font-bold transition-colors min-h-[36px]"
                      >
                        View parent page ↗
                      </a>
                      <CopyLinkButton url={parentUrl} />
                    </>
                  ) : (
                    <span className="text-xs text-amber-300">
                      Set <code>STANDINGS_LINK_SECRET</code> to enable the parent link
                    </span>
                  )}
                </div>
              </div>

              <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
                {snapshot.weeks.map((w) => {
                  const isPlayoff = w.week === SEASON_LEAGUE_PLAYOFF_WEEK;
                  const status = isPlayoff
                    ? snapshot.playoff.state?.complete
                      ? "champion crowned"
                      : snapshot.playoff.locked
                        ? `${snapshot.playoff.results.length} played`
                        : "playoff"
                    : w.played + w.scheduled === 0
                      ? "not started"
                      : `${w.played} played${w.scheduled ? ` · ${w.scheduled} up` : ""}`;
                  return (
                    <li key={w.week}>
                      <Link
                        href={`/coach/fall-season/${slug}/${w.week}`}
                        className="block rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/60 px-3 py-3 hover:border-ngpa-teal transition-colors min-h-[72px]"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ngpa-teal">
                          Week {w.week}
                        </p>
                        <p className="text-sm font-bold text-ngpa-white">
                          <time dateTime={w.date}>{formatLongDate(w.date)}</time>
                        </p>
                        <p className="text-xs text-ngpa-white/55 mt-0.5">{status}</p>
                      </Link>
                    </li>
                  );
                })}
              </ol>

              <StandingsTable rows={view.standings} />
              <div className="mt-2">
                <RankingNote />
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Banner({ tone, children }: { tone: "amber" | "red"; children: React.ReactNode }) {
  return (
    <div
      className={
        tone === "amber"
          ? "mb-8 rounded-2xl border border-amber-400/50 bg-amber-400/10 px-5 py-4 text-sm text-amber-100"
          : "mb-8 rounded-2xl border border-red-400/50 bg-red-400/10 px-5 py-4 text-sm text-red-100"
      }
    >
      {children}
    </div>
  );
}
