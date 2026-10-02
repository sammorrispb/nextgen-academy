import { EVALUATION_SMS_URL } from "./scheduling";
import {
  GROUP_LESSON_PRICE_PER_PLAYER_USD,
  PRIVATE_LESSON_PRICE_USD,
} from "./lessons";
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

/** "Kid's Drill and Play (ages 8–13)" — from the league data. */
const FREDERICK_LEAGUES_LINE = PICKLPARK_LEAGUES.map(
  (l) => `${l.title} (${l.ageLabel.toLowerCase()})`,
).join(" and ");

/**
 * Composed from the Pickl Park league data so the age band can't drift. Only
 * what NGA actually runs in Frederick: the Saturday league (registered and
 * priced by The Pickl Park) and private lessons there. No free evaluation is
 * offered at a Frederick venue — e2e/frederick-page.spec.ts.
 */
const FREDERICK_FAQ_ANSWER = `Yes. Next Gen coaches a six-week Saturday youth league at The Pickl Park, an indoor pickleball club in Frederick, MD, which sets the age band: ${FREDERICK_LEAGUES_LINE}. Registration and payment go through The Pickl Park, not this site. Private lessons in Frederick run at The Pickl Park too — request a time on our Lessons page, and Coach Sam confirms the time and court before sending an invoice.`;

export const faq: FaqItem[] = [
  {
    question: "What ages do you accept?",
    answer:
      "We coach kids ages 6–16 across the Red, Orange, Green and Yellow Ball pathway. Each program listing gives its ages and levels; partner classes can have a narrower age range. Your child's skills help us find the right fit within that program's eligibility. Private lessons are available at any level for extra 1:1 coaching.",
  },
  {
    question: "My child can't rally yet — can they still join?",
    answer:
      "Yes. Red Ball is the first step for kids learning paddle control, footwork and the rally. Group options depend on the current program listings; private lessons are available too. Text Coach Sam at 301-325-4731 to arrange a free 30-minute evaluation and find a starting point for your child.",
  },
  {
    question: "Does my child need experience?",
    answer:
      "No. Red Ball starts with kids brand-new to the court, and Orange Ball builds the rally. A free evaluation helps us recommend a current program that fits your child's skills and age. Check each listing for the levels it serves; private lessons are available at any level. Text Coach Sam at 301-325-4731 and we'll help you get started.",
  },
  {
    question: "How do I sign up?",
    answer:
      "Text Coach Sam at 301-325-4731 to arrange a free 30-minute evaluation. For leagues, seasons and partner classes, follow the program's registration link and check its dates, ages and levels. For private, semi-private or small-group lessons, choose available times on our Lessons page. Coach Sam confirms the time and court before sending your invoice.",
  },
  {
    question: "What should my child bring?",
    answer:
      "Comfortable athletic clothing, court shoes (non-marking soles), and a water bottle. We provide paddles and balls for all sessions.",
  },
  {
    question: "Where are you located?",
    answer:
      "Your child's court depends on the program. Check the Bethesda season at /fall and MVF classes in Montgomery Village at /montgomery-village-youth-pickleball for their listed venues, dates and availability. The /schedule page lists separate drop-ins when available. For a Montgomery County free evaluation or a private lesson, Coach Sam confirms the time and court with you. Frederick programs and private lessons are at The Pickl Park; see /youth-pickleball-frederick for its options and eligibility.",
  },
  {
    question: "How do free evaluations work?",
    answer:
      "Text Coach Sam at 301-325-4731 to arrange a free 30-minute evaluation. Share the days and area that work for your family; you’ll agree on the time and court by text. Your coach watches your child play and recommends the right Red, Orange, Green, or Yellow Ball court, with private lessons available too. There’s no cost and no commitment.",
    cta: { label: "Text to schedule a free evaluation", href: EVALUATION_SMS_URL },
  },
  {
    question: "How much do youth pickleball lessons cost at Next Gen?",
    // Leads with the free evaluation and names the prices our season and camp
    // products already quote on their own pages (Sam, 2026-09-13 — AEO audit),
    // so "how much" gets a concrete answer. The DROP-IN figure is never printed
    // (Sam, 2026-09-08) — e2e/invariant-dropin-price-not-quoted.spec.ts. Every
    // figure here is derived from its data file, never typed.
    answer: `Start with a free 30-minute evaluation to find your child's level and a program that fits. Drop-in sessions are single bookings when listed, with the rate shown at checkout before you pay. Six-week season blocks are $${FALL_SEASON_PRICE_USD} per player, paid up front, and summer camp is $${CAMP_DAY_PRICE} a morning or $${CAMP_WEEK_PRICE} for the full week. The Pickl Park sets and shows the price for the Saturday league we coach in Frederick, and MVF classes are priced on MVF's own registration portal. Private lessons are $${PRIVATE_LESSON_PRICE_USD} for the hour, and semi-private and small-group lessons are $${GROUP_LESSON_PRICE_PER_PLAYER_USD} per player for the hour. Request a lesson time first; Coach Sam confirms before sending an invoice. Check each program's cancellation terms before you register.`,
  },
  {
    question: "What’s your refund policy?",
    answer:
      "Terms depend on the program. If NGA cancels a drop-in, you get an automatic full refund to your original payment method. Fall season registration is a full-season commitment: a rained-out Sunday moves to a rain date, and sessions we cancel without making them up are refunded. Registrations are non-refundable if you withdraw or miss a session. The Pickl Park and MVF handle their own registration terms; check the program listing before paying. The free 30-minute evaluation is always free and never charged.",
  },
  {
    question: "Is pickleball safe for kids?",
    answer:
      "Yes. Pickleball is one of the safest racket sports for children: the court is smaller than tennis, the paddle is lightweight, and the ball moves at lower speeds than a tennis ball. USA Pickleball’s official youth progression uses color-coded balls (Red, Orange, Green, Yellow) with reduced bounce and compression so kids learn proper technique before the game speeds up. Our coaches are trained in youth-appropriate drills, warmups, and game formats.",
  },
  {
    question: "What’s the difference between Red, Orange, Green, and Yellow Ball?",
    answer:
      "Each color follows USA Pickleball's youth progression. Red Ball (pre-rally) builds paddle control, footwork and sustained back-and-forth on a foam ball. Orange Ball layers in rules mastery and full-court movement. Green Ball (10+) adds shot selection, court positioning and doubles teamwork. Yellow Ball (12+) is our coach-curated competitive track, with focused tournament prep. These describe the pathway; each program listing gives its eligible ages, levels and group size. Private lessons are available at any level. A free evaluation helps us place your child by skill within the program's age requirements.",
    cta: { label: "See the four levels in detail", href: "#levels" },
  },
  {
    question: "Do you offer private pickleball lessons for kids?",
    answer:
      "Yes. Private lessons give your child focused coaching at any level, from learning to rally through tournament preparation. Semi-private and small-group lessons are available too. Co-Founder Sam Morris is a former physical education teacher; Co-Founder Amine Lahlou is a former professional tennis player. Choose up to three available times; Coach Sam confirms the time and court before sending your invoice.",
    cta: { label: "Request a lesson time", href: "/lessons/book" },
  },
  {
    question: "Can my child join mid-season?",
    answer:
      "It depends on the program's availability, ages and levels. Text Coach Sam at 301-325-4731 and we'll check the current options with you. Fall season registration covers the full season, paid up front; if the full block doesn't work, ask about the sub list. Private lessons or a free evaluation can help your player get started while you look for a group that fits.",
  },
  {
    question: "Which Montgomery County towns do you serve?",
    answer:
      "Families across Montgomery County can explore our programs, including Bethesda seasons and MVF classes in Montgomery Village. Your home town may be different from the program's venue: check each listing for dates, ages, levels and registration details. For evaluations or private lessons, share the area and days that work for you; Coach Sam confirms the time and court. Our county guide links to local information for Bethesda, North Bethesda, Rockville, Potomac, Gaithersburg, Germantown, Silver Spring and Olney. Frederick families can see the separate guide to The Pickl Park.",
  },
  {
    question: "Do you run anything in Frederick County?",
    answer: FREDERICK_FAQ_ANSWER,
  },
  {
    question: "Do you offer lessons for adults?",
    answer:
      "Next Gen is youth-only (ages 6–16). For adults, Coach Sam offers private lessons separately through sammorrispb.com. Choose available times on his lesson scheduling page; Sam confirms the time before sending your invoice. Many of our NGA parents pick up the paddle alongside their kids.",
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
