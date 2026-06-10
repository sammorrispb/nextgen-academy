import type { NgaSession } from "@/lib/notion-sessions";
import { formatSessionDateTimeIso } from "@/lib/session-time";
import { inferCity } from "@/lib/venue-lookup";

/**
 * Schema.org SportsEvent for one drop-in session — shared by the home page and
 * /schedule so both stay in lockstep with the "one SportsEvent per upcoming
 * session" convention. Address city is inferred from the location string when
 * recognized; falls back to "Montgomery County" otherwise.
 */
export function sportsEventJsonLd(session: NgaSession) {
  const city = inferCity(session.location) ?? "Montgomery County";
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name:
      session.title ||
      `NGA Drop-in${session.level ? ` (${session.level} Ball)` : ""}`,
    startDate: session.startTime
      ? formatSessionDateTimeIso(session.date, session.startTime) ?? session.date
      : session.date,
    ...(session.endTime
      ? {
          endDate:
            formatSessionDateTimeIso(session.date, session.endTime) ??
            session.date,
        }
      : {}),
    eventStatus:
      session.status === "Cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: session.location,
      address: {
        "@type": "PostalAddress",
        addressLocality: city,
        addressRegion: "MD",
        addressCountry: "US",
      },
    },
    organizer: {
      "@type": "SportsOrganization",
      name: "Next Gen Pickleball Academy",
      url: "https://nextgenpbacademy.com",
    },
    offers: {
      "@type": "Offer",
      price: "20",
      priceCurrency: "USD",
      availability:
        session.spotsLeft > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      url: "https://nextgenpbacademy.com/schedule",
    },
  };
}
