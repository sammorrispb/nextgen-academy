import type { BallColor } from "./levels";

export interface ScheduleLink {
  level: BallColor;
  url: string;
}

export interface ScheduleSlot {
  day: string;
  time: string;
  links: ScheduleLink[];
}

export interface ScheduleLocation {
  location: string;
  venue: string;
  address: string;
  slots: ScheduleSlot[];
}

export const seasonLabel = "Spring 2026";
export const seasonDates = "April 11 – June 15";
export const seasonWeeks = 10;

export const schedule: ScheduleLocation[] = [
  {
    location: "Rockville",
    venue: "Dill Dinkers",
    address: "40 Southlawn Court, Suite C, Rockville, MD 20850",
    slots: [
      {
        day: "Sundays",
        time: "9:00–10:00 AM",
        links: [
          { level: "red", url: "https://app.courtreserve.com/Online/Events/Public/10869/1912084" },
          { level: "orange", url: "https://app.courtreserve.com/Online/Events/Public/10869/1912076" },
          { level: "green", url: "https://app.courtreserve.com/Online/Events/Public/10869/1912060" },
        ],
      },
      {
        day: "Mondays",
        time: "5:30–6:30 PM",
        links: [
          { level: "red", url: "https://app.courtreserve.com/Online/Events/Public/10869/1912042" },
          { level: "orange", url: "https://app.courtreserve.com/Online/Events/Public/10869/1912047" },
          { level: "green", url: "https://app.courtreserve.com/Online/Events/Public/10869/1912052" },
        ],
      },
    ],
  },
  {
    location: "North Bethesda",
    venue: "Dill Dinkers",
    address: "4942 Boiling Brook Parkway, North Bethesda, MD 20852",
    slots: [
      {
        day: "Saturdays",
        time: "10:00–11:00 AM",
        links: [
          { level: "red", url: "https://app.courtreserve.com/Online/Events/Public/10483/1912330" },
          { level: "orange", url: "https://app.courtreserve.com/Online/Events/Public/10483/1912338" },
          { level: "green", url: "https://app.courtreserve.com/Online/Events/Public/10483/1912347" },
        ],
      },
    ],
  },
];

export const yellowBallPricing = [
  { players: 2, price: "$90/player" },
  { players: 3, price: "$60/player" },
  { players: 4, price: "$45/player" },
  { players: 5, price: "$36/player" },
];
