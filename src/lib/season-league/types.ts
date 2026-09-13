// Pure engine types for the Fall 2026 season league. No I/O, no env, no
// node: imports anywhere under src/lib/season-league — the same modules run in
// a server action, a page render and a pure Playwright spec.

/** A player is the Notion page id of their fall-registration row. Names are
 * joined at render time; the engine never sees one. */
export type PlayerId = string;

export type GameFormat = "doubles" | "singles";

export interface GameSides {
  /** One id for singles, two for doubles, up to three for a playoff team. */
  sideA: PlayerId[];
  sideB: PlayerId[];
}

export interface PlannedGame extends GameSides {
  round: number;
  /** 1-based court number for the day. Doubles courts come first. */
  court: number;
  format: GameFormat;
}

export interface PlannedRound {
  round: number;
  games: PlannedGame[];
  /** Present players with no court this round. Empty with six kids. */
  sitting: PlayerId[];
}

export interface CourtAllocation {
  doubles: number;
  singles: number;
  /** 4 × doubles + 2 × singles. */
  playing: number;
  sitting: number;
}

export interface DayPlan {
  rounds: PlannedRound[];
  allocation: CourtAllocation;
}

/** A game with a recorded score. Ties are never stored (validateScore). */
export interface PlayedGame extends GameSides {
  format: GameFormat;
  scoreA: number;
  scoreB: number;
  week?: number;
  round?: number;
}
