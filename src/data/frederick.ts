// Copy for /youth-pickleball-frederick — NGA's first out-of-county landing page
// (AEO audit, 2026-09-13). Plain strings in a data file so a pure spec can scan
// every claim (e2e/frederick-page.spec.ts).
//
// HONESTY RULES — the reason this page is hand-rolled, not CityLanding:
//   • Only what NGA runs in Frederick: the two Saturday leagues at The Pickl
//     Park (registered and priced by The Pickl Park) and private lessons there.
//   • Never the 6–16 ladder. The Frederick leagues are ages 8–13 and 10+.
//   • No free evaluation at a Frederick venue — on this page's copy, its FAQ
//     (including shared entries), its contact block, or the sticky mobile CTA
//     (src/lib/sticky-cta.ts). Frederick families reach Coach Sam directly.
//   • No testimonials, no "families from Urbana train with us" — the Player CRM
//     held zero Frederick families when this page shipped.
//   • League names, ages and times are composed from the league data file,
//     never typed.
//
// DRAFT COPY: written by Claude for Sam's voice pass before merge.

import { faq, type FaqItem } from "./faq";
import {
  PICKLPARK_LEAGUES,
  PICKLPARK_LEAGUE_PLACEMENT_NOTE,
} from "./picklpark-leagues-2026";
import { PICKLPARK_PUBLIC_AREA, PICKLPARK_VENUE_SHORT } from "./picklpark-2026";

const LEAGUES_SENTENCE = PICKLPARK_LEAGUES.map(
  (l) => `${l.title} (${l.ageLabel.toLowerCase()}, ${l.timeLabel})`,
).join(" and ");

export const FREDERICK_PAGE = {
  title: "Youth Pickleball in Frederick, MD — Next Gen Academy",
  // ≤160 chars (e2e/seo.spec.ts) — composed, so a league rename can't drift it.
  description: `Indoor Saturday youth pickleball league in ${PICKLPARK_PUBLIC_AREA}, coached by Next Gen at ${PICKLPARK_VENUE_SHORT}: ${PICKLPARK_LEAGUES.map((l) => `${l.title} (${l.ageLabel.toLowerCase()})`).join(" and ")}.`,
  eyebrow: `Frederick County, MD · Saturdays at ${PICKLPARK_VENUE_SHORT}`,
  h1: "Youth pickleball in Frederick, MD.",
  intro: `Next Gen Pickleball Academy coaches youth leagues on Saturdays at ${PICKLPARK_VENUE_SHORT}, an indoor pickleball club in Frederick. One group runs on Saturdays, with age bands set by The Pickl Park: ${LEAGUES_SENTENCE}. Your kid gets the same coaching we run in Montgomery County — small skill-based groups and plenty of reps every session — on cushioned indoor courts, so the weather never cancels a Saturday.`,
  whereWePlay: `Every Frederick session runs at ${PICKLPARK_VENUE_SHORT}. The Pickl Park runs registration and payment for the league, so you sign up on their site and Coach Sam and the Next Gen staff run the court. ${PICKLPARK_LEAGUE_PLACEMENT_NOTE}`,
  privateLessonsNote:
    "Private lessons run at The Pickl Park in Frederick too. Email or text Coach Sam and we'll set up a time.",
  nearbyIntro:
    "The Pickl Park is an easy drive from anywhere in Frederick County, and a straight run up I-270 from upper Montgomery County.",
};

export const FREDERICK_FAQ: { question: string; answer: string }[] = [
  {
    question: "Where exactly are the Frederick sessions?",
    answer: `At ${PICKLPARK_VENUE_SHORT}, an indoor pickleball club in Frederick, MD. The Saturday league runs there, and so do private lessons. Sessions are indoors, so rain and heat don't cancel them.`,
  },
  {
    question: "Which Frederick league fits my kid?",
    answer: `${PICKLPARK_LEAGUES.map((l) => `${l.title} is ${l.ageLabel.toLowerCase()}: ${l.blurb}`).join(" ")} Not sure, or is your child outside those ages? Email or text us before you register and we'll talk it through with you.`,
  },
  {
    question: "How much do the Frederick leagues cost?",
    answer:
      "The Pickl Park sets the price and shows it on each league's listing — the league cards on this page link straight there. Private-lesson rates in Frederick are quoted when we set up a time.",
  },
  {
    question: "Do I register with Next Gen or The Pickl Park?",
    answer:
      "The Pickl Park. They list the league, take registration, and set the price. Next Gen coaches every session. The league cards on this page link straight to each listing.",
  },
];

/**
 * Shared FAQ entries that are true in Frederick. Left out on purpose: the ages
 * entry ("We coach kids ages 6–16" — the Frederick leagues start at 8) and the
 * site-wide cost entry (it opens with the free evaluation and quotes MoCo
 * season and camp prices). Frederick has its own cost entry above.
 */
export const FREDERICK_SHARED_FAQ_QUESTIONS: ReadonlySet<string> = new Set([
  "Do you run anything in Frederick County?",
  "Is pickleball safe for kids?",
]);

/** Every FAQ entry the Frederick page renders — visible list AND FAQPage JSON-LD. */
export function frederickPageFaq(): FaqItem[] {
  return [
    ...FREDERICK_FAQ,
    ...faq.filter((item) => FREDERICK_SHARED_FAQ_QUESTIONS.has(item.question)),
  ];
}
