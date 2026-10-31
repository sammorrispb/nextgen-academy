import { NORTH_CREEK } from "@/data/mvf";
import {
  RESIDENT_PRICE_USD,
  NONRESIDENT_PRICE_USD,
  MVF_JUNIOR_TOURNAMENT_RAIN_ADDRESS,
  MVF_JUNIOR_TOURNAMENT_RAIN_VENUE,
} from "@/data/mvf-junior-tournament-2026";

// Sam confirmed MVF's November 10 AM–noon slot and the launch policies.
// Public copy does not itself enable admission or change payment validation.
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
export const MVF_JUNIOR_SERIES_SHORT_BRACKET = "If a bracket has fewer than 5 players, we will decide whether to combine or cancel it 3 days before the tournament.";
export const MVF_JUNIOR_SERIES_ELIGIBILITY = "Players must be at least 6. Age is measured on December 31 of the tournament year. Younger players may play up into an older junior bracket.";
export const MVF_JUNIOR_SERIES_WEATHER_TERMS = "Weather decisions will be made 24 hours before the tournament.";
export const MVF_JUNIOR_SERIES_CANCELLATION = "No refunds unless we cancel.";

export const MVF_JUNIOR_SERIES = [
  {
    slug: "november-2026", monthLabel: "November 2026", venue: northCreek, divisions, prices,
    dates: [{ iso: "2026-11-14", label: "Saturday, November 14, 2026" }],
    timeLabel: "10:00 AM–noon ET",
    scheduleConfirmed: true,
    scheduleNote: "The outdoor date, time and location are confirmed with MVF. The indoor weather backup is a separate, later time slot.",
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

/**
 * The next series event still ahead of `todayIso` (ET calendar date), or
 * undefined once the last one has passed. Fresh layout renders select the next
 * event; already-cached banners retire at Eastern midnight on the client.
 */
export function nextMvfJuniorSeriesEvent(todayIso: string): MvfJuniorSeriesEvent | undefined {
  return MVF_JUNIOR_SERIES.find((event) => event.dates[0].iso >= todayIso);
}

/** "Sat, Nov 14" from an event's first date, for tight surfaces like the banner. */
export function mvfJuniorSeriesShortDate(event: MvfJuniorSeriesEvent): string {
  const [y, m, d] = event.dates[0].iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}
