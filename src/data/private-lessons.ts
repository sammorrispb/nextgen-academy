export interface Benefit {
  title: string;
  description: string;
  icon: string;
}

export interface PlayerProfile {
  label: string;
  description: string;
  color: string;
}

export const privateLessons = {
  headline: "Private Lessons",
  tagline: "1-on-1 coaching tailored to your child's game.",
  intro:
    "Private lessons give your child undivided attention from a Next Gen coach. Whether they're just starting out, working through a plateau, or grinding toward their first tournament, every session is built around their specific needs and goals.",

  benefits: [
    {
      title: "Personalized Game Plan",
      description:
        "Every session starts with a clear goal. Your coach assesses your child's strengths and weaknesses, then builds drills and match scenarios that target exactly what they need to improve.",
      icon: "target",
    },
    {
      title: "Accelerated Progress",
      description:
        "1-on-1 reps mean faster feedback loops. Players develop muscle memory and shot confidence in weeks instead of months compared to group-only training.",
      icon: "rocket",
    },
    {
      title: "Mental Game & Strategy",
      description:
        "Private sessions go beyond strokes. Coaches work on point construction, shot selection under pressure, and the mental toughness needed to close out tight games.",
      icon: "brain",
    },
    {
      title: "Flexible Scheduling",
      description:
        "Book sessions around your family's schedule. Mornings, after school, weekends — we work with you to find the right time and location.",
      icon: "calendar",
    },
  ] as Benefit[],

  playerProfiles: [
    {
      label: "New to the Sport",
      description:
        "Build a strong foundation from day one. Private lessons let beginners learn proper grip, footwork, and rally skills at their own pace without the pressure of keeping up with a group.",
      color: "#FF4040",
    },
    {
      label: "Developing Players",
      description:
        "Already comfortable on the court? Private sessions target specific shots — third-shot drops, resets, volleys — and introduce match strategy that takes your game to the next level.",
      color: "#FF8C00",
    },
    {
      label: "Competitive & Tournament-Bound",
      description:
        "For players chasing tournament results, private coaching focuses on high-pressure scenarios, pattern play, and opponent analysis. We build match plans and drill the execution.",
      color: "#00C853",
    },
    {
      label: "The Tournament Grind",
      description:
        "Preparing for a specific event? Intensive private sessions simulate tournament conditions — timed matches, scoreboard pressure, and recovery between games — so your child shows up ready to compete.",
      color: "#FFD600",
    },
  ] as PlayerProfile[],

  sessionDetails: {
    heading: "What to Expect",
    items: [
      "Pre-session goal setting with coach and player",
      "Warm-up drills tailored to the day's focus",
      "Targeted skill work with live-ball repetition",
      "Match-play scenarios and point-based games",
      "Post-session recap with takeaways for practice at home",
    ],
  },

  pricing: {
    heading: "Pricing",
    options: [
      { label: "Single Session", duration: "60 min", price: "$75" },
      { label: "4-Pack", duration: "60 min each", price: "$260", note: "Save $40" },
    ],
  },
} as const;
