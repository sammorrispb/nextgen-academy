/**
 * Pre-approved "Coach tip of the week" bank for the automated weekly
 * newsletter. An unattended cron can't write fresh copy, so it rotates
 * through this curated, brand-reviewed set — one tip per ISO week,
 * deterministic from the date.
 *
 * Every tip is parent-readable (no ungated pickleball jargon), action-led,
 * and ladders to an EASE value (mostly Skills / Attitude). When you edit
 * this bank, re-run /brand-review-nga on the changed entries.
 */

export interface CoachTip {
  title: string;
  body: string;
}

export const COACH_TIPS: CoachTip[] = [
  {
    title: "The wall is your friend",
    body: "No court at home? Twenty minutes against any flat wall builds hands faster than almost anything. Stand about 8 feet back, keep a controlled rally going — paddle out front, soft grip — and count out loud. Beating yesterday's number is the whole game.",
  },
  {
    title: "Start in ready position",
    body: "Before every shot: feet a little wider than the shoulders, knees soft, paddle up and out in front. A player who's ready gets to twice as many balls. Have your kid freeze in that stance for ten seconds and feel where it should live.",
  },
  {
    title: "Watch the ball onto the paddle",
    body: "The most common miss at every age is looking up too early. Cue your kid to keep their eyes on the ball all the way to contact, not on where they want it to go. Quiet eyes, cleaner hits.",
  },
  {
    title: "Soft hands win",
    body: "A tight grip sends the ball flying long. Have your kid hold the paddle like they're shaking a friend's hand — firm, not crushing. Looser hands mean more control, and control comes before power every time.",
  },
  {
    title: "Move your feet, not just your arm",
    body: "Reaching with the arm leads to off-balance shots. Teach small adjustment steps to get the body behind the ball. A good drill: roll a ball gently to one side and have them shuffle to it before they swing.",
  },
  {
    title: "Deep serve, deep return",
    body: "Landing the ball in the back third of the court buys time and pushes opponents back. Set a target a few feet inside the baseline and count how many out of ten land deep. Small target, big payoff.",
  },
  {
    title: "Call it: 'mine' or 'yours'",
    body: "In doubles, the balls down the middle get missed because nobody talks. Have your kid practice calling every ball out loud. It prevents collisions, builds teamwork, and it's the kind of habit coaches notice.",
  },
  {
    title: "Slow is smooth, smooth is fast",
    body: "Kids want to hit hard. Control first, speed later. Ask them to play a whole rally at half-speed and just keep the ball in — they'll be surprised how much better the fast shots get once the slow ones are solid.",
  },
  {
    title: "Recover to the middle",
    body: "After every shot, take a step back toward the center of your side. Standing still after a hit leaves the court wide open. Cue it as 'hit and get home' until it's automatic.",
  },
  {
    title: "Practice the shot they like least",
    body: "Ten minutes a day on the weakest shot beats an hour on the favorite. Ask your kid which shot they avoid in a game — that's the one to work on. Progress lives just outside the comfort zone.",
  },
  {
    title: "One breath between points",
    body: "Rushing the next serve is how good players give away easy points. Teach a single slow breath after each rally to settle the head before the next one. Calm beats fast.",
  },
  {
    title: "Praise the effort, not just the point",
    body: "When your kid hustles for a tough ball, say so — even if they lose the point. Effort is what they can control, and rewarding it builds the growth mindset that carries every other skill. That's the A in EASE: Attitude.",
  },
];

/**
 * Deterministically pick one tip for the calendar week containing `now`.
 * Rotation key is whole-weeks-since-epoch (UTC), so it advances by exactly
 * one each week and is stable for any time within the same week.
 */
export function pickWeeklyTip(now: Date = new Date()): CoachTip {
  const weekIndex = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  return COACH_TIPS[((weekIndex % COACH_TIPS.length) + COACH_TIPS.length) % COACH_TIPS.length];
}
