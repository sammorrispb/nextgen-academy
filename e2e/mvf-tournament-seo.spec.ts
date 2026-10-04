import { test, expect } from "@playwright/test";
import { mvfTournamentJsonLd } from "../src/lib/mvf-tournament-jsonld";
import { ORG_ID } from "../src/lib/seo";
import {
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_TITLE,
} from "../src/data/mvf-junior-tournament-2026";

const URL = "https://nextgenpbacademy.com/mvf-junior-tournament";

test.describe("public MVF tournament discovery", () => {
  test("identifies one public pickleball tournament on its canonical page", () => {
    const event = mvfTournamentJsonLd();
    expect(event["@context"]).toBe("https://schema.org");
    expect(event["@type"]).toBe("SportsEvent");
    expect(event["@id"]).toBe(`${URL}#event`);
    expect(event.url).toBe(URL);
    expect(event.name).toBe(MVF_JUNIOR_TOURNAMENT_TITLE);
    expect(event.sport).toBe("Pickleball");
    expect(event.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(event.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
  });

  test("publishes October 24, 4–7 PM Eastern even on a UTC build server", () => {
    const event = mvfTournamentJsonLd();
    expect(event.startDate).toBe("2026-10-24T16:00:00-04:00");
    expect(event.endDate).toBe("2026-10-24T19:00:00-04:00");
    expect(Date.parse(event.endDate!) - Date.parse(event.startDate!)).toBe(3 * 60 * 60 * 1000);
    expect(MVF_JUNIOR_TOURNAMENT_TIME_LABEL).toBe("4:00–7:00 PM");
  });

  test("locates North Creek in Montgomery Village with the full public address", () => {
    expect(mvfTournamentJsonLd().location).toEqual({
      "@type": "Place",
      name: "North Creek Community Center",
      address: {
        "@type": "PostalAddress",
        streetAddress: "20125 Arrowhead Road",
        addressLocality: "Montgomery Village",
        addressRegion: "MD",
        postalCode: "20886",
        addressCountry: "US",
      },
    });
  });

  test("names resident eligibility instead of quoting the lower price to everyone", () => {
    expect(mvfTournamentJsonLd().offers).toEqual([
      {
        "@type": "Offer",
        name: "Montgomery Village resident entry",
        price: 50,
        priceCurrency: "USD",
        url: `${URL}#register`,
      },
      {
        "@type": "Offer",
        name: "Non-resident entry",
        price: 60,
        priceCurrency: "USD",
        url: `${URL}#register`,
      },
    ]);
  });

  test("describes the public divisions and references NGA's existing organization", () => {
    const event = mvfTournamentJsonLd();
    expect(event.description).toContain("10U (Ages 6–10)");
    expect(event.description).toContain("14U (Ages 11–14)");
    expect(event.description).toContain("Minimum 4 guaranteed games.");
    expect(event.description).toContain("Medals for the winners of each division.");
    expect(event.organizer["@id"]).toBe(ORG_ID);
    expect(event.organizer.name).toBe("Next Gen Pickleball Academy");
    expect(event.image).toEqual(["https://nextgenpbacademy.com/images/og-image.png"]);
  });

  test("emits static program facts without inventing live inventory or sale dates", () => {
    const event = mvfTournamentJsonLd();
    const json = JSON.stringify(event);
    expect(JSON.parse(json)).toEqual(event);
    for (const field of ["availability", "validFrom", "remainingAttendeeCapacity", "attendee", "roster", "childDob", "allergies"]) {
      expect(json).not.toContain(`"${field}"`);
    }
  });
});
