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
    label: "Red Ball",
    ages: "6+",
    tag: "Pre-Rally",
    focus: "New to the court? Start here.",
    detail: "Foam-ball group sessions that build the rally, footwork, and consistency from day one — your own court at your level. Private lessons are available to fast-track kids who want extra 1:1 reps.",
    color: "#FF4040",
  },
  {
    key: "orange",
    label: "Orange Ball",
    ages: "6+",
    tag: "Building",
    focus: "Rallying and ready to grow.",
    detail: "Group sessions on rules mastery, sustained rallying, and full-court movement — the bridge to Green Ball. Private lessons available anytime a child wants extra 1:1 time.",
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
