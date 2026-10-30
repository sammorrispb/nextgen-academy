import type { SeriesRelease } from "@/data/mvf-series-registration";
import { findMvfJuniorSeriesEvent, mvfJuniorSeriesUrl } from "@/data/mvf-junior-series";
import { formatSessionDateTimeIso } from "./session-time";
import { orgRef } from "./seo";

export function mvfSeriesJsonLd(release: SeriesRelease) {
  const event = findMvfJuniorSeriesEvent(release.event);
  if (!event) throw new Error("Unknown tournament");
  const url = mvfJuniorSeriesUrl(event);
  return {
    "@context": "https://schema.org", "@type": "SportsEvent", "@id": `${url}#event`, url,
    name: `MVF Junior Tournament — ${event.monthLabel}`, sport: "Pickleball",
    startDate: formatSessionDateTimeIso(release.date, release.startTime), endDate: formatSessionDateTimeIso(release.date, release.endTime),
    eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: orgRef(), location: { "@type": "Place", name: event.venue.name, address: event.venue.address },
    offers: [
      { "@type": "Offer", name: "Montgomery Village resident entry", price: event.prices.residentUsd, priceCurrency: "USD", url: `${url}#register` },
      { "@type": "Offer", name: "Nonresident entry", price: event.prices.nonresidentUsd, priceCurrency: "USD", url: `${url}#register` },
    ],
  };
}
