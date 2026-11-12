// Source: Tournament director guide, rotating-partner round robin,
// https://app.notion.com/p/3fdfa3ac27dc814a81d1e4d3750d1ef0
// Sam requested adding the established format to the series pages on Nov 2,
// 2026, and on Nov 12, 2026 asked for the copy to be more generic: the schedule
// and the medal round depend on turnout, so this page describes what is true of
// every schedule the director can run and leaves the day's specifics to the
// director's announcement. It names no pool sizes, pairings or medal games,
// and these pages do not configure a live draw.
export default function MvfSeriesFormatRules() {
  return (
    <section id="format-rules" aria-labelledby="format-rules-heading" className="mt-8 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel p-6 scroll-mt-24">
      <h2 id="format-rules-heading" className="font-heading text-2xl font-bold text-ngpa-white">Format &amp; Rules</h2>
      <p className="text-ngpa-white/80 mt-4">
        <strong className="text-ngpa-white">Rotating-partner round robin.</strong> Register your player as an individual. No partner needed. In a round robin everyone plays several games before any medal game. Your player gets a new partner each round and earns their own individual standing. Most games are doubles; depending on how many players check in, the schedule can also include singles games.
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <div className="rounded-xl bg-ngpa-deep/60 p-4">
          <dt className="font-heading font-bold text-ngpa-white">Round-robin scoring</dt>
          <dd className="text-ngpa-teal-bright mt-1">One game to 11, win by 2</dd>
        </div>
        <div className="rounded-xl bg-ngpa-deep/60 p-4">
          <dt className="font-heading font-bold text-ngpa-white">Medal-game scoring</dt>
          <dd className="text-ngpa-teal-bright mt-1">One game to 15, win by 2</dd>
        </div>
      </dl>
      <h3 className="font-heading font-bold text-ngpa-white mt-5">How many games will my player play?</h3>
      <p className="text-ngpa-white/80 mt-2">
        Your player gets a full round robin before any medal game, and schedules are built to give each player at least four round-robin games. Players who qualify then play in the medal round.
      </p>
      <p className="text-ngpa-white/80 mt-3">
        The number of rounds, the groups, the partners, and any rest rounds depend on how many players check in. The director confirms a schedule that includes every player and shares it before play begins.
      </p>

      <details className="mt-5 rounded-xl border border-ngpa-slate/60 p-4">
        <summary className="cursor-pointer font-heading font-bold text-ngpa-white">Individual standings and tiebreakers</summary>
        <p className="text-ngpa-white/80 mt-3">Players are ranked within their own pool or bracket in this order:</p>
        <ol className="list-decimal pl-5 space-y-2 text-ngpa-white/80 mt-3">
          <li>Wins.</li>
          <li>Head-to-head wins among tied players, counting games against one another as opponents.</li>
          <li>Overall point differential within the pool or bracket: points scored minus points allowed.</li>
          <li>Point differential in games between the tied players.</li>
          <li>Point differential against the players immediately above them in the standings.</li>
          <li>Total points scored.</li>
        </ol>
        <p className="text-ngpa-white/80 mt-3">If part of a tie breaks, the remaining tied players are compared again in the same order. Any unresolved tie affecting advancement is reviewed by the director before the medal round.</p>
      </details>

      <details className="mt-4 rounded-xl border border-ngpa-slate/60 p-4">
        <summary className="cursor-pointer font-heading font-bold text-ngpa-white">How the medal round works</summary>
        <p className="text-ngpa-white/80 mt-3">After the round robin, the director checks the results and sets the medal round for that day&rsquo;s group. Who plays in it comes from the final round-robin standings.</p>
        <ul className="list-disc pl-5 space-y-2 text-ngpa-white/80 mt-3">
          <li>The medal round depends on how many players check in. It can be one game or more than one.</li>
          <li>The director announces the medal teams and who plays whom before those games begin.</li>
          <li>Every player gets their full set of round-robin games. Depending on the day&rsquo;s numbers, some players finish after the round robin.</li>
        </ul>
        <p className="text-ngpa-white/80 mt-3">Gold, silver, and bronze come from the results of the medal round. The director explains how each is earned when announcing it.</p>
      </details>
      <p className="text-ngpa-white/70 text-sm mt-4">Confirm each score with the other players before reporting it to the director.</p>
    </section>
  );
}
