import type { PlayedGame } from "./types";

/**
 * Score validation shared by the coach form, the server action and the
 * standings engine. A game to 11 win by 2 ends at 11-x (x ≤ 9) or at deuce by
 * exactly two (13-11, never 14-11). `timed: true` is the "we ran out of
 * time" escape hatch the coach can tick: any non-tied score is accepted so a
 * clock-ended game still counts.
 *
 * `targets` lists every game length the coach may call on the day (Sam,
 * 2026-10-18: "games to 15 today"). A score is valid if it is a legal finish
 * for ANY of them, so 15-4 and 17-15 pass under [11, 15] while 14-11 (past 11
 * by three, short of 15) still fails. No per-game picker: zero extra taps.
 */
export interface ScoreRules {
  target: number;
  winBy: number;
  targets?: readonly number[];
}

export type ScoreValidation = { ok: true } | { ok: false; reason: string };

export function validateScore(
  scoreA: unknown,
  scoreB: unknown,
  rules: ScoreRules,
  options: { timed?: boolean } = {},
): ScoreValidation {
  if (
    typeof scoreA !== "number" ||
    typeof scoreB !== "number" ||
    !Number.isInteger(scoreA) ||
    !Number.isInteger(scoreB)
  ) {
    return { ok: false, reason: "Scores must be whole numbers" };
  }
  if (scoreA < 0 || scoreB < 0) {
    return { ok: false, reason: "Scores can't be negative" };
  }
  if (scoreA === scoreB) {
    return { ok: false, reason: "A game can't end tied — play it out" };
  }
  if (options.timed) return { ok: true };

  const targets = [...new Set([rules.target, ...(rules.targets ?? [])])].sort((x, y) => x - y);
  if (targets.length > 1) {
    const results = targets.map((target) =>
      finishFor(scoreA, scoreB, { target, winBy: rules.winBy }),
    );
    if (results.some((r) => r.ok)) return { ok: true };
    const hi = Math.max(scoreA, scoreB);
    const lo = Math.min(scoreA, scoreB);
    if (hi < targets[0]) return results[0];
    if (hi - lo < rules.winBy) return { ok: false, reason: `Win by ${rules.winBy}` };
    return {
      ok: false,
      reason: `Games end at ${targets.join(", ").replace(/, (\d+)$/, " or $1")} (past it, by exactly ${rules.winBy})`,
    };
  }
  return finishFor(scoreA, scoreB, rules);
}

function finishFor(scoreA: number, scoreB: number, rules: ScoreRules): ScoreValidation {
  const hi = Math.max(scoreA, scoreB);
  const lo = Math.min(scoreA, scoreB);
  if (hi < rules.target) {
    return {
      ok: false,
      reason: `Someone has to reach ${rules.target} (tick "ended on time" if the clock stopped it)`,
    };
  }
  if (hi - lo < rules.winBy) {
    return { ok: false, reason: `Win by ${rules.winBy}` };
  }
  if (hi > rules.target && hi - lo !== rules.winBy) {
    return {
      ok: false,
      reason: `Past ${rules.target} a game ends by exactly ${rules.winBy}`,
    };
  }
  return { ok: true };
}

/** "A" | "B" for a decided game, null for a tie (which the store never holds). */
export function gameWinner(game: Pick<PlayedGame, "scoreA" | "scoreB">): "A" | "B" | null {
  if (game.scoreA === game.scoreB) return null;
  return game.scoreA > game.scoreB ? "A" : "B";
}
