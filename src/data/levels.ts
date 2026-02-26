export type BallColor = "red" | "orange" | "green" | "yellow";

export interface Level {
  key: BallColor;
  label: string;
  ages: string;
  tag: string;
  focus: string;
  detail: string;
  dropIn: string | null;
  season: string | null;
  color: string;
  bgLight: string;
}

export const levels: Level[] = [
  {
    key: "red",
    label: "Red Ball",
    ages: "5+",
    tag: "Beginner",
    focus: "First paddle, first rally, first love of the game.",
    detail: "Movement, hand-eye coordination, basic rules of play.",
    dropIn: "$35/drop-in",
    season: "$300/season",
    color: "#DC2626",
    bgLight: "#FEF2F2",
  },
  {
    key: "orange",
    label: "Orange Ball",
    ages: "7+",
    tag: "Adv. Beginner",
    focus: "From rallying to competing — the game starts to click.",
    detail: "Rules mastery, sustained rallying, full-court movement.",
    dropIn: "$40/drop-in",
    season: "$350/season",
    color: "#EA580C",
    bgLight: "#FFF7ED",
  },
  {
    key: "green",
    label: "Green Ball",
    ages: "9+",
    tag: "Intermediate",
    focus: "Strategy meets competition. Partnerships form.",
    detail: "Shot selection, court positioning, doubles teamwork.",
    dropIn: "$50/drop-in",
    season: "$450/season",
    color: "#16A34A",
    bgLight: "#F0FDF4",
  },
  {
    key: "yellow",
    label: "Yellow Ball",
    ages: "12+",
    tag: "3.0+ Tournament",
    focus: "Coach-curated competitive groups. The pathway to tournament play.",
    detail: "Small groups of 3–5 athletes, custom scheduling, focused prep.",
    dropIn: null,
    season: null,
    color: "#CA8A04",
    bgLight: "#FEFCE8",
  },
];
