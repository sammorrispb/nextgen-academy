// The Fall 2026 season plan — six Sundays, one focus each, mapped 1:1 onto the
// real dates in fall-2026.ts.
//
// WHY IT'S A PLAN AND NOT A PILE OF DRILLS. A family paid $225 up front for a
// six-week arc. What they bought is a progression: week 1 finds out where their
// kid is, weeks 2–5 each add one thing on top of the last, week 6 puts it under
// pressure and shows them. If the weeks were interchangeable we'd be selling
// six drop-ins with a discount.
//
// The order is not arbitrary either. It walks the Skill Stack outward from the
// kitchen — where the ball is slow and success is cheap — to the baseline and
// the serve, then back in for the net game. Each week's focus is the block the
// coach goes DEEP on; all six blocks still run every session, because the ritual
// is what lets a kid self-run the hour.
//
// The dates come from FALL_SUNDAYS. If a Sunday washes out and slides to a rain
// date, the plan slides with it — the weeks stay in order, they just land on
// different dates. Never reorder the weeks to fit a calendar.

import { FALL_SUNDAYS, FALL_YOUTH_BLOCKS, FALL_SEASON_WEEKS } from "./fall-2026";
import { SKILL_STACK, MODIFIED_GAMES } from "./session-curriculum";

/** The EASE value that is the Word of the Day for a given week. */
export type EaseWord = "Ethics" | "Attitude" | "Skills" | "Excellence";

export interface SeasonWeek {
  /** 1-indexed week number. */
  week: number;
  /** ISO date-only, from FALL_SUNDAYS. */
  date: string;
  /** Short title, used on the run sheet and in the parent note. */
  title: string;
  /** The Skill Stack block this week goes deep on. */
  focusBlock: number;
  /** The EASE Word of the Day. */
  word: EaseWord;
  /** How the coach frames the word to kids, in one sentence. */
  wordFraming: string;
  /** The two modified games, by slug. */
  games: readonly [string, string];
  /** The closing ritual, by slug. */
  ritual: string;
  /** What the coach is actually looking for this week. */
  coachLooksFor: string;
  /** One plain sentence a parent can understand and repeat. */
  parentLine: string;
  /** The thing a kid could practise at home in five minutes. */
  homeRep: string;
}

export const FALL_SEASON_PLAN: readonly SeasonWeek[] = [
  {
    week: 1,
    date: FALL_SUNDAYS[0],
    title: "Where we're starting",
    focusBlock: 1,
    word: "Attitude",
    wordFraming:
      "Today is not a test. It's the first line on your own chart — everything after this is you versus that.",
    games: ["kitchen-game", "squirrel"],
    ritual: "jailbreak",
    coachLooksFor:
      "Every kid's longest rally, their comfortable ball color, and who they naturally play well with. This is the baseline the rest of the season is measured against.",
    parentLine:
      "We found out where every kid is starting — longest rally, favourite shot, who they click with on court.",
    homeRep: "Rally against a wall. Count. Beat the number tomorrow.",
  },
  {
    week: 2,
    date: FALL_SUNDAYS[1],
    title: "The soft game",
    focusBlock: 2,
    word: "Skills",
    wordFraming:
      "Smart beats strong. The kid who can take pace off the ball wins more points than the kid who adds it.",
    games: ["seven-eleven", "kitchen-game"],
    ritual: "squirrel",
    coachLooksFor:
      "Can they keep the same soft contact as they move backwards? The Slinky exposes it immediately.",
    parentLine:
      "We worked the Slinky — dinking at the kitchen, then stepping back a step at a time and keeping it soft the whole way to the baseline.",
    homeRep: "Bounce the ball on the paddle, low and controlled, twenty in a row.",
  },
  {
    week: 3,
    date: FALL_SUNDAYS[2],
    title: "Starting the point",
    focusBlock: 6,
    word: "Excellence",
    wordFraming:
      "Same target, same swing, every time. Excellence isn't the fancy shot — it's the boring one you can repeat.",
    games: ["skinny-singles", "seven-eleven"],
    ritual: "jailbreak",
    coachLooksFor:
      "Deep serves, deep returns, and whether they move to the kitchen line after the return instead of admiring it.",
    parentLine:
      "Serves and returns — getting them deep, and then getting up to the net behind them.",
    homeRep: "Ten drop serves at one target. Then ten more at a different one.",
  },
  {
    week: 4,
    date: FALL_SUNDAYS[3],
    title: "The third shot",
    focusBlock: 3,
    word: "Ethics",
    wordFraming:
      "When in doubt, it's IN. You call your own side, never theirs — and the close one goes to your opponent.",
    games: ["seven-eleven", "king-of-the-court"],
    ritual: "squirrel",
    coachLooksFor:
      "Are they CHOOSING drop or drive, or just swinging? Making them say it out loud before they hit is the tell.",
    parentLine:
      "The third shot — the choice between a soft drop into the kitchen and a hard drive at the feet, and when each one is right.",
    homeRep: "Say the shot out loud before you hit it. Every ball, for five minutes.",
  },
  {
    week: 5,
    date: FALL_SUNDAYS[4],
    title: "Owning the net",
    focusBlock: 4,
    word: "Attitude",
    wordFraming:
      "You will get beaten at the net today. Good — that's the rep. Reset your paddle and go again.",
    games: ["kitchen-game", "king-of-the-court"],
    ritual: "jailbreak",
    coachLooksFor:
      "Paddle height between shots. It drops the moment they stop thinking about it, and that's the whole block.",
    parentLine:
      "Hands at the net — blocking pace instead of swinging at it, and holding the kitchen line as a pair.",
    homeRep: "Paddle up, out in front. Hold it there while you watch TV. Two minutes.",
  },
  {
    week: 6,
    date: FALL_SUNDAYS[5],
    title: "Put it together",
    focusBlock: 5,
    word: "Excellence",
    wordFraming:
      "Better than yesterday. Not better than the kid across the net — better than the you that walked on six weeks ago.",
    games: ["king-of-the-court", "kitchen-game"],
    ritual: "jailbreak",
    coachLooksFor:
      "Everything, under pressure, with parents watching. And each kid's own week-1 number, beaten.",
    parentLine:
      "Everything, in real games — and each kid measured against their own week-1 number, never against each other.",
    homeRep: "Nothing. Go play a game with someone for fun.",
  },
] as const;

export function weekForDate(iso: string): SeasonWeek | undefined {
  return FALL_SEASON_PLAN.find((w) => w.date === iso);
}

export function findWeek(week: number): SeasonWeek | undefined {
  return FALL_SEASON_PLAN.find((w) => w.week === week);
}

/** The focus block's full definition, resolved for rendering. */
export function focusBlockFor(week: SeasonWeek) {
  const block = SKILL_STACK.find((b) => b.order === week.focusBlock);
  if (!block) throw new Error(`Week ${week.week} points at unknown block ${week.focusBlock}`);
  return block;
}

/** The week's games, resolved for rendering. */
export function gamesFor(week: SeasonWeek) {
  return week.games.map((slug) => {
    const game = MODIFIED_GAMES.find((g) => g.slug === slug);
    if (!game) throw new Error(`Week ${week.week} points at unknown game ${slug}`);
    return game;
  });
}

export function ritualFor(week: SeasonWeek) {
  const game = MODIFIED_GAMES.find((g) => g.slug === week.ritual);
  if (!game) throw new Error(`Week ${week.week} points at unknown ritual ${week.ritual}`);
  return game;
}

/**
 * Both Sunday blocks run the same plan — the difference is the dials and the
 * ball, not the curriculum. Re-exported so the playbook page renders the
 * season's real times without importing two files.
 */
export const FALL_BLOCKS = FALL_YOUTH_BLOCKS;

/** Sanity anchor: the plan is exactly as long as the season. */
export const FALL_PLAN_WEEKS = FALL_SEASON_WEEKS;
