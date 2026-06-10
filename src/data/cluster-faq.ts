// Parent-facing FAQ for the NGA Clusters launch (Fall 2026).
// DRAFT — must pass /brand-review-nga before going public. Specifically:
//   - "Is this varsity?" answer must NOT claim varsity status (MCPS owns that)
//   - No disparaging the MCPS corollary program
//   - No JOOLA/DC Pickleball Team mentions
//   - Pricing stays teased (no dollar amounts) until coach roster + venue lock
//   - Clusters are named by AREA (Down/Up/East/Mid-County) — color is a visual
//     recognition cue only, never part of the name or copy
// Plan reference: ~/.claude/plans/how-can-we-tie-crispy-narwhal.md

export interface ClusterFaqItem {
  question: string;
  answer: string;
}

export const CLUSTER_FAQ: readonly ClusterFaqItem[] = [
  {
    question: "What is an NGA Cluster?",
    answer:
      "An NGA Cluster is a regional team of MoCo kids who train together year-round with their NGA coach. Four clusters cover the county — Down-County, Up-County, East-County, and Mid-County — and they compete head-to-head in age divisions through the season.",
  },
  {
    question: "Is this MCPS varsity pickleball?",
    answer:
      "No. Every MCPS high school runs its own Fall pickleball team — an inclusion-first program pairing gen-ed and special-ed students on the same roster. We love it. NGA Clusters are the year-round layer underneath: real reps, age-division play, and a clear pathway so kids walk into Fall tryouts ready. We feed the school program; we don't replace it.",
  },
  {
    question: "Does my kid have to be in high school?",
    answer:
      "No. Clusters welcome kids ages 10–14 for Fall 2026 (U12 and U14 divisions). Younger kids who can rally are eligible if they're at Green or Yellow ball level. Red and Orange ball players start with private lessons until they bridge to group play.",
  },
  {
    question: "Which cluster is my school in?",
    answer:
      "Each cluster page lists every MCPS high school and middle school in its area — find your school and you've found your cluster. Clusters cover whole regions, not single schools, so teammates come from across the area. In Fall, kids play for their own MCPS school team; the rest of the year they train and compete with their area cluster.",
  },
  {
    question: "Where do clusters train?",
    answer:
      "Each cluster has a home site somewhere inside its region. We're locking in venues for Fall 2026 right now — join the interest list and we'll share location, day-of-week, and start time the moment they're confirmed.",
  },
  {
    question: "What does it cost?",
    answer:
      "Pricing will be in line with our existing small-group sessions — we'll share full details with families on the interest list before registration opens. No subscription, no surprises.",
  },
  {
    question: "When does the season start?",
    answer:
      "First cluster practices run alongside the MCPS Fall pickleball window — late summer through early November 2026 — culminating in the MoCo Cup. A Spring cluster season may follow based on demand.",
  },
  {
    question: "How are coaches vetted?",
    answer:
      "Every Cluster Head Coach is a senior NGA coach — multiple seasons on court, cleared background check, child-safety vetting, and a working knowledge of the Red → Orange → Green → Yellow pathway. Our coaching standards live in the NGA Coaching System and don't bend, ever — clusters included.",
  },
  {
    question: "Will my kid get a DUPR rating?",
    answer:
      "Yes. Every cluster player gets a DUPR — pickleball's universal skill rating (think GPA for play level). It lets coaches build fair matchups across clusters. For the U12 (ages 10–12) division, the rating stays private; U14 players (ages 13–14) see theirs after their first scored match.",
  },
  {
    question: "How do I join?",
    answer:
      "Add your family to the interest list for your area — that's the only way to be first in line when we open registration in summer 2026. Pick your cluster from the four area pages.",
  },
] as const;
