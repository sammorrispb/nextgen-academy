// Source: Tournament director guide — rotating-partner round robin,
// https://app.notion.com/p/3fdfa3ac27dc814a81d1e4d3750d1ef0
// Sam requested adding the established format to the series pages on Nov 2,
// 2026. Describe the supported draws conditionally; actual turnout still
// needs a reviewed schedule, and these pages do not configure a live draw.
export default function MvfSeriesFormatRules() {
  return (
    <section id="format-rules" aria-labelledby="format-rules-heading" className="mt-8 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel p-6 scroll-mt-24">
      <h2 id="format-rules-heading" className="font-heading text-2xl font-bold text-ngpa-white">Format &amp; Rules</h2>
      <p className="text-ngpa-white/80 mt-4">
        <strong className="text-ngpa-white">Rotating-partner round robin.</strong> Register as an individual — no partner needed. You play doubles with different partners between rounds, and each player earns their own individual standing.
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
        The standard 5-, 8-, 9-, and 10-player draws give each player four round-robin games before medal play. Qualifying players then play an additional medal game.
      </p>
      <p className="text-ngpa-white/80 mt-3">
        Pool sizes, partners, and rest rounds depend on the final playing roster. Five-player pools give each player one rest round; the 8-player four-game draw has no rest rounds, and the 9-player draw has one per player. A 10-player field uses two pools of five. For other field sizes, the director confirms a schedule that includes every entrant before play begins.
      </p>

      <details className="mt-5 rounded-xl border border-ngpa-slate/60 p-4">
        <summary className="cursor-pointer font-heading font-bold text-ngpa-white">Individual standings and tiebreakers</summary>
        <p className="text-ngpa-white/80 mt-3">Players are ranked within their own pool or bracket in this order:</p>
        <ol className="list-decimal pl-5 space-y-2 text-ngpa-white/80 mt-3">
          <li>Wins.</li>
          <li>Head-to-head wins among tied players, counting games against one another as opponents.</li>
          <li>Overall point differential within the pool or bracket — points scored minus points allowed.</li>
          <li>Point differential in games between the tied players.</li>
          <li>Point differential against the players immediately above them in the standings.</li>
          <li>Total points scored.</li>
        </ol>
        <p className="text-ngpa-white/80 mt-3">If part of a tie breaks, the remaining tied players are compared again in the same order. Any unresolved tie affecting advancement is reviewed by the director before the medal draw.</p>
      </details>

      <details className="mt-4 rounded-xl border border-ngpa-slate/60 p-4">
        <summary className="cursor-pointer font-heading font-bold text-ngpa-white">How medal teams are formed</summary>
        <p className="text-ngpa-white/80 mt-3">The director verifies round-robin results and reviews medal teams before the games begin. The standard pairings depend on the draw:</p>
        <h3 className="font-heading font-bold text-ngpa-white mt-4">One pool of 8 or 9 players</h3>
        <ul className="list-disc pl-5 space-y-2 text-ngpa-white/80 mt-2">
          <li>Gold game: 1st + 4th vs. 2nd + 3rd.</li>
          <li>Bronze game: 5th + 8th vs. 6th + 7th.</li>
          <li>With 9 players, 9th place finishes after the four round-robin games.</li>
        </ul>
        <h3 className="font-heading font-bold text-ngpa-white mt-4">Two pools of 5 players</h3>
        <p className="text-ngpa-white/80 mt-2">A and B identify the pools; the number is the player’s final rank in that pool.</p>
        <ul className="list-disc pl-5 space-y-2 text-ngpa-white/80 mt-2">
          <li>Gold game: A1 + B2 vs. B1 + A2.</li>
          <li>Bronze game: A3 + B4 vs. B3 + A4.</li>
          <li>5th place in each pool finishes after the four round-robin games.</li>
        </ul>
        <p className="text-ngpa-white/80 mt-3">The gold-game winners earn gold, the gold-game runners-up earn silver, and the bronze-game winners earn bronze. Smaller fields need a director-confirmed medal draw; a bronze game requires enough players.</p>
      </details>
      <p className="text-ngpa-white/70 text-sm mt-4">Confirm each score with the other players before reporting it to the director.</p>
    </section>
  );
}
