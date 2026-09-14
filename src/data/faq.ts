import { CAMP_OPTIONS } from "./camps";
import { FALL_SEASON_PRICE_USD } from "./fall-season-2026";
import { PICKLPARK_LEAGUES } from "./picklpark-leagues-2026";

export interface FaqItem {
  question: string;
  answer: string;
  cta?: { label: string; href: string };
}

function campPrice(key: string): number {
  const option = CAMP_OPTIONS.find((o) => o.key === key);
  if (!option) throw new Error(`faq.ts: no camp option "${key}"`);
  return option.priceUsd;
}
const CAMP_DAY_PRICE = campPrice("day");
const CAMP_WEEK_PRICE = campPrice("week");

/** "Kid's Drill and Play (ages 8–13) and Youth League (ages 10+)" — from the league data. */
const FREDERICK_LEAGUES_LINE = PICKLPARK_LEAGUES.map(
  (l) => `${l.title} (${l.ageLabel.toLowerCase()})`,
).join(" and ");

/**
 * Composed from the Pickl Park league data so the age bands can't drift. Only
 * what NGA actually runs in Frederick: the two Saturday leagues (registered and
 * priced by The Pickl Park) and private lessons there. No free evaluation is
 * offered at a Frederick venue — e2e/frederick-page.spec.ts.
 */
const FREDERICK_FAQ_ANSWER = `Yes. Next Gen coaches two six-week Saturday youth leagues at The Pickl Park, an indoor pickleball club in Frederick, MD, which sets their age bands: ${FREDERICK_LEAGUES_LINE}. Registration and payment go through The Pickl Park, not this site. Private lessons in Frederick run at The Pickl Park too — email or text Coach Sam and we'll set up a time.`;

export const faq: FaqItem[] = [
  {
    question: "What ages do you accept?",
    answer:
      "We coach kids ages 6–16. Group sessions run at every ball color — Red Ball (pre-rally), Orange Ball (building), Green Ball (10+), and Yellow Ball (12+, tournament track) — each on its own court. Private lessons are available at any level for kids who want to fast-track with 1:1 coaching.",
  },
  {
    question: "My child can't rally yet — can they still join?",
    answer:
      "Yes. Our Red Ball court is built exactly for kids who are new to the game — a foam-ball group where they learn paddle control, footwork, and the rally from day one. Prefer to fast-track with 1:1 coaching first? Private lessons are available too. Schedule a free 30-minute evaluation and we'll lay out a plan.",
  },
  {
    question: "Does my child need experience?",
    answer:
      "No. Group sessions run at every level — including Red Ball for kids brand-new to the court and Orange Ball for kids still building the rally. We place your child by skill so they're with peers at their level. Want to fast-track? Private lessons are available too. Schedule a free evaluation and we'll tell you which path fits.",
  },
  {
    question: "How do I sign up?",
    answer:
      "Fill out the form on this page and we'll reach out within 24 hours to help place your child in the right group — or schedule a private lesson if that's the right starting point. You can also email nextgenacademypb@gmail.com or text Sam at 301-325-4731.",
  },
  {
    question: "What should my child bring?",
    answer:
      "Comfortable athletic clothing, court shoes (non-marking soles), and a water bottle. We provide paddles and balls for all sessions.",
  },
  {
    question: "Where are you located?",
    answer:
      "We coach across Montgomery County Public Schools. Sessions rotate weekly based on court availability — common areas include Rockville, North Bethesda, Bethesda, Potomac, Chevy Chase, Kensington, Silver Spring, Gaithersburg, Derwood, and Aspen Hill. The /schedule page shows this week's confirmed venues; email or text us if you don't see one near you. On Saturdays we also coach youth leagues at The Pickl Park, an indoor pickleball club in Frederick, MD.",
  },
  {
    question: "How do free evaluations work?",
    answer:
      "Fill out the form below or email us at nextgenacademypb@gmail.com to schedule a 30-minute evaluation. Our coaches will assess your child’s current level and place them on the right court — Red, Orange, Green, or Yellow Ball — with private lessons available if you'd like to fast-track. There’s no cost and no commitment.",
  },
  {
    question: "How much do youth pickleball lessons cost at Next Gen?",
    // Leads with the free evaluation and names the prices our season and camp
    // products already quote on their own pages (Sam, 2026-09-13 — AEO audit),
    // so "how much" gets a concrete answer. The DROP-IN figure is never printed
    // (Sam, 2026-09-08) — e2e/invariant-dropin-price-not-quoted.spec.ts. Every
    // figure here is derived from its data file, never typed.
    answer: `Start with the free 30-minute evaluation — it places your child on the right Red, Orange, Green, or Yellow Ball court and costs nothing. After that, group classes are drop-in, one hour at a time: no subscription and no commitment, and the rate is shown at checkout before you pay. Six-week season blocks are $${FALL_SEASON_PRICE_USD} per player, paid up front, and summer camp is $${CAMP_DAY_PRICE} a morning or $${CAMP_WEEK_PRICE} for the full week. The Pickl Park sets and shows the price for the Saturday leagues we coach in Frederick, and MVF classes are priced on MVF's own registration portal. Private-lesson rates come with your child's placement after the evaluation. Next Gen registrations are non-refundable unless we cancel — if we call off a session for weather or any other reason, you get an automatic full refund.`,
  },
  {
    question: "What’s your refund policy?",
    answer:
      "If we cancel a session — for weather, a venue issue, or low enrollment — you get an automatic full refund to your original payment method, no action needed. Our sessions are outdoors, so we watch the forecast for every date and call off any session that isn’t safe to play. Outside of an NGA cancellation, registrations are non-refundable: please register only when you’re confident your child can attend, since we can’t offer credits or transfers for missed sessions. The free 30-minute evaluation is always free and never charged.",
  },
  {
    question: "Is pickleball safe for kids?",
    answer:
      "Yes. Pickleball is one of the safest racket sports for children: the court is smaller than tennis, the paddle is lightweight, and the ball moves at lower speeds than a tennis ball. USA Pickleball’s official youth progression uses color-coded balls (Red, Orange, Green, Yellow) with reduced bounce and compression so kids learn proper technique before the game speeds up. Our coaches are trained in youth-appropriate drills, warmups, and game formats.",
  },
  {
    question: "What’s the difference between Red, Orange, Green, and Yellow Ball?",
    answer:
      "Each color follows USA Pickleball’s youth progression — placement is by skill, not age — and each runs as its own group court. Red Ball (pre-rally) builds paddle control, footwork, and sustained back-and-forth on a foam ball. Orange Ball layers in rules mastery and full-court movement. Green Ball (10+) adds shot selection, court positioning, and doubles teamwork. Yellow Ball (12+) is our coach-curated competitive track — small groups of 3–5 athletes with custom scheduling and focused tournament prep. Private lessons are available at any level for kids who want to fast-track with 1:1 coaching. Every child is placed during a free evaluation, never on age alone.",
    cta: { label: "See the four levels in detail", href: "#levels" },
  },
  {
    question: "Do you offer private pickleball lessons for kids?",
    answer:
      "Yes — and they’re the right starting point for any child who can’t rally yet. 1:1 coaching builds the rally, footwork, and consistency a child needs before joining a group. Head Coach Sam Morris is a former physical education teacher and Co-Founder of Next Gen Academy; Co-Founder Amine Lahlou is a former professional tennis player. Email nextgenacademypb@gmail.com or call 301-325-4731 to schedule.",
  },
  {
    question: "Can my child join mid-season?",
    answer:
      "Yes. We accept new players throughout the season. Start with a free 30-minute evaluation and our coaches will place your child into the current session that fits their level and schedule — at any ball color — with a private-lesson option if you'd like to fast-track.",
  },
  {
    question: "Which Montgomery County towns do you serve?",
    answer:
      "We serve families across Bethesda, Potomac, Chevy Chase, Kensington, Silver Spring, Rockville, North Bethesda, Gaithersburg, Derwood, Aspen Hill, and most of the DMV. Sessions rotate seasonally between Montgomery County courts — reach out for the current location. Frederick County families: our Saturday youth leagues run at The Pickl Park in Frederick.",
  },
  {
    question: "Do you run anything in Frederick County?",
    answer: FREDERICK_FAQ_ANSWER,
  },
  {
    question: "Do you offer lessons for adults?",
    answer:
      "Next Gen is youth-only (ages 6–16). For adults, Head Coach Sam Morris offers private lessons separately at sammorrispb.com — start with a free 30-minute skill evaluation, no commitment. Many of our NGA parents pick up the paddle alongside their kids.",
  },
];

/**
 * The shared FAQ subset every local landing page renders (city pages, the
 * county hub, Frederick). ONE copy — it used to be duplicated in CityLanding and
 * the county page, so rewording a question in faq.ts silently dropped it from
 * nine pages with no test failing.
 */
export const LOCAL_FAQ_QUESTIONS: ReadonlySet<string> = new Set([
  "What ages do you accept?",
  "How much do youth pickleball lessons cost at Next Gen?",
  "Is pickleball safe for kids?",
  "Which Montgomery County towns do you serve?",
]);

export const localFaq: FaqItem[] = faq.filter((item) =>
  LOCAL_FAQ_QUESTIONS.has(item.question),
);
