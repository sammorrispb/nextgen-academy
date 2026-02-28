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

export interface Season {
  label: string;
  dates: string;
  weeks: number;
  status?: "active" | "upcoming";
  locations: ScheduleLocation[];
}

const winterSeason: Season = {
  label: "Winter 2026",
  dates: "Ends March 22",
  weeks: 0,
  status: "active",
  locations: [
    {
      location: "Rockville",
      venue: "Dill Dinkers",
      address: "40 Southlawn Court, Suite C, Rockville, MD 20850",
      slots: [
        {
          day: "Tuesdays",
          time: "5:45–6:45 PM",
          links: [
            { level: "green", url: "https://app.courtreserve.com/Online/Events/Public/10869/1574506" },
          ],
        },
        {
          day: "Wednesdays",
          time: "5:00–6:00 PM",
          links: [
            { level: "red", url: "https://app.courtreserve.com/Online/Events/Public/10869/1687528" },
          ],
        },
        {
          day: "Wednesdays",
          time: "6:00–7:00 PM",
          links: [
            { level: "orange", url: "https://app.courtreserve.com/Online/Events/Public/10869/1643315" },
          ],
        },
        {
          day: "Thursdays",
          time: "5:45–6:45 PM",
          links: [
            { level: "green", url: "https://app.courtreserve.com/Online/Events/Public/10869/1574506" },
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
          time: "12:00–1:00 PM",
          links: [
            { level: "red", url: "https://app.courtreserve.com/Online/Events/Public/10483/1574519" },
            { level: "orange", url: "https://app.courtreserve.com/Online/Events/Public/10483/1574521" },
          ],
        },
        {
          day: "Saturdays",
          time: "1:00–2:00 PM",
          links: [
            { level: "green", url: "https://app.courtreserve.com/Online/Events/Public/10483/1588447" },
          ],
        },
        {
          day: "Sundays",
          time: "4:00–5:00 PM",
          links: [
            { level: "orange", url: "https://app.courtreserve.com/Online/Events/Public/10483/1661259" },
          ],
        },
        {
          day: "Sundays",
          time: "5:00–6:00 PM",
          links: [
            { level: "green", url: "https://app.courtreserve.com/Online/Events/Public/10483/1579447" },
          ],
        },
      ],
    },
  ],
};

const springSeason: Season = {
  label: "Spring 2026",
  dates: "April 11 – June 15",
  weeks: 10,
  status: "upcoming",
  locations: [
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
  ],
};

export const seasons: Season[] = [winterSeason, springSeason];

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
