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

import {
  PICKLPARK_LEAGUES,
  PICKLPARK_LEAGUE_PLACEMENT_NOTE,
} from "./picklpark-leagues-2026";
import {
  PICKLPARK_INDOOR_NOTE,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_SEASON_WEEKS,
} from "./picklpark-2026";

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
    slug: "is-pickleball-safe-for-kids",
    title: "Is Pickleball Safe for Kids? A MoCo Coach's Answer",
    headline: "Is pickleball safe for kids? A coach's honest answer.",
    description:
      "Why pickleball is one of the safest racket sports for kids 6–16 — smaller courts, lighter paddles, slower balls, and USA Pickleball's youth progression.",
    datePublished: "2026-07-25",
    sections: [
      {
        paragraphs: [
          "It's the question we hear most from parents who've just watched their first pickleball rally: is this actually safe for my kid? Short answer — yes, and it's one of the safest racket sports a child can pick up.",
          "The court is roughly a third the size of a tennis court, so kids aren't sprinting long distances or overreaching for balls. The paddle is lightweight — far easier on small wrists and shoulders than a tennis racket. And the ball itself is a perforated plastic ball that moves at lower speeds than a tennis ball, which means more time to react and fewer hard impacts.",
        ],
      },
      {
        heading: "The youth ball progression is a safety system too",
        paragraphs: [
          "USA Pickleball's official youth progression uses color-coded balls — Red, Orange, Green, Yellow — with reduced bounce and compression at the early stages. A Red Ball player is learning on a foam ball: soft, slow, and forgiving while paddle control and footwork develop. The game only speeds up as the child's technique is ready for it. That's the same principle behind graduated equipment in youth tennis and coach-pitch baseball — the sport meets the kid where they are.",
          "At Next Gen we add our own layer on top: every group court is capped at four players so coaches see every rep, sessions start with age-appropriate warmups, and each ball color runs on its own court so a brand-new 7-year-old is never sharing space with a tournament-track 14-year-old's drives.",
        ],
      },
      {
        heading: "What parents can do",
        paragraphs: [
          "Send your child in comfortable athletic clothing and court shoes with non-marking soles, plus a water bottle — we provide the paddles and balls. And if you're not sure your child is ready for group play, that's exactly what the free 30-minute evaluation is for: a coach watches your child play and recommends the right starting point, whether that's the Red Ball court or a few 1:1 lessons first.",
        ],
      },
    ],
  },
  {
    slug: "youth-pickleball-ball-colors-explained",
    title: "Red, Orange, Green, Yellow: Youth Pickleball Levels",
    headline: "Red, Orange, Green, Yellow — the youth ball colors, explained.",
    description:
      "What the color-coded youth progression means, how kids move from Red Ball to the Yellow Ball tournament track, and why placement is by skill, not age.",
    datePublished: "2026-07-25",
    sections: [
      {
        paragraphs: [
          "If you've seen our schedule, you've seen the colors: Red, Orange, Green, Yellow. They're not team names — they're USA Pickleball's official youth progression, a ladder of color-coded balls that lets a child learn real technique before the game speeds up. Here's what each step actually means, in plain parent terms.",
        ],
      },
      {
        heading: "Red Ball — pre-rally (ages 6+)",
        paragraphs: [
          "The starting court, built for kids brand-new to the game. Red Ball sessions use a foam ball — slow and forgiving — while kids build paddle control, footwork, and their first sustained back-and-forth. No experience needed; this court exists precisely for kids who can't rally yet.",
        ],
      },
      {
        heading: "Orange Ball — building (ages 6+)",
        paragraphs: [
          "The bridge level. Kids here can rally and are layering in rules mastery, consistency, and full-court movement. It's where the game starts looking like the game.",
        ],
      },
      {
        heading: "Green Ball — strategy (ages 10+)",
        paragraphs: [
          "Strategy meets competition: shot selection, court positioning, and doubles teamwork. Partnerships start to form at this level, and kids begin thinking a shot ahead.",
        ],
      },
      {
        heading: "Yellow Ball — the tournament track (ages 12+)",
        paragraphs: [
          "Our coach-curated competitive track: small groups of 3–5 athletes, custom scheduling around tournaments, and focused prep. Yellow Ball is invite-only — interest goes through our inquiry form, and coaches extend invitations based on readiness.",
        ],
      },
      {
        heading: "How placement works",
        paragraphs: [
          "Placement is by skill, never age alone. Every child starts with a free 30-minute evaluation where a coach watches them play and places them on the right court. Every level is a step on one ladder, not a ceiling — and private lessons are available at any color for kids who want to fast-track with 1:1 reps.",
        ],
      },
    ],
  },
  {
    slug: "where-kids-play-pickleball-montgomery-county",
    title: "Where Kids Play Pickleball in Montgomery County, MD",
    headline: "Where kids can play pickleball in Montgomery County.",
    description:
      "A parent's guide to youth pickleball in MoCo — Next Gen's weekend session venues, summer camps, fall classes, and where to find public courts for family play.",
    datePublished: "2026-07-25",
    sections: [
      {
        paragraphs: [
          "Montgomery County has quietly become a great place for a kid to learn pickleball — school courts, public parks, and structured youth coaching all within a short drive. Here's the current lay of the land from where we stand.",
        ],
      },
      {
        heading: "Structured weekly sessions",
        paragraphs: [
          "Next Gen's group sessions run on weekend evenings at reserved Montgomery County Public Schools courts — this season that's Earle B. Wood Middle School in Rockville on Saturdays and Walter Johnson High School in Bethesda on Sundays, with a court for every ball color and four players per court. Venues shift season to season, so the schedule page always has the current lineup.",
        ],
      },
      {
        heading: "Camps and classes",
        paragraphs: [
          "Our summer camp weeks run at Gaithersburg High School, with an August back-to-school camp at Wood MS in Rockville the week before school starts. In the fall, our MVF classes run in Montgomery Village — the intro class at Apple Ridge, then both six-week Thursday sessions at North Creek. All of it starts the same way: a free 30-minute evaluation.",
        ],
      },
      {
        heading: "Public courts for family play",
        paragraphs: [
          "One of the best things you can do between sessions is simply play with your kid. Montgomery County has dozens of public courts — dedicated and shared — across Rockville, Silver Spring, Gaithersburg, Wheaton, and beyond. Our sister community Link & Dink maintains an interactive map of every public pickleball court in the county, with court counts and lights for evening play. Grab a paddle, find a court near you, and let your child show you what they've learned.",
        ],
      },
    ],
    links: [
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
      "How a child's first Next Gen pickleball session works — the free evaluation, what to bring, how placement happens, and what the first hour on court looks like.",
    datePublished: "2026-07-25",
    sections: [
      {
        paragraphs: [
          "First sessions come with first-session nerves — for kids and parents alike. Here's exactly how it works at Next Gen, so everyone walks on court knowing what's coming.",
        ],
      },
      {
        heading: "Step one: the free evaluation",
        paragraphs: [
          "Before any group session, every child gets a free 30-minute evaluation with a coach. The coach watches your child play — no drills to memorize, no test to pass — and recommends a starting court: Red, Orange, Green, or Yellow Ball. Placement is by skill, not age, so your child lands with peers at their level. There's no cost and no commitment.",
        ],
      },
      {
        heading: "What to bring",
        paragraphs: [
          "Comfortable athletic clothing, court shoes with non-marking soles, and a water bottle. That's it — we provide paddles and balls for every session. No need to buy equipment before your child knows they love the game.",
        ],
      },
      {
        heading: "What the first hour looks like",
        paragraphs: [
          "Group sessions run one hour on a court capped at four players, so every kid gets constant reps — not line-standing. Expect an age-appropriate warmup, skill work built around their ball color, and plenty of actual play. Our coaching philosophy is a growth mindset: kids develop through effort, encouragement, and getting another rep, never through labels.",
          "Sessions are one hour, drop-in — no subscription, no season commitment. You register for the slots that fit your family's week, the price is shown at checkout before you pay, and if we ever cancel a session for weather, you get an automatic full refund.",
        ],
      },
      {
        heading: "Ready when you are",
        paragraphs: [
          "Book the free evaluation, meet a coach, and see how your child takes to it. Most kids are rallying — and grinning — sooner than their parents expect.",
        ],
      },
    ],
  },
  {
    slug: "best-age-to-start-pickleball",
    title: "What's the Best Age to Start Pickleball? A Coach's Take",
    headline: "What's the best age for a kid to start pickleball?",
    description:
      "A youth coach's answer: most kids are ready for group pickleball around 6, placement is by skill not age, and Red Ball is built for kids who can't rally yet.",
    datePublished: "2026-09-13",
    sections: [
      {
        paragraphs: [
          "Most kids are ready to start group pickleball around age 6 — that's where our Red Ball court begins. The better question isn't age, though: it's whether your child is ready for a group, and the Red Ball court is built for kids who can't rally yet.",
        ],
      },
      {
        heading: "Why we start at 6",
        paragraphs: [
          "Our Red Ball court starts at 6 because the format is built for young players: small groups, short coaching cues, and a soft foam ball with less bounce, so a child has time to react and learn real technique before the game speeds up.",
          "We coach kids 6 through 16, and every age range has a place to start. Red and Orange Ball are open from 6, Green Ball from 10, and the Yellow Ball tournament track from 12.",
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
          "No. Placement is by skill, never age alone, so a 12-year-old who has never held a paddle starts on the court that fits their game, not their birthday — and moves up as fast as their game grows. That's what the free 30-minute evaluation is for: a coach watches your child play and tells you where they fit.",
        ],
      },
    ],
  },
  {
    slug: "indoor-youth-pickleball-near-frederick-md",
    title: "Indoor Youth Pickleball Near Frederick, MD: A Guide",
    headline: "Indoor youth pickleball near Frederick, MD.",
    description:
      "Where kids can play indoor pickleball near Frederick, MD — the Saturday youth leagues Next Gen coaches at The Pickl Park, and other programs worth checking.",
    datePublished: "2026-09-13",
    sections: [
      {
        paragraphs: [
          `Next Gen Pickleball Academy coaches two Saturday youth leagues indoors at The Pickl Park in Frederick, ${PICKLPARK_SEASON_LABEL}. The YMCA of Frederick County and the City of Frederick's recreation department also list pickleball programs, so check their current schedules for youth times.`,
        ],
      },
      {
        heading: "The Saturday leagues at The Pickl Park",
        paragraphs: [
          `The Pickl Park is an indoor pickleball club in Frederick, and Next Gen coaches ${PICKLPARK_SEASON_WEEKS}-week youth leagues there. ${PICKLPARK_INDOOR_NOTE}`,
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
          "Coming from upper Montgomery County? Our Montgomery County sessions and seasons are a short drive down I-270.",
        ],
      },
    ],
    links: [
      { label: "Youth pickleball in Frederick, MD", href: "/youth-pickleball-frederick" },
      { label: "The Pickl Park Saturday leagues", href: "/picklpark" },
    ],
  },
  {
    slug: "pickleball-vs-tennis-for-a-7-year-old",
    title: "Pickleball vs. Tennis for a 7-Year-Old: Which First?",
    headline: "Pickleball or tennis for a 7-year-old? A coach's take.",
    description:
      "Why pickleball is often the easier first racket sport for a young child — smaller court, lighter paddle, slower ball — and how its skills carry into tennis.",
    datePublished: "2026-09-13",
    sections: [
      {
        paragraphs: [
          "For most 7-year-olds, pickleball is the easier first racket sport: the court is smaller, the paddle is lighter, and the ball is slower, so kids get to real rallies sooner. It isn't either-or, though — the hand-eye coordination, footwork, and court sense a child builds in pickleball carry straight into tennis.",
        ],
      },
      {
        heading: "Why pickleball clicks faster for young kids",
        paragraphs: [
          "A pickleball court is roughly a third the size of a tennis court, so a young player isn't sprinting long distances or overreaching. The paddle is lightweight, which is easier on small wrists and shoulders. And the perforated plastic ball moves slower than a tennis ball, which buys a child more time to react.",
          "Early success matters at 7. When a kid can keep a rally going in their first few sessions, they want to come back — and coming back is how skills compound.",
        ],
      },
      {
        heading: "Both sports meet kids where they are",
        paragraphs: [
          "Youth tennis and youth pickleball use the same idea: graduated equipment. In pickleball, USA Pickleball's youth progression runs Red, Orange, Green, Yellow, with softer, lower-bounce balls at the early stages so technique comes before speed. A 7-year-old would typically start on our Red or Orange Ball court, depending on whether they can rally yet.",
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
