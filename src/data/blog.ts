// Evergreen Coach-voice articles for /blog — the indexable long-form layer the
// 2026-07 discovery review called for (the news pipeline is email-only).
// Every factual claim traces to existing site content (faq.ts, levels.ts,
// recurring-templates.ts, camps.ts) — no invented venues, prices, or claims.
// Dates are ISO strings (UTC-build-safe).

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
          "Our summer camp weeks run at Gaithersburg High School, with an August back-to-school camp at Wood MS in Rockville the week before school starts. In the fall, our MVF classes run in Montgomery Village — the intro class at Apple Ridge, then Session I at Watkins Mill and Session II at North Creek. All of it starts the same way: a free 30-minute evaluation.",
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
          "Sessions are $20 per one-hour slot, drop-in — no subscription, no season commitment. You register for the slots that fit your family's week, and if we ever cancel a session for weather, you get an automatic full refund.",
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
];

export function findBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
