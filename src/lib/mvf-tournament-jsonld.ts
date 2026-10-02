import { NORTH_CREEK } from "@/data/mvf";
import {
  GUARANTEED_GAMES_TEXT,
  MEDALS_TEXT,
  MVF_JUNIOR_TOURNAMENT_DATE_ISO,
  MVF_JUNIOR_TOURNAMENT_DIVISIONS,
  MVF_JUNIOR_TOURNAMENT_END_TIME,
  MVF_JUNIOR_TOURNAMENT_START_TIME,
  MVF_JUNIOR_TOURNAMENT_TITLE,
  MVF_JUNIOR_TOURNAMENT_VENUE,
  NONRESIDENT_PRICE_USD,
  RESIDENT_PRICE_USD,
} from "@/data/mvf-junior-tournament-2026";
import { orgRef, SITE_URL } from "@/lib/seo";
import { formatSessionDateTimeIso } from "@/lib/session-time";

/** Public event facts only; registration data does not feed this node. */
export function mvfTournamentJsonLd() {
  const url = `${SITE_URL}/mvf-junior-tournament`;
  const divisions = MVF_JUNIOR_TOURNAMENT_DIVISIONS.map(
    (division) => `${division.label} (${division.ageLabel})`,
  ).join(" and ");

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": `${url}#event`,
    name: MVF_JUNIOR_TOURNAMENT_TITLE,
    url,
    sport: "Pickleball",
    description: `A one-day junior pickleball tournament with ${divisions} divisions. Rotating partner round robin. ${GUARANTEED_GAMES_TEXT} ${MEDALS_TEXT}`,
    startDate: formatSessionDateTimeIso(
      MVF_JUNIOR_TOURNAMENT_DATE_ISO,
      MVF_JUNIOR_TOURNAMENT_START_TIME,
    ),
    endDate: formatSessionDateTimeIso(
      MVF_JUNIOR_TOURNAMENT_DATE_ISO,
      MVF_JUNIOR_TOURNAMENT_END_TIME,
    ),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: MVF_JUNIOR_TOURNAMENT_VENUE,
      address: {
        "@type": "PostalAddress",
        streetAddress: NORTH_CREEK.streetAddress,
        addressLocality: NORTH_CREEK.locality,
        addressRegion: NORTH_CREEK.region,
        postalCode: NORTH_CREEK.postalCode,
        addressCountry: "US",
      },
    },
    organizer: orgRef(),
    image: [`${SITE_URL}/images/og-image.png`],
    // Residency determines price. Inventory and registration opening dates
    // are not verified by these static public facts, so neither is asserted.
    offers: [
      {
        "@type": "Offer",
        name: "Montgomery Village resident entry",
        price: RESIDENT_PRICE_USD,
        priceCurrency: "USD",
        url: `${url}#register`,
      },
      {
        "@type": "Offer",
        name: "Non-resident entry",
        price: NONRESIDENT_PRICE_USD,
        priceCurrency: "USD",
        url: `${url}#register`,
      },
    ],
  };
}
