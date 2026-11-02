import { test, expect } from "@playwright/test";
import { MVF_SERIES_ACTIVE_REVISIONS, MVF_SERIES_RELEASES, activeSeriesRelease, findSeriesRelease, publicSeriesRelease, releaseProblems, validateSeriesRegistration } from "../src/data/mvf-series-registration";
import { seriesDobBounds } from "../src/components/MvfSeriesRegistrationForm";
import { registration, syntheticRelease } from "./fixtures/mvf-series";

test("admission is open on the approved revisions, with November extended to Nov 13 10 AM ET and one-day invoices", () => {
  expect(MVF_SERIES_ACTIVE_REVISIONS).toEqual({ "november-2026": "launch-2026-11-02", "january-2027": "launch-2026-10-31", "february-2027": "launch-2026-10-31" });
  const november = activeSeriesRelease("november-2026")!;
  expect(november.revision).toBe("launch-2026-11-02");
  expect(november.registrationClosesAt).toBe("2026-11-13T15:00:00Z");
  expect(november.invoiceDueDays).toBe(1);
  expect(releaseProblems(november)).toEqual([]);
  // Payment is due no later than the 10:00 AM ET start (15:00Z on Nov 14).
  expect(Date.parse(november.registrationClosesAt) + november.invoiceDueDays * 86400000).toBeLessThanOrEqual(Date.parse("2026-11-14T15:00:00Z"));
  // Anything later is refused by the release guard.
  expect(releaseProblems({ ...november, registrationClosesAt: "2026-11-13T15:00:01Z" })).toContain("invoice payment window before event");
  expect(releaseProblems({ ...november, invoiceDueDays: 2 })).toContain("invoice payment window before event");
  // Every other November term is unchanged from the confirmed release.
  const changed = { revision: november.revision, registrationClosesAt: november.registrationClosesAt, invoiceDueDays: november.invoiceDueDays };
  expect({ ...findSeriesRelease("november-2026", "launch-2026-10-31")!, ...changed }).toEqual(november);
  for (const event of ["january-2027", "february-2027"]) {
    expect(activeSeriesRelease(event)!.revision).toBe("launch-2026-10-31");
    expect(activeSeriesRelease(event)!.invoiceDueDays).toBe(7);
  }
});

test("public registration ends exactly at each deadline", () => {
  for (const event of ["november-2026", "january-2027", "february-2027"]) {
    const closes = Date.parse(activeSeriesRelease(event)!.registrationClosesAt);
    expect(publicSeriesRelease(event, closes - 1)?.event).toBe(event);
    expect(publicSeriesRelease(event, closes)).toBeUndefined();
  }
});

test("confirmed releases retain deadlines and complete policies", () => {
  expect(MVF_SERIES_RELEASES).toHaveLength(4);
  for (const [i, event] of ["november-2026", "january-2027", "february-2027"].entries()) {
    const release = findSeriesRelease(event, "launch-2026-10-31")!;
    expect(releaseProblems(release)).toEqual([]);
    if (i > 0) expect(release.rainPolicy).toMatch(/3:30–6:30 PM ET at Lake Marion Community Center/);
    expect(release.date).toBe(["2026-11-14", "2027-01-17", "2027-02-14"][i]);
    expect(release.startTime).toBe("10:00 AM");
    expect(release.endTime).toBe(i === 0 ? "12:00 PM" : "1:00 PM");
    expect(release.registrationClosesAt).toBe(["2026-11-04T15:00:00Z", "2027-01-07T15:00:00Z", "2027-02-04T15:00:00Z"][i]);
    expect(release.invoiceDueDays).toBe(7);
    expect(release.ageCutoffDate).toBe(`${release.date.slice(0, 4)}-12-31`);
    expect(release.multipleBrackets).toBe(false);
    expect(release.minimumEnrollmentPolicy).toMatch(/8 players.*5 players.*3 days/);
    expect(release.cancellationPolicy).toBe("No refunds unless we cancel.");
    expect(release.rainPolicy).toMatch(/24 hours/);
  }
});

test("calendar-year age and the DOB picker agree at every junior boundary, including play-up", () => {
  const release = { ...syntheticRelease(), ageCutoffDate: "2027-12-31", eligibility: { "12u": { minAge: 6, maxAge: 12 }, "16u": { minAge: 6, maxAge: 16 } } };
  for (const division of ["12u", "16u"] as const) {
    const expectedMin = division === "12u" ? "2015-01-01" : "2011-01-01";
    expect(seriesDobBounds(release, division)).toEqual({ min: expectedMin, max: "2021-12-31" });
    for (const childDob of [expectedMin, "2021-12-31", "2020-02-29"]) {
      expect(validateSeriesRegistration(registration(1, { division, childDob }), release)).not.toHaveProperty("childDob");
    }
    for (const childDob of [division === "12u" ? "2014-12-31" : "2010-12-31", "2022-01-01", "2021-02-29"]) {
      expect(validateSeriesRegistration(registration(1, { division, childDob }), release)).toHaveProperty("childDob");
    }
  }
  expect(releaseProblems({ ...release, ageCutoffDate: "2027-02-30" })).toContain("age cutoff date");
  expect(releaseProblems({ ...release, ngaRevenueBaseUsd: 60 })).toContain("confirmed revenue base");
});

test("historical release fixtures without a cutoff retain their original event-date eligibility", () => {
  const release = syntheticRelease();
  expect(validateSeriesRegistration(registration(1, { childDob: "2014-12-31" }), release)).not.toHaveProperty("childDob");
  expect(seriesDobBounds(release, "12u")).toEqual({ min: "2014-02-21", max: "2021-02-20" });
});
