export interface Season {
  label: string;
  dates: string;
}

export const seasons: Season[] = [
  { label: "Spring 2026", dates: "April 11 – June 15" },
];

export const yellowBallPricing = [
  { players: 2, price: "$90/player" },
  { players: 3, price: "$60/player" },
  { players: 4, price: "$45/player" },
  { players: 5, price: "$36/player" },
];

export const privateLessonPricing = {
  single: { label: "1 Hour", price: "$130" },
  pack: { label: "4 Hours", price: "$400" },
};
