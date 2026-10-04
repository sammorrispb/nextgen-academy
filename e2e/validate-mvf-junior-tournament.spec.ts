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

test.describe("low-enrollment policy", () => {
  test("merge policy is the decided text — change only if Sam revises it", () => {
    expect(LOW_ENROLLMENT_POLICY_TEXT).toBe(
      "If either division doesn't reach the 6-player minimum, both divisions will be merged into a single division."
    );
  });
});

// A real calendar DOB must fit the selected division on the event day.
// These synthetic boundaries also exercise the validator called by checkout.
test.describe("event-day DOB eligibility boundaries", () => {
  const cases = [
    ["10u", "2015-10-24", false],
    ["10u", "2015-10-25", true],
    ["10u", "2020-10-24", true],
    ["10u", "2020-10-25", false],
    ["14u", "2011-10-24", false],
    ["14u", "2011-10-25", true],
    ["14u", "2015-10-24", true],
    ["14u", "2015-10-25", false],
    ["10u", "2020-02-29", true],
    ["14u", "2012-02-29", true],
    ["10u", "2019-02-29", false],
    ["14u", "2013-02-29", false],
    ["10u", "2020-02-30", false],
    ["14u", "2012-02-30", false],
    ["10u", "2017-04-31", false],
    ["14u", "2013-04-31", false],
    ["10u", "2018-00-15", false],
    ["14u", "2013-13-01", false],
    ["10u", "2018-01-00", false],
    ["14u", "2013-01-32", false],
    ["10u", "2026-10-24", false],
    ["10u", "2026-10-25", false],
    ["10u", "2027-01-01", false],
    ["14u", "2027-01-01", false],
    ["10u", "", false],
    ["14u", "not-a-date", false],
    ["10u", "2020-2-29", false],
    ["14u", "2012-02-29T00:00:00Z", false],
  ] as const;

  for (const [division, dob, eligible] of cases) {
    test(`${division} DOB ${dob || "empty"} is ${eligible ? "eligible" : "rejected"}`, () => {
      expect(isDobEligibleForDivision(division, dob)).toBe(eligible);
      const errors = validateMvfJuniorTournament(validForm({ division, childDob: dob }));
      if (eligible) expect(errors).toEqual({});
      else expect(errors.childDob).toBeTruthy();
    });
  }

  for (const division of ["18u", "", "10U"]) {
    test(`unrecognized division ${division || "empty"} fails closed`, () => {
      expect(isDobEligibleForDivision(division as "10u", "2013-06-01")).toBe(false);
      expect(validateMvfJuniorTournament(validForm({ division, childDob: "2013-06-01" })).division).toBeTruthy();
    });
  }

  for (const dob of [null, 42, { date: "2017-03-15" }]) {
    test(`non-string DOB ${JSON.stringify(dob)} is rejected without throwing`, () => {
      expect(isDobEligibleForDivision("10u", dob as unknown as string)).toBe(false);
      expect(validateMvfJuniorTournament(validForm({ childDob: dob as unknown as string })).childDob).toBeTruthy();
    });
  }

  test("a missing DOB is required even with a valid division", () => {
    expect(validateMvfJuniorTournament({ ...validForm(), childDob: undefined }).childDob).toBeTruthy();
  });

  test("10U rejection explains the approved minimum and event-day age", () => {
    expect(validateMvfJuniorTournament(validForm({ childDob: "2020-10-25" })).childDob)
      .toBe("10U is for players ages 6–10 as of October 24, 2026");
  });

  test("public 10U guidance names the same age range", () => {
    const division = MVF_JUNIOR_TOURNAMENT_DIVISIONS.find((d) => d.division === "10u")!;
    expect(division.ageLabel).toBe("Ages 6–10");
    expect(division.blurb).toContain("ages 6–10 as of October 24, 2026");
  });
});
