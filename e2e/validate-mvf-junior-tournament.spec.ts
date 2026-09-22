import { test, expect } from "@playwright/test";
import {
  validateMvfJuniorTournament,
  type MvfJuniorTournamentData,
} from "../src/lib/validate-mvf-junior-tournament";
import {
  LOW_ENROLLMENT_POLICY_TEXT,
  MVF_JUNIOR_TOURNAMENT_DIVISIONS,
  NONRESIDENT_PRICE_USD,
  RESIDENT_PRICE_USD,
  isDobEligibleForDivision,
  resolveTournamentPriceUsd,
  splitTournamentRevenueUsd,
} from "../src/data/mvf-junior-tournament-2026";

function validForm(
  overrides: Partial<MvfJuniorTournamentData> = {},
): MvfJuniorTournamentData {
  return {
    division: "10u",
    resident: true,
    parentName: "Jordan Parent",
    email: "jordan@example.com",
    phone: "301-555-0142",
    childFirstName: "Riley",
    childLastName: "Parent",
    childDob: "2017-03-15", // 9 on 2026-10-24 — 10U eligible
    emergencyName: "Sam Backup",
    emergencyPhone: "240-555-0199",
    allergies: "",
    smsConsent: false,
    ...overrides,
  };
}

test.describe("validateMvfJuniorTournament", () => {
  test("a fully valid form has no errors", () => {
    expect(validateMvfJuniorTournament(validForm())).toEqual({});
  });

  test("a valid 14U form has no errors", () => {
    expect(
      validateMvfJuniorTournament(
        validForm({ division: "14u", childDob: "2013-06-01", resident: false }),
      ),
    ).toEqual({});
  });

  test("each division slug is accepted", () => {
    for (const d of MVF_JUNIOR_TOURNAMENT_DIVISIONS) {
      const dob = d.division === "10u" ? "2017-03-15" : "2013-06-01";
      expect(
        validateMvfJuniorTournament(validForm({ division: d.division, childDob: dob })),
      ).toEqual({});
    }
  });

  test("unknown division is rejected", () => {
    expect(
      validateMvfJuniorTournament(validForm({ division: "18u" })).division,
    ).toBeTruthy();
  });

  test("non-boolean resident flag is rejected", () => {
    expect(
      validateMvfJuniorTournament(
        validForm({ resident: "yes" as unknown as boolean }),
      ).resident,
    ).toBeTruthy();
  });

  test("a 10U DOB that is too old is rejected", () => {
    expect(
      validateMvfJuniorTournament(validForm({ childDob: "2014-01-01" })).childDob,
    ).toBeTruthy();
  });

  test("a 14U DOB that is too young is rejected", () => {
    expect(
      validateMvfJuniorTournament(
        validForm({ division: "14u", childDob: "2017-03-15" }),
      ).childDob,
    ).toBeTruthy();
  });

  test("a 14U DOB that is too old is rejected", () => {
    expect(
      validateMvfJuniorTournament(
        validForm({ division: "14u", childDob: "2010-05-05" }),
      ).childDob,
    ).toBeTruthy();
  });

  test("malformed DOB is rejected", () => {
    expect(
      validateMvfJuniorTournament(validForm({ childDob: "03/15/2017" })).childDob,
    ).toBeTruthy();
  });

  test("child last name is required", () => {
    expect(
      validateMvfJuniorTournament(validForm({ childLastName: "" })).childLastName,
    ).toBeTruthy();
  });

  test("emergency contact name + phone are required", () => {
    const e = validateMvfJuniorTournament(
      validForm({ emergencyName: "", emergencyPhone: "" }),
    );
    expect(e.emergencyName).toBeTruthy();
    expect(e.emergencyPhone).toBeTruthy();
  });

  test("a too-short phone is rejected", () => {
    expect(validateMvfJuniorTournament(validForm({ phone: "12345" })).phone).toBeTruthy();
  });

  test("a bad email is rejected", () => {
    expect(
      validateMvfJuniorTournament(validForm({ email: "not-an-email" })).email,
    ).toBeTruthy();
  });
});

test.describe("isDobEligibleForDivision", () => {
  test("10U: age is taken as of 2026-10-24, not today", () => {
    // Born 2015-10-25 — turns 11 the day AFTER the tournament: 10U eligible.
    expect(isDobEligibleForDivision("10u", "2015-10-25")).toBe(true);
    // Born exactly 2015-10-24 — turns 11 ON tournament day: not 10U.
    expect(isDobEligibleForDivision("10u", "2015-10-24")).toBe(false);
    expect(isDobEligibleForDivision("10u", "2018-01-01")).toBe(true);
    expect(isDobEligibleForDivision("10u", "2014-12-31")).toBe(false);
  });

  test("14U: 11–14 as of 2026-10-24", () => {
    // Born 2015-10-24 — turns 11 on tournament day: 14U eligible.
    expect(isDobEligibleForDivision("14u", "2015-10-24")).toBe(true);
    // Born 2015-10-25 — still 10 on tournament day: not 14U.
    expect(isDobEligibleForDivision("14u", "2015-10-25")).toBe(false);
    // Born 2011-10-25 — turns 15 the day after: 14U eligible.
    expect(isDobEligibleForDivision("14u", "2011-10-25")).toBe(true);
    // Born 2011-10-24 — turns 15 on tournament day: not 14U.
    expect(isDobEligibleForDivision("14u", "2011-10-24")).toBe(false);
  });

  test("malformed DOB is never eligible", () => {
    expect(isDobEligibleForDivision("10u", "not-a-date")).toBe(false);
    expect(isDobEligibleForDivision("14u", "")).toBe(false);
  });
});

test.describe("tournament pricing and revenue split", () => {
  test("resident price is $50, non-resident $60 — resolved from the flag", () => {
    expect(RESIDENT_PRICE_USD).toBe(50);
    expect(NONRESIDENT_PRICE_USD).toBe(60);
    expect(resolveTournamentPriceUsd(true)).toBe(50);
    expect(resolveTournamentPriceUsd(false)).toBe(60);
  });

  test("the 80/20 split sums back to the entry fee", () => {
    for (const price of [50, 60]) {
      const { ngaShareUsd, mvfShareUsd } = splitTournamentRevenueUsd(price);
      expect(Number(ngaShareUsd) + Number(mvfShareUsd)).toBeCloseTo(price, 2);
    }
    expect(splitTournamentRevenueUsd(50)).toEqual({
      ngaShareUsd: "40.00",
      mvfShareUsd: "10.00",
    });
    expect(splitTournamentRevenueUsd(60)).toEqual({
      ngaShareUsd: "48.00",
      mvfShareUsd: "12.00",
    });
  });
});

test.describe("pending policy", () => {
  test("low-enrollment policy is still TBD — update this when Sam decides", () => {
    expect(LOW_ENROLLMENT_POLICY_TEXT).toBe("TBD");
  });
});
