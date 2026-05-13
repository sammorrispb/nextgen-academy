export type BallColor = "red" | "orange" | "green" | "yellow";

export interface Level {
  key: BallColor;
  label: string;
  ages: string;
  tag: string;
  focus: string;
  detail: string;
  color: string;
}

export const levels: Level[] = [
  {
    key: "red",
    label: "Private Lessons",
    ages: "8+",
    tag: "Pre-Rally Bridge",
    focus: "Can't rally yet? Start here.",
    detail: "1:1 coaching to build the rally, footwork, and consistency a child needs before joining a group. Bridge to Orange Ball when they're ready.",
    color: "#FF4040",
  },
  {
    key: "orange",
    label: "Private Lessons",
    ages: "8+",
    tag: "Group Bridge",
    focus: "Rallying but not group-ready? Private path.",
    detail: "1:1 coaching on rules mastery, sustained rallying, and full-court movement. Bridge to Green Ball when ready for group play.",
    color: "#FF8C00",
  },
  {
    key: "green",
    label: "Green Ball",
    ages: "10+",
    tag: "Green Ball",
    focus: "Strategy meets competition. Partnerships form.",
    detail: "Shot selection, court positioning, doubles teamwork.",
    color: "#00C853",
  },
  {
    key: "yellow",
    label: "Yellow Ball",
    ages: "12+",
    tag: "Yellow Ball",
    focus: "Coach-curated competitive groups. The pathway to tournament play.",
    detail: "Small groups of 3–5 athletes, custom scheduling, focused prep.",
    color: "#FFD600",
  },
];
