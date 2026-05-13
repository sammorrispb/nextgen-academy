export interface FaqItem {
  question: string;
  answer: string;
  cta?: { label: string; href: string };
}

export const faq: FaqItem[] = [
  {
    question: "What ages do you accept?",
    answer:
      "Our group sessions are built for kids ages 8–16 who can already rally. Orange Ball starts at 8+, Green Ball at 10+, and Yellow Ball (tournament track) at 12+. Kids 8+ who are still learning to rally start with private lessons until they're ready to join a group.",
  },
  {
    question: "My child can't rally yet — can they still join?",
    answer:
      "Yes — they start with private lessons. Group sessions are paced for kids who can already sustain a rally, so we use 1:1 coaching to build the basics — paddle control, footwork, sustained back-and-forth — before joining Orange Ball. Most kids are group-ready within a handful of private sessions. Schedule a free 30-minute evaluation and we'll lay out a plan.",
  },
  {
    question: "Does my child need experience?",
    answer:
      "Some, yes. Group sessions assume your child can rally. If they can't yet, we'll start with private lessons to get them group-ready. Schedule a free evaluation and we'll tell you which path fits.",
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
      "Fill out the form below or email us at nextgenacademypb@gmail.com to schedule a 30-minute evaluation. Our coaches will assess your child’s current level and recommend the right path — a group level, or private lessons if they're still learning to rally. There’s no cost and no commitment.",
  },
  {
    question: "How much do youth pickleball lessons cost at Next Gen?",
    answer:
      "Group classes are $40 per 1-hour slot ($80 for both slots in a session), drop-in. Sessions split into Early and Late slots — pick one or both. No subscription and no commitment — you pay for each slot you attend. Each pickleball court is capped at 4 players so quality stays high. Payments are non-refundable. The 30-minute evaluation is always free. Private lesson rates are quoted after the evaluation based on what your child needs.",
  },
  {
    question: "What’s your refund policy?",
    answer:
      "All session registrations are non-refundable. There is no 7-day refund window. Please register only when you’re confident your child can attend — we can’t offer credits or transfers for missed sessions. The free 30-minute evaluation is always free and never charged.",
  },
  {
    question: "Is pickleball safe for kids?",
    answer:
      "Yes. Pickleball is one of the safest racket sports for children: the court is smaller than tennis, the paddle is lightweight, and the ball moves at lower speeds than a tennis ball. USA Pickleball’s official youth progression uses color-coded balls (Red, Orange, Green, Yellow) with reduced bounce and compression so kids learn proper technique before the game speeds up. Our coaches are trained in youth-appropriate drills, warmups, and game formats.",
  },
  {
    question: "What’s the difference between Red, Orange, Green, and Yellow Ball?",
    answer:
      "Each color follows USA Pickleball’s youth progression — placement is by skill, not age. Red Ball (8+ pre-rally) is the foundation: paddle control, footwork, and sustained back-and-forth — delivered 1:1 as private lessons until a child is group-ready. Orange Ball (8+) is the first group level once a kid can rally — rules mastery, full-court movement, the game starting to click. Green Ball (10+) layers in shot selection, court positioning, and doubles teamwork. Yellow Ball (12+) is our coach-curated competitive track — small groups of 3–5 athletes with custom scheduling and focused tournament prep. Every child is placed during a free evaluation, never on age alone.",
    cta: { label: "See the four levels in detail", href: "#levels" },
  },
  {
    question: "Do you offer private pickleball lessons for kids?",
    answer:
      "Yes — and they’re the right starting point for any child 8+ who can’t rally yet. 1:1 coaching builds the rally, footwork, and consistency a child needs before joining a group. Head Coach Sam Morris is a former physical education teacher and Co-Founder of Next Gen Academy; Co-Founder Amine Lahlou is a former professional tennis player. Email nextgenacademypb@gmail.com or call 301-325-4731 to schedule.",
  },
  {
    question: "Can my child join mid-season?",
    answer:
      "Yes. We accept new players throughout the season. Start with a free 30-minute evaluation and our coaches will place your child into the current session that fits their level and schedule — or recommend a private-lesson bridge if they’re not yet group-ready.",
  },
  {
    question: "Which Montgomery County towns do you serve?",
    answer:
      "We serve families across Bethesda, Potomac, Chevy Chase, Kensington, Silver Spring, Rockville, North Bethesda, Gaithersburg, Derwood, Aspen Hill, and most of the DMV. Sessions rotate seasonally between Montgomery County courts — reach out for the current location.",
  },
  {
    question: "Do you offer lessons for adults?",
    answer:
      "Next Gen is youth-only (ages 8–16). For adults, Head Coach Sam Morris offers private lessons separately at sammorrispb.com — start with a free 30-minute skill evaluation, no commitment. Many of our NGA parents pick up the paddle alongside their kids.",
  },
];
