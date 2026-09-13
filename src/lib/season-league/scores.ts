import type { PlayedGame } from "./types";

/**
 * Score validation shared by the coach form, the server action and the
 * standings engine. A game to 11 win by 2 ends at 11-x (x ≤ 9) or at deuce by
 * exactly two (13-11, never 14-11). `timed: true` is the "we ran out of
 * time" escape hatch the coach can tick: any non-tied score is accepted so a
 * clock-ended game still counts.
 */
export interface ScoreRules {
  target: number;
  winBy: number;
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
