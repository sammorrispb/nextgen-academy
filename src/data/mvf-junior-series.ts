import { NORTH_CREEK } from "@/data/mvf";
import {
  RESIDENT_PRICE_USD,
  NONRESIDENT_PRICE_USD,
  MVF_JUNIOR_TOURNAMENT_RAIN_ADDRESS,
  MVF_JUNIOR_TOURNAMENT_RAIN_VENUE,
} from "@/data/mvf-junior-tournament-2026";

// October 30 MVF emails confirm winter main dates/times. November's earlier
// start and the remaining policies are pending. This copy creates no release.
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

export const MVF_JUNIOR_SERIES_ENROLLMENT = "A minimum of 8 players across both brackets is needed to run each tournament.";
export const MVF_JUNIOR_SERIES_SHORT_BRACKET = "A short bracket may be combined or canceled. Final handling will be confirmed before registration opens.";
export const MVF_JUNIOR_SERIES_ELIGIBILITY = "The age cutoff and playing-up rules will be confirmed before registration opens.";
export const MVF_JUNIOR_SERIES_WEATHER_TERMS = "Weather cancellation, refund and credit terms are still being finalized and will be published before registration opens.";

export const MVF_JUNIOR_SERIES = [
  {
    slug: "november-2026", monthLabel: "November 2026", venue: northCreek, divisions, prices,
    dates: [{ iso: "2026-11-14", label: "Saturday, November 14, 2026" }],
    timeLabel: "Earlier daytime start — exact time to be confirmed",
    scheduleConfirmed: false,
    scheduleNote: "November 14 is planned outdoors. An earlier daytime start is being arranged because it gets dark early.",
    weatherBackup: { venue: lakeMarion, timeLabel: "3:00–6:00 PM ET" },
    makeup: null,
  },
  {
    slug: "january-2027", monthLabel: "January 2027", venue: lakeMarion, divisions, prices,
    dates: [{ iso: "2027-01-17", label: "Sunday, January 17, 2027" }],
    timeLabel: "10:00 AM–1:00 PM ET",
    scheduleConfirmed: true,
    scheduleNote: "The main event date, time and indoor location are confirmed with MVF.",
    weatherBackup: null,
    makeup: { date: { iso: "2027-01-23", label: "Saturday, January 23, 2027" }, timeLabel: "3:30–6:30 PM ET" },
  },
  {
    slug: "february-2027", monthLabel: "February 2027", venue: lakeMarion, divisions, prices,
    dates: [{ iso: "2027-02-14", label: "Sunday, February 14, 2027" }],
    timeLabel: "10:00 AM–1:00 PM ET",
    scheduleConfirmed: true,
    scheduleNote: "The main event date, time and indoor location are confirmed with MVF.",
    weatherBackup: null,
    makeup: { date: { iso: "2027-02-20", label: "Saturday, February 20, 2027" }, timeLabel: "3:30–6:30 PM ET" },
  },
] as const;

export type MvfJuniorSeriesEvent = (typeof MVF_JUNIOR_SERIES)[number];

export function findMvfJuniorSeriesEvent(slug: string): MvfJuniorSeriesEvent | undefined {
  return MVF_JUNIOR_SERIES.find((event) => event.slug === slug);
}

export function mvfJuniorSeriesUrl(event: MvfJuniorSeriesEvent): string {
  return `https://nextgenpbacademy.com/mvf-junior-tournament/${event.slug}`;
}
