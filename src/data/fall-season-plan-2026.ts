// The Fall 2026 season plan — six Sundays, one focus each, mapped 1:1 onto the
// real dates in fall-2026.ts. TWO arcs on that one calendar since 2026-09-14:
// Green is the fundamentals ladder, Yellow builds on it.
//
// WHY IT'S A PLAN AND NOT A PILE OF DRILLS. A family paid $225 up front for a
// six-week arc. What they bought is a progression: week 1 finds out where their
// kid is, weeks 2–5 each add one thing on top of the last, week 6 puts it under
// pressure and shows them. If the weeks were interchangeable we'd be selling
// six drop-ins with a discount.
//
// WHY TWO ARCS. A Yellow kid has already climbed Green's ladder — the soft
// game, serve and return, the third shot, the net. Running them up it again at
// a faster pace is still the same six sessions. Sam's framing (2026-09-14):
// "we should be building upon what they learned in Green as they go through
// Yellow — the more advanced spins, shot selection, shot patterns, strategizing
// against types of opponent weaknesses, building on your strengths, learning to
// win. Green is more the fundamentals." Those six things ARE the six Yellow
// Sundays, in that order. Both arcs share the date and the Word of the Day (one
// word per Sunday, so the coach carries it across both blocks), each goes deep
// on a different Skill Stack block every week, and both open with a measured
// baseline so the finale can show a kid their own week-1 number.
//
// The Green order is not arbitrary either. It walks the Skill Stack outward
// from the kitchen — where the ball is slow and success is cheap — to the
// baseline and the serve, then back in for the net game. Each week's focus is
// the block the coach goes DEEP on; all six blocks still run every session,
// because the ritual is what lets a kid self-run the hour. Yellow's order
// follows the list above instead: spin is taught first at the kitchen for the
// same reason (a nine-year-old can feel what topspin does to a bounce there),
// then selection, patterns, reading opponents, a weapon, and winning.
//
// The dates come from FALL_SUNDAYS. If a Sunday washes out and slides to a rain
// date, both plans slide with it — the weeks stay in order, they just land on
// different dates. Never reorder the weeks to fit a calendar.

import {
  FALL_SUNDAYS,
  FALL_YOUTH_BLOCKS,
  FALL_SEASON_WEEKS,
  type FallBlockLevel,
} from "./fall-2026";
import { SKILL_STACK, MODIFIED_GAMES } from "./session-curriculum";

/** The EASE value that is the Word of the Day for a given week. */
export type EaseWord = "Ethics" | "Attitude" | "Skills" | "Excellence";

/** One arc per Sunday block: the colour group the plan is written for. */
export type SeasonPlanGroup = FallBlockLevel;

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

/**
 * The Green arc — the fundamentals ladder. This is the ORIGINAL plan and keeps
 * its original name on purpose: the curriculum override layer's `week.<n>.<prop>`
 * ids resolve against it, so every override Sam has already written keeps its
 * meaning. The Yellow arc is `FALL_SEASON_PLAN_YELLOW` below.
 */
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

/** Same plan, named for what it is. */
export const FALL_SEASON_PLAN_GREEN = FALL_SEASON_PLAN;

/**
 * The Yellow arc — builds on Green. Same Sundays, same Word of the Day, a
 * different block each week; the six themes are Sam's list in Sam's order.
 */
export const FALL_SEASON_PLAN_YELLOW: readonly SeasonWeek[] = [
  {
    week: 1,
    date: FALL_SUNDAYS[0],
    title: "Spin, from the first ball",
    focusBlock: 1,
    word: "Attitude",
    wordFraming:
      "Today is not a test. It's the first line on your own chart — and everything you learned in Green is the floor, not the ceiling.",
    games: ["kitchen-game", "seven-eleven"],
    ritual: "jailbreak",
    coachLooksFor:
      "Every kid's longest rally and week-1 number — the baseline the rest of the season is measured against — and whether they can put two different spins on the same dink on purpose: topspin that dips, slice that skids.",
    parentLine:
      "We found where every kid is starting, and put spin on the table — topspin that dips and slice that skids, and what each one does to the bounce.",
    homeRep: "Wall rally: ten with topspin, ten with slice. Watch what the ball does after it bounces.",
  },
  {
    week: 2,
    date: FALL_SUNDAYS[1],
    title: "Shot selection",
    focusBlock: 3,
    word: "Skills",
    wordFraming:
      "Smart beats strong. The kid who picks the right shot beats the kid with the best shot.",
    games: ["seven-eleven", "king-of-the-court"],
    ritual: "squirrel",
    coachLooksFor:
      "Are they choosing from what they see — ball height, where the opponents are standing — or hitting their favourite shot regardless? The tell is whether the choice changes when the feed changes. Shake and Bake off the drive is the Yellow add.",
    parentLine:
      "Shot selection — reading the ball and the other side of the net, then choosing drop, drive or reset on purpose instead of by habit.",
    homeRep: "Say the shot out loud before you hit it. Every ball, for five minutes.",
  },
  {
    week: 3,
    date: FALL_SUNDAYS[2],
    title: "Shot patterns",
    focusBlock: 2,
    word: "Excellence",
    wordFraming:
      "Same pattern, same swing, every time. Excellence is a plan you can repeat, not a shot you got lucky with.",
    games: ["skinny-singles", "seven-eleven"],
    ritual: "jailbreak",
    coachLooksFor:
      "Can they name the pattern before the point — drop, move up, reset, attack; cross-court dink, then down the line — and then play it? Two shots that belong together beat one great shot.",
    parentLine:
      "Shot patterns — two- and three-shot combinations: the drop that gets you to the net, the cross-court dink that sets up the down-the-line, the drive and the crash behind it.",
    homeRep: "Pick one two-shot pattern. Shadow-swing it ten times in order, saying each shot as you go.",
  },
  {
    week: 4,
    date: FALL_SUNDAYS[3],
    title: "Finding the weakness",
    focusBlock: 5,
    word: "Ethics",
    wordFraming:
      "When in doubt, it's IN. Playing to a weakness is smart; calling a close one your way is not — the close one goes to your opponent, always.",
    games: ["kitchen-game", "king-of-the-court"],
    ritual: "squirrel",
    coachLooksFor:
      "Are they probing — a ball to the backhand, a dink that makes the slow kid move, a speed-up at the one who pops it up — and then going back to what worked? Reading an opponent is a habit, not a guess.",
    parentLine:
      "Reading the other side — finding the backhand, the player who's slow to the line, the one who pops it up under pressure — and building the point at that weakness.",
    homeRep: "Watch two minutes of any pickleball match. Name one thing each player does badly, out loud.",
  },
  {
    week: 5,
    date: FALL_SUNDAYS[4],
    title: "Playing to your strengths",
    focusBlock: 4,
    word: "Attitude",
    wordFraming:
      "You've got a weapon. Everyone does. This week you find out what yours is — and you build the point to it instead of waiting for it.",
    games: ["king-of-the-court", "seven-eleven"],
    ritual: "jailbreak",
    coachLooksFor:
      "Each kid names their weapon out loud — hands, drive, drop, patience — and I want to see points built to END on it. With a partner: 'mine', 'yours', and who takes the middle.",
    parentLine:
      "Playing to your strengths — every kid named their weapon and learned to build the point so it ends on it, and to say 'mine' and 'yours' so the pair plays to both.",
    homeRep: "Write your weapon on a sticky note. Put it on the fridge. Look at it before Sunday.",
  },
  {
    week: 6,
    date: FALL_SUNDAYS[5],
    title: "Learning to win",
    focusBlock: 6,
    word: "Excellence",
    wordFraming:
      "Better than yesterday. Not better than the kid across the net — better than the you that walked on six weeks ago. That is what winning is.",
    games: ["king-of-the-court", "kitchen-game"],
    ritual: "jailbreak",
    coachLooksFor:
      "Serving at 9–9 without rushing. Closing a game out. The reset when it gets loud. Then the playoff — and each kid's own week-1 number, beaten.",
    parentLine:
      "Learning to win — serving under pressure, closing out a game, the reset when it gets loud — then the playoff, with each kid measured against their own week-1 number, never against each other.",
    homeRep: "Nothing. Go play a game with someone for fun.",
  },
] as const;

/** One arc per Sunday block. Keys are the block levels in fall-2026.ts. */
export const FALL_SEASON_PLANS: Readonly<Record<SeasonPlanGroup, readonly SeasonWeek[]>> = {
  Green: FALL_SEASON_PLAN_GREEN,
  Yellow: FALL_SEASON_PLAN_YELLOW,
};

export function seasonPlanFor(group: SeasonPlanGroup): readonly SeasonWeek[] {
  return FALL_SEASON_PLANS[group];
}

/** Green by default — the original single-arc callers keep their meaning. */
export function weekForDate(iso: string, group: SeasonPlanGroup = "Green"): SeasonWeek | undefined {
  return seasonPlanFor(group).find((w) => w.date === iso);
}

export function findWeek(week: number, group: SeasonPlanGroup = "Green"): SeasonWeek | undefined {
  return seasonPlanFor(group).find((w) => w.week === week);
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
 * The two Sunday blocks, one arc each (Green 1:00, Yellow 2:30). Re-exported
 * so the playbook page renders the season's real times without importing two
 * files.
 */
export const FALL_BLOCKS = FALL_YOUTH_BLOCKS;

/** Sanity anchor: each plan is exactly as long as the season. */
export const FALL_PLAN_WEEKS = FALL_SEASON_WEEKS;
