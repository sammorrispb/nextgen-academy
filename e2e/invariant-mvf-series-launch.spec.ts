import { test, expect } from "@playwright/test";
import { MVF_SERIES_RELEASES, activeSeriesRelease, releaseProblems, validateSeriesRegistration } from "../src/data/mvf-series-registration";
import { seriesDobBounds } from "../src/components/MvfSeriesRegistrationForm";
import { registration, syntheticRelease } from "./fixtures/mvf-series";

test("approved releases retain ten-day deadlines, seven-day invoices and closed admission", () => {
  expect(MVF_SERIES_RELEASES).toHaveLength(3);
  for (const [i, event] of ["november-2026", "january-2027", "february-2027"].entries()) {
    const release = MVF_SERIES_RELEASES.find(r => r.event === event)!;
    expect(releaseProblems(release)).toEqual([]);
    expect(release.date).toBe(["2026-11-14", "2027-01-17", "2027-02-14"][i]);
    expect(release.startTime).toBe("10:00 AM");
    expect(release.endTime).toBe(i === 0 ? "12:00 PM" : "1:00 PM");
    expect(release.registrationClosesAt).toBe(["2026-11-04T15:00:00Z", "2027-01-07T15:00:00Z", "2027-02-04T15:00:00Z"][i]);
    expect(release.invoiceDueDays).toBe(7);
    expect(release.ageCutoffDate).toBe(`${release.date.slice(0, 4)}-12-31`);
    expect(release.multipleBrackets).toBe(false);
    expect(activeSeriesRelease(event)).toBeUndefined();
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
