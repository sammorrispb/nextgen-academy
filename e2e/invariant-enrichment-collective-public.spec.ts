import { test, expect } from "@playwright/test";
import {
  EC_CLUBS,
  EC_PARTNER_URL,
  ecClubPublicVenue,
  ecPublicClubs,
  ecRemainingDates,
  isEcClubPublic,
  type EcClub,
} from "../src/data/enrichment-collective";

// THE Enrichment Collective public-surface invariant.
//
// Sam moved this program onto a public page on 2026-09-19 (see the header of
// src/data/enrichment-collective.ts). The premise is that the PARTNER already
// publishes a per-club registration page, so linking it republishes nothing.
// That reasoning covers the weekday, the school name, the dates and the link.
// It does NOT cover the street address, and it never covers a roster.
//
// This spec is the boundary. It asserts on what a public render may carry, so
// the next person to widen it has to argue with a red test rather than a
// comment.

const TODAY = "2026-09-19";

test.describe("Enrichment Collective — public surface", () => {
  test("the street address never leaves the data file", () => {
    // exactLocation is the one field that stays calendar-only. Same class of
    // data as camps.ts exactLocation: a school name is a searchable
    // institution, a street address is a doorstep.
    for (const club of EC_CLUBS) {
      if (!club.exactLocation) continue;
      const publicVenue = ecClubPublicVenue(club);
      expect(publicVenue).not.toContain(club.exactLocation);
      // The street number is the part that must not survive.
      const streetNumber = club.exactLocation.match(/\b\d{3,5}\b/)?.[0];
      if (streetNumber) expect(publicVenue).not.toContain(streetNumber);
    }
  });

  test("the public venue names the school and its town, and nothing else", () => {
    for (const club of EC_CLUBS) {
      const publicVenue = ecClubPublicVenue(club);
      if (club.schoolName) expect(publicVenue).toContain(club.schoolName);
      expect(publicVenue).toContain(club.town);
    }
  });

  test("a hold is never advertised as registrable", () => {
    // status: "hold" is an internal maybe. Publishing one invites a parent to
    // register for something that may not run.
    //
    // Asserted against a SYNTHETIC hold rather than the live data: every club
    // is confirmed today, so a spec that only loops EC_CLUBS passes whether or
    // not the filter actually checks status. It did exactly that, and the
    // mutation check caught it.
    const base = EC_CLUBS[0];
    const futureDate = "2099-06-01";
    const held: EcClub = {
      ...base,
      key: "synthetic-hold",
      status: "hold",
      dates: [futureDate],
    };
    const confirmed: EcClub = { ...held, key: "synthetic-confirmed", status: "confirmed" };

    expect(isEcClubPublic(held, TODAY)).toBe(false);
    expect(isEcClubPublic(confirmed, TODAY)).toBe(true);

    for (const club of ecPublicClubs(TODAY)) {
      expect(club.status).toBe("confirmed");
    }
  });

  test("a finished club drops off the public page", () => {
    // Every club whose sessions have all passed must stop rendering, so the
    // page can never advertise a season a parent cannot join.
    const farFuture = "2099-01-01";
    expect(ecPublicClubs(farFuture)).toHaveLength(0);

    for (const club of ecPublicClubs(TODAY)) {
      expect(ecRemainingDates(club, TODAY).length).toBeGreaterThan(0);
    }
  });

  test("every registration link points at the partner, over https", () => {
    // A club link is the one outbound CTA on the page. It must resolve to
    // Enrichment Collective and nowhere else — never an NGA checkout (EC owns
    // registration, payment, insurance and the releases).
    const partnerHost = new URL(EC_PARTNER_URL).host;
    expect(EC_CLUBS.length).toBeGreaterThan(0);

    for (const club of EC_CLUBS) {
      const url = new URL(club.registrationUrl);
      expect(url.protocol).toBe("https:");
      expect(url.host).toBe(partnerHost);
    }
  });

  test("the data file holds no child, parent or roster field", () => {
    // EC owns enrolment, so NGA never holds these names. The strongest form of
    // "hide the roster" is not having one — this pins that it stays that way.
    const forbidden = [
      "roster",
      "childName",
      "childFirst",
      "parentEmail",
      "parentName",
      "parentPhone",
      "birthYear",
      "allergies",
      "emergencyContact",
    ];
    const json = JSON.stringify(EC_CLUBS);
    for (const key of forbidden) {
      expect(json).not.toContain(key);
    }
  });
});
