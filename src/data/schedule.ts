export interface Season {
  label: string;
  dates: string;
}

export const seasons: Season[] = [
  { label: "Spring 2026", dates: "April 11 – June 15" },
];

export const sessionPricing = [
  { level: "Red Ball", price: "$35/session" },
  { level: "Orange Ball", price: "$45/session" },
  { level: "Green Ball", price: "$45/session" },
  { level: "Yellow Ball", price: "$45/session" },
];

export const billingPolicy = {
  cadence:
    "Parents are charged at the start of each month for the full month (amount depends on how many weeks fall in that month).",
  pauseCancel:
    "To pause or cancel, email nextgenacademypb@gmail.com at least 5 days before the 1st of the month.",
  slot: "Each enrollment reserves a specific day and time slot every week.",
};
