// The NGA session curriculum — the single source of truth for what happens on
// court, in what order, with what words, under what rules.
//
// This file is NOT season-specific. The Fall 2026 Sunday season is its first
// consumer (see fall-season-plan-2026.ts), but Pickl Park Saturdays, camps,
// drop-ins, and any future season run the same spine. Editing a drill here
// changes every surface that renders it.
//
// PROVENANCE. Everything below is reconciled against the live NGA Coaching
// System rather than invented:
//   - The Skill Stack, the two pillars, the Kid-Coach Role, the Dials, Red
//     Philosophy, the Mismatched-Level Playbook and the mantra come from the
//     NGA Shared Vocabulary + The Coaching Handbook.
//   - Every named game's rules are the VERIFIED rules from the canonical
//     "Games & Activities" library (the same reconcile that caught a guessed
//     Kitchen Game rule in June 2026 — it is 2v2 rally-to-11 at the NVZ, NOT
//     "dink-only, first to break the kitchen loses").
//   - EASE and "Better than yesterday — together" come from the brand guide.
// If any of those sources contradict this file, the source wins: fix it there,
// then mirror it here.
//
// TWO AXES, DELIBERATELY SEPARATE. Ball color governs EQUIPMENT AND RULES
// (serves, kitchen, two-bounce, scoring, court size). Age band governs THE
// DIALS (energy, block length, language, rotation cadence, how long a game
// runs). They are independent on purpose: a twelve-year-old on their first day
// plays Orange rules at the 13U dial, and a strong nine-year-old plays Green
// rules at the 9U dial. Collapsing them into one ladder is how a kid ends up
// either bored or drowning.

import type { BallColor } from "./levels";

// ─────────────────────────────────────────────────────────────────────────────
// The pillars + the mantra — the two standards every block below is built to
// satisfy. Quoted verbatim; they are load-bearing terms, not paraphrasable.
// ─────────────────────────────────────────────────────────────────────────────

export const PILLAR_ACTIVE_HEART_RATE =
  "Every kid — hitting, moving, or coaching — always.";
export const PILLAR_FEEDBACK_DENSITY = "Every kid · every 2–5 minutes · by name.";
export const COACHING_MANTRA = "We coach the conditions. The rally teaches.";
export const NGA_TAGLINE = "Better than yesterday — together.";

/** The ideal coach-to-kid ratio. Past this, the Kid-Coach Role activates. */
export const IDEAL_COACH_RATIO = 4;

// ─────────────────────────────────────────────────────────────────────────────
// Age bands — the DIALS axis. Bands are "and under": a child plays the lowest
// band their age fits. Playing up is a coach decision, never a form rule, and
// never down.
//
// NOTE (drift, deliberate): docs/youth-pickleball-league-blueprint.md and
// src/data/leagues.ts carry an older FOUR-band split (7U/10U/14U/16U) designed
// for a fixed-roster league that has not launched. These five bands are Sam's
// current call and are what the curriculum runs on. Reconcile leagues.ts when
// that league ships — do not silently "fix" one to match the other, because
// they answer different questions.
// ─────────────────────────────────────────────────────────────────────────────

export type AgeBand = "7U" | "9U" | "11U" | "13U" | "16U";

export interface AgeBandDials {
  band: AgeBand;
  minAge: number;
  maxAge: number;
  /** Developmental framing, one line. */
  stage: string;
  /** Minutes per Skill Stack block. The clock is the discipline. */
  blockMinutes: number;
  /** Cooperative rally target that counts as "good" for this band. */
  rallyTarget: number;
  /** How the coach talks. External-focus cues at every band; depth differs. */
  language: string;
  /** How long a modified game runs before rotating. */
  gameMinutes: number;
  /** Where the Kid-Coach Role sits for this band. */
  kidCoach: string;
  /** What the closing ritual is for. */
  closingVibe: string;
}

export const AGE_BANDS: readonly AgeBandDials[] = [
  {
    band: "7U",
    minAge: 6,
    maxAge: 7,
    stage: "FUNdamentals — athletic development that happens to use a paddle.",
    blockMinutes: 3,
    rallyTarget: 3,
    language: "Simple cue words. One idea per rep. Name the body part or the target, never both.",
    gameMinutes: 4,
    kidCoach: "Scaffolded — the coach gives them the one thing to watch and the words to say.",
    closingVibe: "Pure fun. No score kept, no winner named.",
  },
  {
    band: "9U",
    minAge: 8,
    maxAge: 9,
    stage: "Learning to train — the golden skill-acquisition window opens.",
    blockMinutes: 4,
    rallyTarget: 6,
    language: "Short external cues tied to a target. Ask before you tell.",
    gameMinutes: 5,
    kidCoach: "Counting and calling — 'count their cross-court dinks, tell them their best streak.'",
    closingVibe: "Fun with a shape — everyone gets a turn, nobody sits.",
  },
  {
    band: "11U",
    minAge: 10,
    maxAge: 11,
    stage: "Learning to train — heaviest technical load of any band.",
    blockMinutes: 5,
    rallyTarget: 10,
    language: "External cues plus the why. Start naming the shot: drop, drive, reset.",
    gameMinutes: 6,
    kidCoach: "Active — reinforces today's block focus for the kid they're watching.",
    closingVibe: "Competitive fun. Scores exist and then get forgotten.",
  },
  {
    band: "13U",
    minAge: 12,
    maxAge: 13,
    stage: "Training to train — tactics become the point, not the garnish.",
    blockMinutes: 6,
    rallyTarget: 12,
    language: "Technical and tactical. Ask what they saw before you say what you saw.",
    gameMinutes: 7,
    kidCoach: "Fully active — can run a station and referee a younger court.",
    closingVibe: "Strategic and fun — the game rewards the thing we drilled.",
  },
  {
    band: "16U",
    minAge: 14,
    maxAge: 16,
    stage: "Training to compete — tournament-grade execution and composure.",
    blockMinutes: 6,
    rallyTarget: 15,
    language: "Full vocabulary. Player-led debrief; the coach asks, the player diagnoses.",
    gameMinutes: 8,
    kidCoach: "Mentor track — assists a younger court under direct line-of-sight (see the playbook).",
    closingVibe: "Competitive, self-officiated, and still ends laughing.",
  },
] as const;

/** Strict academy range. No under-6 on-ramp, no exceptions. */
export const CURRICULUM_AGE_MIN = 6;
export const CURRICULUM_AGE_MAX = 16;

export function bandForAge(age: number): AgeBandDials | undefined {
  return AGE_BANDS.find((b) => age >= b.minAge && age <= b.maxAge);
}

export function findAgeBand(band: string): AgeBandDials | undefined {
  return AGE_BANDS.find((b) => b.band === band);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ball-color rules — the RULES axis. What actually changes on court between a
// Red court and a Yellow court, stated precisely enough that a volunteer court
// captain can enforce it without asking.
//
// The two rules that look backwards and aren't:
//
// 1. RED GETS ONE SERVE, ORANGE GETS TWO. Red's single serve is not a harsher
//    standard — it's the opposite. At Red the serve is not the point; the rally
//    is. One attempt, and if it doesn't go in, the RECEIVING side feeds and the
//    rally starts anyway. Nobody stands still waiting for a serve to land.
//    Orange gets two because at Orange the serve IS a skill being learned, and
//    a second attempt is the low-stakes rep that lets them swing at it. Green
//    and Yellow return to one — tournament standard — because by then it's a
//    shot they own.
//
// 2. RED HAS NO KITCHEN. Straight out of Play-and-Stay and the Level 2
//    progression: removing the non-volley zone cuts one whole rule out of a
//    six-year-old's working memory so the attention goes to tracking the ball
//    and finding the paddle face. The kitchen comes back at Orange, along with
//    the two-bounce rule, and it never leaves again.
//
// Both are single-line edits here if Sam wants them different — no other file
// hardcodes a serve count or a kitchen rule.
// ─────────────────────────────────────────────────────────────────────────────

export interface BallRules {
  color: BallColor;
  label: string;
  /** The physical ball + why. */
  ball: string;
  /** Typical age range on this ball — guidance, never a gate. */
  typicalAges: string;
  /** Serves allowed per point, and from where. */
  serve: string;
  /** What happens when the last serve misses. */
  serveMiss: string;
  /** Non-volley-zone rule as enforced at this level. */
  kitchen: string;
  /** Two-bounce (double-bounce) rule as enforced at this level. */
  twoBounce: string;
  /** Playing surface. */
  court: string;
  /** How a game is scored and how long it runs. */
  scoring: string;
  /** The one thing a court captain should be watching for. */
  captainWatch: string;
}

export const BALL_RULES: readonly BallRules[] = [
  {
    color: "red",
    label: "Red Ball",
    ball: "Foam or red low-bounce ball — slow enough that a new player can arrive, set, and swing.",
    typicalAges: "6–8, or any age on day one",
    serve: "One serve, underhand, from behind the baseline.",
    serveMiss:
      "No fault, no lost point — the receiving side feeds and the rally starts. Protect the rally.",
    kitchen:
      "OFF. No non-volley zone is called. One less rule to hold while they learn to track the ball.",
    twoBounce: "OFF. Play the ball however it comes.",
    court: "Short court — service boxes only, or half a court per pair.",
    scoring:
      "Cooperative rally targets, not points. 'Can we get to five together?' No winner is named.",
    captainWatch:
      "Is every kid swinging? A Red court that goes quiet has stopped being a rally and started being a line.",
  },
  {
    color: "orange",
    label: "Orange Ball",
    ball: "Orange ball — faster than Red, still forgiving enough to rally.",
    typicalAges: "8–10",
    serve: "Two serves, underhand, from behind the baseline. The second one is a real mulligan.",
    serveMiss: "Second miss is a fault and the point goes over. Say it warmly, move on fast.",
    kitchen:
      "ON, taught generously. First foot fault is a warning and a re-do — 'toe the line' — not a lost point.",
    twoBounce: "ON. Serve bounces, return bounces, then anyone may volley.",
    court: "Full court.",
    scoring: "Rally scoring to 7, win by 1. Short games so rotation stays on the clock.",
    captainWatch:
      "Are they letting the return bounce? Orange is where the two-bounce habit is built or missed.",
  },
  {
    color: "green",
    label: "Green Ball",
    ball: "Green ball — near-standard pace with a little forgiveness left in it.",
    typicalAges: "10+",
    serve: "One serve, from behind the baseline.",
    serveMiss: "Fault. Point to the other side.",
    kitchen: "ON, standard. Faults are called.",
    twoBounce: "ON, standard.",
    court: "Full court.",
    scoring:
      "Rally scoring to 9, win by 1, for rotating games; to 11, win by 2, for the feature game.",
    captainWatch:
      "Do both partners get to the kitchen line together after the return? That's the Green habit.",
  },
  {
    color: "yellow",
    label: "Yellow Ball",
    ball: "Standard yellow ball — tournament equipment, tournament speed.",
    typicalAges: "12+",
    serve: "One serve, from behind the baseline. Tournament standard.",
    serveMiss: "Fault. Point to the other side.",
    kitchen: "ON, standard, self-officiated.",
    twoBounce: "ON, standard, self-officiated.",
    court: "Full court.",
    scoring: "Rally scoring to 11, win by 2. Self-called, self-kept.",
    captainWatch:
      "Are calls being made honestly and calmly? At Yellow the officiating IS part of the curriculum.",
  },
] as const;

export function rulesForColor(color: BallColor): BallRules {
  const rules = BALL_RULES.find((r) => r.color === color);
  if (!rules) throw new Error(`Unknown ball color: ${color}`);
  return rules;
}

/**
 * The line-call rule that outranks every rule above, at every level.
 * It resolves most disputes before a coach ever hears about them.
 */
export const GENEROSITY_RULE =
  "When in doubt, it's IN. You call your own side only, never theirs. Genuine stalemate? Rock-paper-scissors for the point, then play on.";

// ─────────────────────────────────────────────────────────────────────────────
// THE SKILL STACK — the six-block teaching sequence, run in this order, every
// session, at every level. The order is the pedagogy: start at the kitchen
// where the ball is slowest and success is cheapest, walk backwards to the
// baseline as control builds, and only then add the serve. Kids who arrive
// mid-block still land in a block they recognize.
//
// One block = one court of four = one volunteer court captain holding one
// clock. The captain's job is the transition, not the teaching.
//
// FIVE-BLOCK DAY: if the clock is short, cut block 5 (Kitchen Play). It is the
// competitive extension of block 1, so its skill still got reps. Never cut
// block 6 to save time — a session that never serves is a session that never
// starts a point.
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillBlock {
  order: number;
  /** Canonical NGA name — do not rename. */
  name: string;
  /** The everyday name kids and parents actually use. */
  alias: string;
  /** What this block is for, one line. */
  teaches: string;
  /** How the court is set up. Volunteer-readable. */
  setup: string;
  /** Where the four bodies stand. */
  formation: string;
  /** How partners change inside the block, and how often. */
  rotation: string;
  /**
   * Vocabulary cues, in escalating order. External-focus first (where the ball
   * goes), internal-focus only if external hasn't landed — external cues learn
   * faster, and that is the whole reason this list is ordered.
   */
  cues: readonly string[];
  /** The named NGA term(s) this block owns, for the shared-vocabulary ladder. */
  vocabulary: readonly string[];
  /** How the block changes by ball color. */
  scaling: string;
  /** The one thing the court captain calls out. */
  captainCue: string;
}

export const SKILL_STACK: readonly SkillBlock[] = [
  {
    order: 1,
    name: "Kitchen to Kitchen",
    alias: "K2K",
    teaches: "Soft hands, ball tracking, and the shortest path to a real rally.",
    setup:
      "All four players at the non-volley-zone line, two per side. One ball per court. No serves — a captain feed starts every rally.",
    formation: "2 v 2, everyone toed up to the kitchen line, facing across.",
    rotation:
      "Straight-across pairs for the first half, then the two players on the right rotate one court clockwise. Every kid sees a new partner inside the block.",
    cues: [
      "Push it, don't hit it.",
      "Land it in front of them, not at them.",
      "Paddle out in front — you should see it in the corner of your eye.",
      "Bend at the knees, not the waist.",
    ],
    vocabulary: ["K2K", "Dink"],
    scaling:
      "Red: catch-and-toss first, then one bounce allowed between hits. Orange: one bounce allowed. Green/Yellow: cross-court only, then add the down-the-line switch.",
    captainCue: "Count the rally out loud. The number is the scoreboard.",
  },
  {
    order: 2,
    name: "Transition",
    alias: "The Slinky",
    teaches:
      "The relationship between distance, force, and trajectory — and how to absorb pace instead of adding to it.",
    setup:
      "Start the pair at the kitchen line dinking. On the captain's call, both players take one step back and keep the rally alive. Step back again. And again — out to the baseline — then walk it back in.",
    formation:
      "1 v 1 or 2 v 2 across the net, moving as a connected line. The court stretches and compresses like a slinky.",
    rotation:
      "The pair owns the whole block; the captain calls 'back' and 'in'. Swap partners at the halfway whistle.",
    cues: [
      "Same soft hands, longer runway.",
      "Absorb the pace. Don't add to it.",
      "Aim for the same spot in their kitchen from every distance.",
      "If it pops up, you stepped back before you were ready — take one step in.",
    ],
    vocabulary: ["The Slinky", "Reset From Transition"],
    scaling:
      "Red: two steps back, that's the whole drill. Orange: to mid-court. Green: to the baseline and back. Yellow: add a live third-shot drop off the last step.",
    captainCue: "Call the step. Nobody moves back until the ball is going in.",
  },
  {
    order: 3,
    name: "Drops and Drives",
    alias: "Groundstrokes",
    teaches: "The two answers to the same ball — and choosing between them on purpose.",
    setup:
      "Two players at the baseline, two at the kitchen. Captain feeds to the baseline pair, who must land a drop into the kitchen OR drive at the feet of the net pair. Live from there.",
    formation: "2 back v 2 up. The baseline pair is working; the net pair is the condition.",
    rotation: "Swap ends every two minutes so nobody spends the block at one end of the court.",
    cues: [
      "Low to high — brush up the back of the ball.",
      "Drop lands in the kitchen; drive lands at their shoelaces. Pick one before you swing.",
      "Short backswing. The power is in the legs.",
      "Finish where you're aiming.",
    ],
    vocabulary: ["Third Shot Drop", "Drive", "Shot Selection"],
    scaling:
      "Red: rolling and tossing to a target, no full swing. Orange: drop only, bounce allowed. Green: drop or drive, called out loud before the shot. Yellow: add Shake and Bake off the drive.",
    captainCue: "Make them say which one they're hitting before they hit it.",
  },
  {
    order: 4,
    name: "Volleys",
    alias: "Hands",
    teaches: "Reaction, paddle position, and blocking pace without swinging at it.",
    setup:
      "Pairs across the net at the kitchen line, feeding each other volleys — no bounce. Start cooperative, then let the captain speed it up.",
    formation: "2 v 2 at the kitchen, or four pairs across a single net for a big group.",
    rotation: "Every 90 seconds the captain calls 'switch' and one line slides one spot right.",
    cues: [
      "Paddle up, out in front, before the ball comes.",
      "Block it — catch it with the paddle face, don't swing.",
      "Eyes on their paddle, not on the ball in the air.",
      "Reset your paddle after every single hit.",
    ],
    vocabulary: ["Block Volley", "Chicken Wing", "Ready Position"],
    scaling:
      "Red: catch-and-toss, then one volley each. Orange: cooperative counting. Green: speed it up on the captain's call. Yellow: full hands battle, and counter the speed-up.",
    captainCue: "Watch paddle height. When it drops, say the kid's name and 'paddle up'.",
  },
  {
    order: 5,
    name: "Kitchen Play",
    alias: "The Dink Battle",
    teaches:
      "Patience under pressure — moving opponents, waiting for the pop-up, and knowing when to attack.",
    setup:
      "Same shape as block 1, but competitive: cross-court dink rallies where the point is live and a high ball may be attacked.",
    formation: "2 v 2 at the kitchen, cross-court pairs.",
    rotation: "Winners slide right, losers slide left, every two points. Nobody sits.",
    cues: [
      "Move them side to side. The pop-up comes to you.",
      "Attack the high one. Never force the low one.",
      "If it's above the net, it's yours. Below the net, reset it.",
      "Be the last one to make a mistake.",
    ],
    vocabulary: ["Speed-Up", "Dink Battle", "Reset"],
    scaling:
      "Red: cut this block — the skill got its reps in block 1. Orange: cooperative with a target. Green: live, attack allowed above the net. Yellow: full battle with counters.",
    captainCue: "Say 'high ball' out loud when you see one. Teach them to see it.",
  },
  {
    order: 6,
    name: "Serve and Return",
    alias: "Starting the Point",
    teaches: "Starting the point on purpose, and the return that gets you to the line.",
    setup:
      "Two servers behind the baseline, two returners diagonally across. Serve, return deep, both returners advance to the kitchen. Reset and repeat.",
    formation: "2 v 2 diagonal, everyone behind the baseline to start.",
    rotation: "Five serves each, then rotate: servers become returners.",
    cues: [
      "Drop the ball, don't toss it. Let it bounce and hit it.",
      "Serve deep — aim past the middle of their box, not at the line.",
      "Return deep, then run to the line. The return buys you the front of the court.",
      "One target, one swing, same rhythm every time.",
    ],
    vocabulary: ["Drop Serve", "Deep Return", "Two-Bounce Rule"],
    scaling:
      "Red: one serve from behind the baseline, no fault called — if it misses, the returner feeds and the rally starts. Orange: two serves. Green/Yellow: one serve, faults called.",
    captainCue: "Count serves in. Ten in a row as a court is a real thing to celebrate.",
  },
] as const;

export function findSkillBlock(order: number): SkillBlock | undefined {
  return SKILL_STACK.find((b) => b.order === order);
}

/** The block to cut first when the clock is short. */
export const CUTTABLE_BLOCK_ORDER = 5;

// ─────────────────────────────────────────────────────────────────────────────
// MODIFIED GAMES — the bridge from drilling to competing. The Skill Stack
// builds the shot; these games make the kid choose it under pressure, which is
// the only way it survives into a real point. The game IS the assessment: the
// coach never has to test anything, because the constraint does it.
//
// Rules below are the VERIFIED rules from the canonical Games & Activities
// library. Do not paraphrase them — a guessed Kitchen Game rule shipped once
// and had to be corrected on two surfaces.
// ─────────────────────────────────────────────────────────────────────────────

export type GamePurpose = "learning" | "competing" | "ritual";

export interface ModifiedGame {
  slug: string;
  name: string;
  purpose: GamePurpose;
  /** Which Skill Stack block this game reps. 0 = whole-session / no single block. */
  repsBlock: number;
  /** Players on court at once. */
  players: string;
  /** Minimum age this game genuinely works at. */
  minAge: number;
  setup: string;
  rules: string;
  /** How it changes by ball color / age band. */
  scaling: string;
  /** What the court captain does while it runs. */
  captainRole: string;
}

export const MODIFIED_GAMES: readonly ModifiedGame[] = [
  {
    slug: "kitchen-game",
    name: "Kitchen Game",
    purpose: "competing",
    repsBlock: 5,
    players: "4 (2 v 2)",
    minAge: 10,
    setup: "2 v 2, all four players start at the kitchen (non-volley-zone) line.",
    rules:
      "Any player feeds to start. Standard pickleball rally scoring — every rally is a point. First to 11, win by 2. Use 7 for a short game.",
    scaling:
      "Day one or a young court: play to 7. Beginners may take one bounce before returning. Rotate teams after every game.",
    captainRole:
      "Keep the score out loud so nobody argues it. Restart within ten seconds of a point ending.",
  },
  {
    slug: "seven-eleven",
    name: "7-11",
    purpose: "competing",
    repsBlock: 2,
    players: "2 (1 v 1), or 1 v 2",
    minAge: 8,
    setup:
      "Net player starts at the kitchen line, deep player at the baseline. Captain feeds the opening ball.",
    rules:
      "Asymmetric scoring: the net player needs 7 to win, the deep player needs 11. Rally scoring. The deep player's job is to land a third-shot drop and advance to the kitchen; the net player defends the line. Swap roles and play again.",
    scaling:
      "Beginners: play 5 and 9, and allow a bounce. Green/Yellow: play it straight — the asymmetry is the lesson.",
    captainRole:
      "Feed fast, call the score, and swap roles at the end. Never let a kid stay stuck in the deep position all block.",
  },
  {
    slug: "skinny-singles",
    name: "Skinny Singles",
    purpose: "competing",
    repsBlock: 3,
    players: "2 (1 v 1)",
    minAge: 8,
    setup:
      "1 v 1 using only half the court — either the cross-court diagonal halves or the straight-ahead sideline lanes.",
    rules:
      "Play only within the designated narrow lane; outside it is out. Two-bounce and kitchen rules apply. Rally scoring to 11, win by 2 — or 7 for a quick game. Switch lanes each game.",
    scaling:
      "Cross-court is more forgiving than the straight lane — start there. Pair by level and rotate opponents every game.",
    captainRole:
      "Watch the lane line, not the score. The narrow court is what forces control over power.",
  },
  {
    slug: "king-of-the-court",
    name: "King of the Court",
    purpose: "competing",
    repsBlock: 4,
    players: "4+ with a challenger line",
    minAge: 10,
    setup:
      "Designate one court as the King's Court. Teams of 2 (or singles). Challengers line up on the sideline.",
    rules:
      "Short rally-scored games to 3–5, or single golden points. Winners stay on the King's side; losers rotate to the back of the challenger line. Next challengers feed in immediately. Goal: hold the King's Court as long as you can.",
    scaling:
      "Keep games SHORT so rotation stays fast — this is an engagement format before it is a competition. Level-match the challenger line so it stays fair.",
    captainRole:
      "Own the challenger line. The next pair should be stepping on before the last pair is off.",
  },
  {
    slug: "squirrel",
    name: "Squirrel",
    purpose: "ritual",
    repsBlock: 0,
    players: "4 on court, everyone else in a sideline line",
    minAge: 8,
    setup:
      "4 players on court (2 v 2); everyone else lines up on the sideline. Court captain stands to the side with a ball basket.",
    rules:
      "The captain feeds to start each rally — no serves. When the rally ends, identify the 'Squirrel' (the player whose shot ended it). The Squirrel rotates out, the next player in line rotates in, and the captain immediately feeds the next ball. Continuous play, no score.",
    scaling:
      "Be generous with younger kids about who the Squirrel was. Mix up the feed location so the rally never gets predictable.",
    captainRole:
      "This game IS the captain's game. Feed fast, name the Squirrel positively — 'Nice try, Maya, back in line!' — and never let two seconds of silence happen.",
  },
  {
    slug: "jailbreak",
    name: "Jailbreak",
    purpose: "ritual",
    repsBlock: 0,
    players: "4+ (needs at least 4 to work)",
    minAge: 8,
    setup:
      "Players line up at the centre baseline. Court captain feeds the balls. Designate a jail area on the opposite side of the court.",
    rules:
      "Each player in turn hits a fed ball; if it goes in the net or out, they go to jail. Jailed players escape by catching a live ball in the air — and the player who hit it takes their place. The last player standing must hit 2 balls in successfully to win; if they fail, everyone in jail is released — Jailbreak!",
    scaling:
      "Younger kids may catch on one bounce. Call it like a broadcast. If it drags, trigger a Jailbreak and reset.",
    captainRole:
      "Commentate. This is the last five minutes of the day and it is what they'll tell their parents about in the car.",
  },
  {
    slug: "hot-feet-tag",
    name: "Hot Feet Tag",
    purpose: "ritual",
    repsBlock: 0,
    players: "Any group",
    minAge: 6,
    setup: "Spread about 10 balls across the court.",
    rules:
      "Players grab one ball, then freeze in place — pivoting is allowed, stepping is not. Roll balls at other players' knees or below only. A player who gets hit goes to the court captain for a quick exercise (5 jumping jacks, 3 squats) and then rejoins. Rounds run 2 minutes.",
    scaling:
      "Fewer balls for the 7U band. Keep the exercises short and silly. Announce '30 seconds left!' to spike the energy.",
    captainRole:
      "Run the exercise station and keep it fast. This is the warm-up that works when it's cold out.",
  },
] as const;

export function findGame(slug: string): ModifiedGame | undefined {
  return MODIFIED_GAMES.find((g) => g.slug === slug);
}

/** Games that close a session as a ritual rather than teaching a block. */
export const CLOSING_RITUALS = MODIFIED_GAMES.filter((g) => g.purpose === "ritual");

/** Games that put a drilled skill under competitive pressure. */
export const COMPETITIVE_GAMES = MODIFIED_GAMES.filter((g) => g.purpose === "competing");

/**
 * Which game reps which block. There is no cheat sheet in the handbook and
 * there shouldn't be one here either — this is a starting point the coach
 * overrides. Working drops? Kitchen Game. Working transitions? 7-11.
 */
export function gamesForBlock(order: number): readonly ModifiedGame[] {
  return MODIFIED_GAMES.filter((g) => g.repsBlock === order);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SESSION ARC — the ritual. Same shape every week so kids self-run it and
// the coach is free to read players instead of managing traffic. A kid who has
// been three times knows what happens next without being told, which is the
// entire point.
//
// Two decision rules survive from the 60-minute spine and are non-negotiable:
//   - Start the closing ritual when 5 minutes remain. Skip it under 3 minutes
//     or under 4 kids.
//   - Cut the ritual, never the cleanup. Cleanup is the spine; the ritual is
//     dessert.
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionPhase {
  /** Minutes from the session start. */
  startMinute: number;
  endMinute: number;
  name: string;
  /** What is actually happening. */
  what: string;
  /** Who owns this phase — the coach, the captains, or both. */
  owner: "coach" | "captains" | "both";
  /** Why it exists. Cut a phase without knowing this and you cut the wrong one. */
  why: string;
}

/**
 * The 90-minute season block (Fall 2026 Sundays, Pickl Park is 60 — use
 * SESSION_ARC_60 there). Eight kids, two courts, one captain per court.
 */
export const SESSION_ARC_90: readonly SessionPhase[] = [
  {
    startMinute: 0,
    endMinute: 7,
    name: "Arrival Rally",
    what: "Kids pair up and rally kitchen-to-kitchen the moment they step on. No waiting, no warm-up lecture.",
    owner: "captains",
    why: "Kids rallying with each other IS the thing we're selling — every session opens with a rep of it. It is also the coach's parent face-time slot, which is a quiet retention investment.",
  },
  {
    startMinute: 7,
    endMinute: 10,
    name: "Huddle",
    what: "Word of the Day (one EASE value) + today's block focus, in two sentences. Then straight to courts.",
    owner: "coach",
    why: "One theme, said out loud at the start, is what makes the debrief mean anything at the end.",
  },
  {
    startMinute: 10,
    endMinute: 46,
    name: "Skill Stack",
    what: "Six blocks, six minutes each, captain-run. The coach floats between courts giving named feedback.",
    owner: "both",
    why: "Touches, not talk. The clock is the discipline — ±2 minutes is the whole tolerance.",
  },
  {
    startMinute: 46,
    endMinute: 50,
    name: "Pickup and water",
    what: "Everyone picks up balls together, then water. This is the only break in the session.",
    owner: "captains",
    why: "Designed, not incidental. Making the break a job keeps it from becoming five minutes of nothing.",
  },
  {
    startMinute: 50,
    endMinute: 64,
    name: "Modified games",
    what: "Two games, seven minutes each, chosen to rep today's focus.",
    owner: "coach",
    why: "The constraint teaches the tactic. This is where a drilled shot becomes a chosen shot.",
  },
  {
    startMinute: 64,
    endMinute: 82,
    name: "Round robin",
    what: "Rotating-partner games. Every kid partners a different kid; the captain calls the rotation.",
    owner: "captains",
    why: "Rotating partners across a season means every kid plays with every kid — which is what 'together' in the tagline actually costs.",
  },
  {
    startMinute: 82,
    endMinute: 87,
    name: "Closing ritual",
    what: "Jailbreak, or Squirrel for a big group. Whole group, one court, loud.",
    owner: "coach",
    why: "It's the last five minutes, so it's the part they describe in the car. Skip it under 3 minutes or under 4 kids.",
  },
  {
    startMinute: 87,
    endMinute: 90,
    name: "Cleanup and debrief",
    what: "Nets and balls away with the kids, then one win and one focus, by name, before they walk off.",
    owner: "both",
    why: "Non-negotiable. Cut the ritual before you cut this.",
  },
] as const;

/** The 60-minute spine — drop-ins, Pickl Park Saturdays, school clubs. */
export const SESSION_ARC_60: readonly SessionPhase[] = [
  {
    startMinute: 0,
    endMinute: 5,
    name: "Arrival Rally",
    what: "Kids rally K2K; coach greets parents and sets up courts.",
    owner: "captains",
    why: "The hooked signal, once a session.",
  },
  {
    startMinute: 5,
    endMinute: 35,
    name: "Skill Stack",
    what: "Six blocks, five minutes each. Level-matched pairings for the first 30 minutes.",
    owner: "both",
    why: "The clock is the discipline.",
  },
  {
    startMinute: 35,
    endMinute: 45,
    name: "Modified games",
    what: "One or two games tied to today's focus.",
    owner: "coach",
    why: "The game is the assessment.",
  },
  {
    startMinute: 45,
    endMinute: 55,
    name: "Full game",
    what: "Real points. Start whenever at least 15 minutes remain.",
    owner: "captains",
    why: "Everything above was for this.",
  },
  {
    startMinute: 55,
    endMinute: 57,
    name: "Closing ritual",
    what: "Jailbreak. Start when 5 minutes remain.",
    owner: "coach",
    why: "Dessert.",
  },
  {
    startMinute: 57,
    endMinute: 60,
    name: "Cleanup",
    what: "Balls, nets, one win and one focus each.",
    owner: "both",
    why: "The spine.",
  },
] as const;

/**
 * "1:00 PM" + 46 → "1:46 PM". Pure string and integer math on a wall-clock
 * label — deliberately NOT Date arithmetic, which is the documented footgun on
 * a UTC build server.
 */
export function addMinutesToClock(clock: string, minutes: number): string {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(clock.trim());
  if (!match) throw new Error(`Unparseable clock label: ${clock}`);

  const [, rawHour, rawMinute, meridiem] = match;
  const hour12 = Number(rawHour) % 12;
  const base = (meridiem.toUpperCase() === "PM" ? hour12 + 12 : hour12) * 60 + Number(rawMinute);
  const total = ((base + minutes) % 1440 + 1440) % 1440;

  const hour24 = Math.floor(total / 60);
  const outMeridiem = hour24 < 12 ? "AM" : "PM";
  const outHour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${outHour}:${String(total % 60).padStart(2, "0")} ${outMeridiem}`;
}

/** Wall-clock label for a phase, given the session's start time. */
export function phaseClock(phase: SessionPhase, sessionStart: string): string {
  return `${addMinutesToClock(sessionStart, phase.startMinute)}–${addMinutesToClock(
    sessionStart,
    phase.endMinute,
  )}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// COURT CAPTAINS — the parent volunteer role, one per court.
//
// The problem this solves: with two courts running and one coach, the coach
// spends the session managing the clock and the rotation instead of reading
// players. Feedback Density collapses. A captain per court takes the logistics
// so the coach can do the one thing only the coach can do.
//
// THE LINE, and it is bright: captains run the CLOCK, the ROTATION, the SCORE,
// and the BALLS. Coaching is not on that list. A captain who starts fixing a
// kid's grip has stopped doing the job — and worse, may be teaching against
// what the coach said sixty seconds ago. Reinforce loudly ("nice drop, Maya!"),
// correct never.
//
// SAFEGUARDING. These are parent volunteers at a public court with other
// people's children. The rules below are operating rules from day one, not
// aspirations, and they hold whether or not vetting has been completed:
//   - Two-deep leadership. Never one adult alone with kids. If the coach steps
//     away, captains stay together or the session pauses.
//   - No captain is ever alone with a child who isn't theirs — not in a car,
//     not walking to a bathroom, not off the court.
//   - Captains do not discipline. Behaviour goes to the coach, always.
//   - No photographs of other families' children.
//   - Background check / SafeSport-equivalent vetting is a REQUIREMENT, not a
//     nicety. Until it is complete for a given volunteer, that volunteer works
//     only in the coach's direct line of sight. See the season runbook.
// ─────────────────────────────────────────────────────────────────────────────

export interface CaptainDuty {
  phase: string;
  duty: string;
}

/** What a captain is doing at each point in a 90-minute block. */
export const CAPTAIN_RUN_OF_SHOW: readonly CaptainDuty[] = [
  {
    phase: "15 min before",
    duty: "Nets up, balls in the caddy, cones out, water station filled. Court is playable before the first kid arrives.",
  },
  {
    phase: "Arrival Rally",
    duty: "Pair kids up as they walk on and start them rallying. Nobody stands. Tick names off the roster.",
  },
  {
    phase: "Huddle",
    duty: "Get your four to the coach, quietly. Then bring them straight back to your court.",
  },
  {
    phase: "Skill Stack",
    duty: "Hold the six-minute clock and call every transition out loud. Feed when the drill needs a feed. Count rallies. Shout the kid's name and the block cue when they do it right.",
  },
  {
    phase: "Pickup and water",
    duty: "Call it, do it with them, and get them back on court inside four minutes.",
  },
  {
    phase: "Modified games",
    duty: "Set the game up before the coach finishes explaining it. Keep score out loud so nobody argues.",
  },
  {
    phase: "Round robin",
    duty: "Own the rotation board. Call the next pairing before the current game ends so there's no dead air.",
  },
  {
    phase: "Closing ritual",
    duty: "Feed fast and commentate. Both courts combine — one captain feeds, the other runs the line.",
  },
  {
    phase: "Cleanup",
    duty: "Kids carry the gear. Final headcount against the roster before anyone leaves with a parent.",
  },
];

/** The five things a captain says. Deliberately short enough to remember cold. */
export const CAPTAIN_SCRIPT: readonly string[] = [
  "“Switch!” — every transition, loud, on the clock.",
  "“Nice [shot], [name]!” — reinforce by name. This is the whole coaching allowance.",
  "“That’s [n] in a row!” — count the rally. The number is the scoreboard.",
  "“Next up: [names].” — call the pairing before the game ends.",
  "“Coach, can you look at this?” — the answer to every technique question.",
];

export const CAPTAIN_NEVER: readonly string[] = [
  "Never fix technique — reinforce what the coach said, and send the rest to the coach.",
  "Never feed a line of kids one at a time. If three are waiting, the drill is wrong — change it or split the court.",
  "Never discipline. Behaviour goes to the coach.",
  "Never be alone with a child who isn't yours.",
  "Never let the court go silent. Silence is disengagement, and it's the first thing to fix.",
];

/** What a captain needs in hand, per court. */
export const CAPTAIN_KIT: readonly string[] = [
  "Printed run sheet for today (block order, times, games)",
  "Printed roster for this court",
  "Timer — a phone with the block length preset is fine",
  "Ball caddy, filled",
  "6 cones or targets",
  "Rotation board or a whiteboard + marker",
  "Water and a first-aid kit within reach of the court",
];
