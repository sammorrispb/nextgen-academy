// Evergreen Coach-voice articles for /blog — the indexable long-form layer the
// 2026-07 discovery review called for (the news pipeline is email-only).
// Every factual claim traces to existing site content (faq.ts, levels.ts,
// recurring-templates.ts, camps.ts) — no invented venues, prices, or claims.
// Dates are ISO strings (UTC-build-safe).
//
// The three 2026-09-13 posts (AEO audit) each open with a direct two-sentence
// answer to the question in the title, then the coach's reasoning — the shape
// answer engines quote. Pickl Park facts are interpolated from the league data
// so they can't drift. The one outside fact (the YMCA of Frederick County and
// the City of Frederick list pickleball programs) was checked against their
// sites on 2026-09-13 and deliberately names no times: families check those
// schedules directly.

import { FALL_RAIN_DATES, FALL_SEASON_LABEL, FALL_SEASON_WEEKS, FALL_VENUE, FALL_VENUE_SHORT, FALL_WEATHER_CALL_LEAD_HOURS } from "./fall-2026";
import { FALL_SEASON_GROUPS, FALL_SEASON_PRICE_USD } from "./fall-season-2026";
import { MVF_AGE_MIN, MVF_AGE_MAX, NORTH_CREEK } from "./mvf";
import { levels } from "./levels";
import { getParkingTip } from "./venue-parking";
import { formatLongDate } from "../lib/format-date";
import {
  COURTS_TEXT, GUARANTEED_GAMES_TEXT, LOW_ENROLLMENT_POLICY_TEXT, MEDALS_TEXT,
  MVF_JUNIOR_TOURNAMENT_ADDRESS, MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_DIVISIONS, MVF_JUNIOR_TOURNAMENT_DIVISION_MIN,
  MVF_JUNIOR_TOURNAMENT_DIVISION_MAX, MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_VENUE, NONRESIDENT_PRICE_USD, NO_REFUNDS_TEXT,
  RAIN_OR_SHINE_TEXT, RESIDENT_PRICE_USD,
} from "./mvf-junior-tournament-2026";

import {
  PICKLPARK_LEAGUES,
  PICKLPARK_LEAGUE_PLACEMENT_NOTE,
} from "./picklpark-leagues-2026";
import {
  PICKLPARK_INDOOR_NOTE,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_SEASON_WEEKS,
} from "./picklpark-2026";

const FALL_GROUPS = FALL_SEASON_GROUPS.map((group) => group.label).join(" and ");

const PICKLPARK_LEAGUE_LINES = PICKLPARK_LEAGUES.map(
  (l) => `${l.title} (${l.ageLabel.toLowerCase()}, Saturdays ${l.timeLabel}): ${l.blurb}`,
);

export interface BlogSection {
  heading?: string;
  paragraphs: string[];
}

export interface BlogPost {
  slug: string;
  /** Rendered as the page <title> via { absolute } — keep ≤60 chars. */
  title: string;
  /** H1 + card headline (can differ slightly from the SEO title). */
  headline: string;
  description: string;
  datePublished: string;
  sections: BlogSection[];
  /** Optional related links rendered after the article body. External links
   * to family sites should be built with familySiteUrl at render time. */
  links?: { label: string; href: string; family?: "linkanddink" | "sammorrispb" }[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "walter-johnson-youth-pickleball-fall-2026",
    title: "Walter Johnson Youth Pickleball: Parent Guide",
    headline: "Walter Johnson youth pickleball: your fall season guide",
    description: "Plan for NGA's Bethesda youth season: Green and Yellow groups, full-season price, east-side parking, session format and current weather updates.",
    datePublished: "2026-10-05",
    sections: [
      {
        paragraphs: [
          `Your player's Fall 2026 Bethesda program is a ${FALL_SEASON_WEEKS}-Sunday season at ${FALL_VENUE}. Each Green or Yellow Ball group gets 90 minutes of coached practice, then rotating-partner games. It is a season commitment, not a one-hour drop-in.`,
          "This guide explains the season plan. Use the current Bethesda season page linked below for cancellations, makeup dates, group availability and registration terms before heading to the court or paying.",
        ],
      },
      {
        heading: "Choose a group that fits your player",
        paragraphs: [
          ...FALL_SEASON_GROUPS.map((group) => `${group.label}: ${group.timeLabel} ET; listed age ${levels.find((level) => level.key === group.group.toLowerCase())!.ages}.${group.group === "Yellow" ? " Yellow is coach-curated and invite-only." : " Green develops shot selection, court positioning and doubles teamwork."}`),
          "NGA serves ages 6–16 through Red, Orange, Green and Yellow Ball. That academy-wide pathway does not make every group open to every age or level. This season lists Green and Yellow; ask Coach Sam to confirm placement rather than choosing a group only for its time. An evaluation or private lesson can help a newer player find an appropriate starting point.",
        ],
      },
      {
        heading: "Season dates and payment",
        paragraphs: [
          `The original schedule was six Sundays, ${FALL_SEASON_LABEL}. These are not six remaining Sundays. Held makeup dates are ${FALL_RAIN_DATES.map(formatLongDate).join(" and ")}, 2026; they replace cancelled sessions rather than add two extra paid sessions. Check the current season record for cancellations and makeup assignments.`,
          `The $${FALL_SEASON_PRICE_USD} full-season commitment is paid up front. This is the full-season price, not a late-start quote. If you are joining after the season starts, confirm the current group, remaining sessions, space and late-start payment terms with Coach Sam before paying.`,
          "Joining the substitute list is not a confirmed spot. Separate drop-ins and substitute opportunities have their own availability. Text Coach Sam at 301-325-4731 if you need help choosing the next step.",
        ],
      },
      {
        heading: "What your player practices",
        paragraphs: [
          "The season plan moves from coached practice into games with changing partners. Green builds fundamentals and teamwork; Yellow works on patterns for competitive play. You do not need to bring a fixed doubles partner.",
          "On the ride home, ask one small question: What felt easier today? What did you try with a new partner? Recognizing a specific effort helps your player see progress alongside the score. Better than yesterday—together.",
        ],
      },
      {
        heading: "Before leaving home",
        paragraphs: [
          `${getParkingTip(FALL_VENUE)?.tip} Check the program email for meeting and pickup instructions; agree on the handoff with your coach.`,
          "Pack court shoes and water, plus your player's paddle if they have one. If you need to borrow equipment, confirm availability with Coach Sam beforehand.",
          `Weather calls are made ${FALL_WEATHER_CALL_LEAD_HOURS} hours before each group's start. Check the current season record, your group WhatsApp and cancellation email before travelling. Review the current season's weather, makeup and refund terms on the Bethesda season page.`,
        ],
      },
      {
        heading: "Quick answers for parents",
        paragraphs: [
          "Can a new player join this group? Start with an evaluation or placement conversation. This season lists Green and Yellow; Red and Orange have their own appropriate program options.",
          "Is every Sunday a drop-in? No. This listing is a season commitment. Check separately listed drop-ins or substitute opportunities for their own availability.",
          "Is a makeup date an extra paid session? No. It is held to replace a cancelled date. The current season record shows which date it replaces.",
        ],
      },
    ],
    links: [
      { label: "See current Bethesda season details", href: "/fall" },
      { label: "See the ball-level pathway", href: "/levels" },
    ],
  },
  {
    slug: "mvf-junior-tournament-october-24-2026",
    title: "October 24 MVF Junior Pickleball: Parent Guide",
    headline: "October 24 MVF junior pickleball: your family's guide",
    description: "Plan for NGA's October 24 Montgomery Village junior tournament: event-day ages, rotating partners, fees, 3:30 PM check-in and invoice payment.",
    datePublished: "2026-10-05",
    sections: [
      {
        paragraphs: [
          `Your player's MVF Junior Tournament is scheduled for ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL} ET, at ${MVF_JUNIOR_TOURNAMENT_VENUE}, ${MVF_JUNIOR_TOURNAMENT_ADDRESS}. Next Gen Pickleball Academy coaches the event.`,
          `${COURTS_TEXT} Use the North Creek address for your trip; Montgomery Village Foundation's Apple Ridge headquarters is a different location. Check the current tournament page for details and registration status.`,
        ],
      },
      {
        heading: "Choose your player's age division",
        paragraphs: [
          `Your player's age on October 24, 2026 determines the division: ${MVF_JUNIOR_TOURNAMENT_DIVISIONS.map((division) => `${division.label}: ${division.ageLabel.toLowerCase()}`).join("; ")}. Turning 11 on October 25 still places a player in 10U; turning 11 on October 24 places them in 14U.`,
          "NGA serves ages 6–16, but this tournament stops at age 14. A 15- or 16-year-old cannot enter 14U. An age division is not a Red, Orange, Green or Yellow skill placement. If you are unsure whether your player's game experience fits, text Coach Sam at 301-325-4731 before paying.",
          `Each division has a ${MVF_JUNIOR_TOURNAMENT_DIVISION_MIN}-player minimum and a ${MVF_JUNIOR_TOURNAMENT_DIVISION_MAX}-player cap. ${LOW_ENROLLMENT_POLICY_TEXT}`,
        ],
      },
      {
        heading: "What rotating partners means",
        paragraphs: [
          `Players register individually and change partners during the round robin: games against different opponents. You do not need to register a fixed doubles team. ${GUARANTEED_GAMES_TEXT} ${MEDALS_TEXT}`,
          "Give your player one simple goal: communicate with each new partner, recover after a mistake or notice one skill they are using more consistently. That is a useful way to recognize progress alongside the results. Better than yesterday—together.",
        ],
      },
      {
        heading: "Entry fees and invoice payment",
        paragraphs: [
          `Entry is $${RESIDENT_PRICE_USD} per player for Montgomery Village residents and $${NONRESIDENT_PRICE_USD} per player for non-residents. Select the residency option that applies to your player's registration.`,
          "Start on the official tournament page, choose a division and complete the parent registration form. NGA emails an invoice; pay that invoice online to lock your player's spot. Submitting the form or receiving an invoice is not proof of a paid spot. Keep your payment confirmation.",
          "If the email does not arrive, check spam, then contact Coach Sam before creating a second registration. Availability can change; check the current registration page rather than assuming a division still has room.",
        ],
      },
      {
        heading: "Before leaving home",
        paragraphs: [
          `Check in at 3:30 PM ET at ${MVF_JUNIOR_TOURNAMENT_VENUE}, ${MVF_JUNIOR_TOURNAMENT_ADDRESS}. Check your event email for the meeting point and any updated instructions.`,
          "Bring a refillable water bottle and court shoes. Pack your player's paddle if they have one. If you need to borrow one, confirm availability with Coach Sam beforehand.",
          `${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT} Read these posted terms before paying. If conditions raise a question, contact NGA and follow the organizer's current instructions.`,
        ],
      },
      {
        heading: "Quick answers for parents",
        paragraphs: [
          "Do we need a doubles partner? No. Players register individually and rotate partners.",
          "Is this the Thursday MVF class? No. This is a one-day Saturday tournament. Use this event's registration page and venue instructions.",
          "What if a division has fewer than six players? The divisions will be merged. Check the organizer's current instructions for the resulting format.",
        ],
      },
    ],
    links: [{ label: "See current tournament details and registration", href: "/mvf-junior-tournament" }],
  },
  {
    slug: "is-pickleball-safe-for-kids",
    title: "Is Pickleball Safe for Kids? A MoCo Coach's Answer",
    headline: "Is pickleball safe for kids? A coach's honest answer.",
    description:
      "How to choose an age- and skill-appropriate pickleball program for your child, what NGA's pathway means, and which session details to check.",
    datePublished: "2026-07-25",
    sections: [
      {
        paragraphs: [
          "Your child's session should fit their age and skill level. At NGA, youth-appropriate drills, warm-ups and game formats are part of how we coach. Start by checking the actual session your child would join and asking about the details that matter for your family.",
          "Look beyond the sport's name. Check the actual session's ages, skill levels, group size and equipment. NGA serves ages 6–16, but partner classes and seasons can serve a narrower range. Your child's skills help us recommend a next step within those requirements.",
        ],
      },
      {
        heading: "A pathway that fits your player's skills",
        paragraphs: [
          "NGA's pathway is Red, Orange, Green and Yellow Ball. Red Ball uses a foam ball while players work on paddle control, footwork and a sustained rally. Orange adds rules and movement; Green adds shot selection and teamwork; Yellow is our coach-curated tournament track. These describe the skills we develop. Check the listing for the levels a current group serves.",
          "Check your program's group size and format before registering. A season, a partner class and a private lesson are different offers. If you aren't sure which setting fits, a free 30-minute evaluation can help a coach recommend a starting point; private lessons are another option.",
        ],
      },
      {
        heading: "What parents can do",
        paragraphs: [
          "Bring comfortable athletic clothing, court shoes with non-marking soles and water. Check the listing for equipment details, or ask Coach Sam what your child needs. Before leaving home, confirm the venue, time and registration with the program's booking owner. A clear plan lets your child focus on learning once they reach the court.",
        ],
      },
    ],
  },
  {
    slug: "youth-pickleball-ball-colors-explained",
    title: "Red, Orange, Green, Yellow: Youth Pickleball Levels",
    headline: "Red, Orange, Green, Yellow — the youth ball colors, explained.",
    description:
      "NGA's Red, Orange, Green and Yellow Ball pathway explained for parents, with skill placement inside each program's age and level requirements.",
    datePublished: "2026-07-25",
    sections: [
      {
        paragraphs: [
          "Red, Orange, Green and Yellow Ball describe NGA's pathway. They help you understand the skills your child is developing, rather than assign a team name. The academy serves ages 6–16; each current program lists the ages and levels it accepts. Here's what the four steps mean in parent terms.",
        ],
      },
      {
        heading: "Red Ball — building the rally",
        paragraphs: [
          "The starting point for players brand-new to the game. Red Ball work uses a foam ball while kids build paddle control, footwork and their first sustained back-and-forth rally. No pickleball experience is needed to begin learning; current group availability and eligibility still come from the listing.",
        ],
      },
      {
        heading: "Orange Ball — building consistency",
        paragraphs: [
          "The bridge level. Kids here can rally and are layering in rules mastery, consistency, and full-court movement. It's where the game starts looking like the game.",
        ],
      },
      {
        heading: "Green Ball — strategy and teamwork",
        paragraphs: [
          "Strategy meets competition: shot selection, court positioning, and doubles teamwork. Partnerships start to form at this level, and kids begin thinking a shot ahead.",
        ],
      },
      {
        heading: "Yellow Ball — the tournament track",
        paragraphs: [
          "Our coach-curated competitive track focuses on tournament preparation. The Yellow Ball inquiry form is how you share interest; coaches extend invitations based on readiness. Check the actual offer for its dates, age requirements and group size rather than assume a particular schedule or number of players.",
        ],
      },
      {
        heading: "How placement works",
        paragraphs: [
          "A free 30-minute evaluation can help a coach recommend a next step by skill, within the program's age requirements. It is an option when you're unsure where to start, rather than a prerequisite for every partner enrollment. Private lessons are available at any color. Follow the current program's registration link and requirements before booking a group.",
        ],
      },
    ],
  },
  {
    slug: "where-kids-play-pickleball-montgomery-county",
    title: "Where Kids Play Pickleball in Montgomery County, MD",
    headline: "Where kids can play pickleball in Montgomery County.",
    description:
      "Youth pickleball options for Montgomery County families: Bethesda seasons, MVF partner classes, past camps and public courts for family play.",
    datePublished: "2026-07-25",
    sections: [
      {
        paragraphs: [
          "Montgomery County families can compare seasons, partner classes, private lessons and separately listed single-session drop-ins. Your home town can differ from the program's venue. Check the current listing for dates, ages, levels and registration before making a plan.",
        ],
      },
      {
        heading: "Seasons and separately listed drop-ins",
        paragraphs: [
          `The 2026 fall season at ${FALL_VENUE_SHORT} in Bethesda is for ${FALL_GROUPS}, ${FALL_SEASON_LABEL}. Registration covers the full season, paid up front. Check /fall for current status and terms; the drop-in schedule lists separate single-session offers when available. Earle B. Wood Middle School Saturday sessions are past programs, not the current season.`,
        ],
      },
      {
        heading: "Partner classes and past camps",
        paragraphs: [
          `MVF partner classes in Montgomery Village serve ages ${MVF_AGE_MIN}–${MVF_AGE_MAX}; fall listings name ${NORTH_CREEK.name}. You register and pay through MVF, choosing the session and bracket you want. Confirm the venue with MVF before attending because a class can move if court renovations begin. Our 2026 summer camps at Gaithersburg High School and back-to-school camp at Wood ran earlier this year; they are past programs. A free NGA evaluation is available for placement questions, rather than required for every partner enrollment.`,
        ],
      },
      {
        heading: "Public courts for family play",
        paragraphs: [
          "Playing with your child between sessions is another way to enjoy the game together. Link & Dink's court map can help you explore courts, but confirm the venue's access, hours and current conditions before heading out. Once you have confirmed a place to play, let your child show you the skills they have been working on.",
        ],
      },
    ],
    links: [
      { label: "Bethesda fall season details", href: "/fall" },
      { label: "MVF class details and registration", href: "/montgomery-village-youth-pickleball" },
      {
        label: "Link & Dink's Montgomery County court map",
        href: "/map",
        family: "linkanddink",
      },
    ],
  },
  {
    slug: "first-pickleball-session-what-to-expect",
    title: "Your Kid's First Pickleball Session: What to Expect",
    headline: "Your kid's first session: what to expect, what to bring.",
    description:
      "Plan your child's first NGA session: optional evaluation, program eligibility, equipment, duration, registration and cancellation details to check.",
    datePublished: "2026-07-25",
    sections: [
      {
        paragraphs: [
          "First sessions come with first-session nerves — for kids and parents alike. Your plan starts with the program you choose: its ages, levels, venue and format. NGA's academy serves ages 6–16, while each listing sets its own eligibility. Here's what to check before your child walks on court.",
        ],
      },
      {
        heading: "When an evaluation can help",
        paragraphs: [
          "A free 30-minute evaluation is an option when you're unsure where your child should start. A coach watches them play and recommends a next step along NGA's Red, Orange, Green and Yellow Ball pathway, within the program's age requirements. The evaluation has no cost and no commitment; partner programs follow their own enrollment requirements.",
        ],
      },
      {
        heading: "What to bring",
        paragraphs: [
          "Bring comfortable athletic clothing, court shoes with non-marking soles and a water bottle. Check the program listing for equipment details, or ask Coach Sam what your child needs before attending. Confirm the court and start time with the registration owner rather than rely on the venue of an earlier session.",
        ],
      },
      {
        heading: "What the session involves",
        paragraphs: [
          "Your listing gives the session length and group size. NGA coaching uses youth-appropriate warm-ups, skill work and play, with cues that fit the player's starting point. Our coaching philosophy is a growth mindset: purposeful reps and encouragement help your child work on the next skill. The program listing gives the format for your session.",
          "Before you register, check the program's dates, length, group size and payment terms. A drop-in is one session; a season is a block of sessions paid up front. Partner programs use their own registration and cancellation terms. The listing tells you which offer you're choosing and who handles registration.",
        ],
      },
      {
        heading: "Ready when you are",
        paragraphs: [
          "If you want help choosing a starting point, book a free evaluation or request a private lesson. Share the area and days that work for your family; Coach Sam confirms the time and court. If you've already chosen a program, follow its listing's registration steps.",
        ],
      },
    ],
  },
  {
    slug: "best-age-to-start-pickleball",
    title: "What's the Best Age to Start Pickleball? A Coach's Take",
    headline: "What's the best age for a kid to start pickleball?",
    description:
      "NGA serves ages 6–16. Learn how your child's skills and each program's eligibility shape their starting point, with evaluations and private lessons available.",
    datePublished: "2026-09-13",
    sections: [
      {
        paragraphs: [
          "NGA's academy serves kids ages 6–16. Within that range, your child's skills and the actual program's age requirements both matter. Red Ball work is built for players learning their first rally. For a group, check that your child meets the listing's age and level requirements.",
        ],
      },
      {
        heading: "Why we start at 6",
        paragraphs: [
          "Six is the academy's minimum age. Our Red Ball work uses a foam ball and short coaching cues while players develop paddle control, footwork and the rally. Check a current listing's eligibility and group size before choosing a class; partner programs can set a higher minimum age.",
          "Red, Orange, Green and Yellow Ball describe the NGA pathway, rather than a universal registration rule. Your child can work on the skills that fit their game through an eligible current program or a private lesson. A free evaluation is available when you want a coach's recommendation.",
        ],
      },
      {
        heading: "Signs your kid is ready",
        paragraphs: [
          "Brand new to pickleball, or still working on keeping a rally going? That's a Red Ball player, and it's the fun start. Can rally a little and knows the basic idea of the game? That's usually Orange Ball. Rallies consistently and wants shot selection and real doubles? Green Ball.",
          "If your child isn't comfortable in a group yet, a few 1:1 private lessons are the right first step — they build the rally, footwork, and consistency a child needs before joining a court.",
        ],
      },
      {
        heading: "Is it ever too late?",
        paragraphs: [
          "A 12-year-old who's new to pickleball can still begin with the skills that fit their game. Skill placement respects the program's age requirements, so look for a listing that serves your player or ask about a private lesson. A free 30-minute evaluation can help a coach recommend the next step without assuming a particular group is available.",
        ],
      },
    ],
  },
  {
    slug: "indoor-youth-pickleball-near-frederick-md",
    title: "Indoor Youth Pickleball Near Frederick, MD: A Guide",
    headline: "Indoor youth pickleball near Frederick, MD.",
    description:
      `Indoor pickleball near Frederick: the Saturday youth ${PICKLPARK_LEAGUES.length === 1 ? "league" : "leagues"} NGA coaches at The Pickl Park. Check each listing's ages and registration.`,
    datePublished: "2026-09-13",
    sections: [
      {
        paragraphs: [
          `Next Gen Pickleball Academy coaches ${PICKLPARK_LEAGUES.length} Saturday youth ${PICKLPARK_LEAGUES.length === 1 ? "league" : "leagues"} indoors at The Pickl Park in Frederick, ${PICKLPARK_SEASON_LABEL}. The YMCA of Frederick County and the City of Frederick's recreation department also list pickleball programs, so check their current schedules for youth times.`,
        ],
      },
      {
        heading: `The Saturday ${PICKLPARK_LEAGUES.length === 1 ? "league" : "leagues"} at The Pickl Park`,
        paragraphs: [
          `The Pickl Park is an indoor pickleball club in Frederick, and Next Gen coaches ${PICKLPARK_LEAGUES.length} ${PICKLPARK_SEASON_WEEKS}-week youth ${PICKLPARK_LEAGUES.length === 1 ? "league" : "leagues"} there. ${PICKLPARK_INDOOR_NOTE}`,
          ...PICKLPARK_LEAGUE_LINES,
          `${PICKLPARK_LEAGUE_PLACEMENT_NOTE} Registration and payment go through The Pickl Park, not Next Gen — the Frederick page on our site links straight to each league's listing.`,
        ],
      },
      {
        heading: "Private lessons in Frederick",
        paragraphs: [
          "Private lessons run at The Pickl Park too, for a child who wants extra 1:1 reps between Saturdays. Email or text Coach Sam and we'll set up a time.",
        ],
      },
      {
        heading: "Other places to look",
        paragraphs: [
          "The YMCA of Frederick County runs pickleball at its downtown Frederick location, and the City of Frederick's recreation department lists pickleball classes and indoor play. Both set their own schedules, ages, and prices, so check with them directly — we don't run programs at either.",
          "Coming from Montgomery County? Compare the actual venue, program ages and levels, dates and registration terms before choosing between county options and Frederick. An evaluation can help with placement questions, but the free NGA evaluation is offered in Montgomery County, rather than at a Frederick venue.",
        ],
      },
    ],
    links: [
      { label: "Youth pickleball in Frederick, MD", href: "/youth-pickleball-frederick" },
      { label: `The Pickl Park Saturday ${PICKLPARK_LEAGUES.length === 1 ? "league" : "leagues"}`, href: "/picklpark" },
    ],
  },
  {
    slug: "pickleball-vs-tennis-for-a-7-year-old",
    title: "Pickleball vs. Tennis for a 7-Year-Old: Which First?",
    headline: "Pickleball or tennis for a 7-year-old? A coach's take.",
    description:
      "Choosing pickleball or tennis for your child: consider their interests, current skills and available programs, with NGA's youth pathway explained.",
    datePublished: "2026-09-13",
    sections: [
      {
        paragraphs: [
          "For your seven-year-old, start with their interest in the game and a program that fits their age and skills. NGA serves ages 6–16, but each current listing sets its own eligibility. Pickleball and tennis both give a child ways to work on hand-eye coordination, footwork and court awareness. Compare the actual coaching options and let your child's interests help you choose a starting point.",
        ],
      },
      {
        heading: "Find a starting point your child enjoys",
        paragraphs: [
          "At NGA, a player learning the rally can start with Red Ball work on paddle control and footwork. Orange Ball builds consistency and rules; Green Ball adds strategy and teamwork. These descriptions explain the pathway, while the listing tells you which group is available and whether your child is eligible.",
          "Ask which parts of the game your child enjoys and what they'd like to try next. A coach can recommend a focus from watching them play. A free evaluation or private lesson is available when you want help finding that starting point. Your coach can explain the next skill to work on and how to practice it.",
        ],
      },
      {
        heading: "NGA's youth pathway",
        paragraphs: [
          "NGA's Red, Orange, Green and Yellow Ball pathway describes how we develop skills. Red Ball uses a foam ball while players learn the rally. Skill placement follows the actual program's age requirements. To find a group for your seven-year-old, compare eligible current listings or ask Coach Sam about a lesson. Check the listing for ages, levels, equipment and group size.",
        ],
      },
      {
        heading: "The skills transfer",
        paragraphs: [
          "Coach Amine is a longtime tennis coach who became a pickleball player, and the overlap is real: watching the ball onto the paddle, moving your feet before you swing, reading where an opponent will hit next. A child who starts with pickleball and later picks up a tennis racket isn't starting over.",
          "Not sure which fits your kid? Book the free 30-minute evaluation. A coach watches your child play and tells you honestly where they are.",
        ],
      },
    ],
  },
];

export function findBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
