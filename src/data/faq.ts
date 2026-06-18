export interface FaqItem {
  question: string;
  answer: string;
  cta?: { label: string; href: string };
}

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
      "We coach across Montgomery County Public Schools. Sessions rotate weekly based on court availability — common areas include Rockville, North Bethesda, Bethesda, Potomac, Chevy Chase, Kensington, Silver Spring, Gaithersburg, Derwood, and Aspen Hill. The /schedule page shows this week's confirmed venues; email or text us if you don't see one near you.",
  },
  {
    question: "How do free evaluations work?",
    answer:
      "Fill out the form below or email us at nextgenacademypb@gmail.com to schedule a 30-minute evaluation. Our coaches will assess your child’s current level and place them on the right court — Red, Orange, Green, or Yellow Ball — with private lessons available if you'd like to fast-track. There’s no cost and no commitment.",
  },
  {
    question: "How much do youth pickleball lessons cost at Next Gen?",
    answer:
      "Group classes are $20 per 1-hour slot, drop-in. No subscription and no commitment — you pay for each slot you attend. Each pickleball court is capped at 4 players so quality stays high. Registrations are non-refundable unless we cancel — if we call off a session for weather or any other reason, you get an automatic full refund. The 30-minute evaluation is always free. Private lesson rates are quoted after the evaluation based on what your child needs.",
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
      "We serve families across Bethesda, Potomac, Chevy Chase, Kensington, Silver Spring, Rockville, North Bethesda, Gaithersburg, Derwood, Aspen Hill, and most of the DMV. Sessions rotate seasonally between Montgomery County courts — reach out for the current location.",
  },
  {
    question: "Do you offer lessons for adults?",
    answer:
      "Next Gen is youth-only (ages 6–16). For adults, Head Coach Sam Morris offers private lessons separately at sammorrispb.com — start with a free 30-minute skill evaluation, no commitment. Many of our NGA parents pick up the paddle alongside their kids.",
  },
];
