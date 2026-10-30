import { NORTH_CREEK } from "@/data/mvf";
import {
  RESIDENT_PRICE_USD,
  NONRESIDENT_PRICE_USD,
  MVF_JUNIOR_TOURNAMENT_RAIN_ADDRESS,
  MVF_JUNIOR_TOURNAMENT_RAIN_VENUE,
} from "@/data/mvf-junior-tournament-2026";

// Sam's October 30 call establishes months, venues, fees and bracket caps.
// Exact dates/times, age boundaries and November's rain plan await confirmation.
// These are informational pages only; October's checkout and ledger stay closed.
const divisions = [
  { slug: "12u", label: "12U", ageLabel: "12 and under", capacity: 10 },
  { slug: "16u", label: "16U", ageLabel: "16 and under", capacity: 10 },
] as const;
const prices = { residentUsd: RESIDENT_PRICE_USD, nonresidentUsd: NONRESIDENT_PRICE_USD } as const;
const northCreek = {
  name: NORTH_CREEK.center,
  address: `${NORTH_CREEK.streetAddress}, ${NORTH_CREEK.locality}, ${NORTH_CREEK.region} ${NORTH_CREEK.postalCode}`,
  indoors: false,
  environmentLabel: "Outdoors",
};
const lakeMarion = {
  name: MVF_JUNIOR_TOURNAMENT_RAIN_VENUE,
  address: MVF_JUNIOR_TOURNAMENT_RAIN_ADDRESS,
  indoors: true,
  environmentLabel: "Indoors",
};

export const MVF_JUNIOR_SERIES = [
  {
    slug: "november-2026", monthLabel: "November 2026", venue: northCreek, divisions, prices,
    proposedDates: [{ iso: "2026-11-14", label: "Saturday, November 14, 2026" }],
    proposedTime: "4:00–7:00 PM ET",
  },
  {
    slug: "january-2027", monthLabel: "January 2027", venue: lakeMarion, divisions, prices,
    proposedDates: [{ iso: "2027-01-16", label: "Saturday, January 16, 2027" }],
    proposedTime: "10:00 AM–1:00 PM ET",
  },
  {
    slug: "february-2027", monthLabel: "February 2027", venue: lakeMarion, divisions, prices,
    proposedDates: [
      { iso: "2027-02-13", label: "Saturday, February 13, 2027" },
      { iso: "2027-02-20", label: "Saturday, February 20, 2027" },
    ],
    proposedTime: null,
  },
] as const;

export type MvfJuniorSeriesEvent = (typeof MVF_JUNIOR_SERIES)[number];

export function findMvfJuniorSeriesEvent(slug: string): MvfJuniorSeriesEvent | undefined {
  return MVF_JUNIOR_SERIES.find((event) => event.slug === slug);
}

export function mvfJuniorSeriesUrl(event: MvfJuniorSeriesEvent): string {
  return `https://nextgenpbacademy.com/mvf-junior-tournament/${event.slug}`;
}
