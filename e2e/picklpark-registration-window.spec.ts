import { test, expect } from "@playwright/test";
import {
  PICKLPARK_REGISTRATION_CLOSES,
  picklParkRegistrationOpen,
} from "../src/lib/picklpark-registration-window";
import { openNowFlags } from "../src/lib/open-now-offers";
import { PICKLPARK_SATURDAYS } from "../src/data/picklpark-2026";

// Pure spec — no dev server.
//   npx playwright test e2e/picklpark-registration-window.spec.ts --project=desktop
//
// Registration for the Pickl Park season is OPEN BY DEFAULT (Sam, 2026-09-05)
// and NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN is a kill switch, not a launch
// flag — the opposite posture from /fall, whose flag still ships dark. These
// pin the boundary so a later "make it match fall" change has to be deliberate.

const FLAG = "NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN";

test("closes on the season's own last Saturday, derived never typed", () => {
  expect(PICKLPARK_REGISTRATION_CLOSES).toBe(
    PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1],
  );
  expect(PICKLPARK_REGISTRATION_CLOSES).toBe("2026-10-24");
});

test("unset flag → open today, open on the last Saturday, closed the day after", () => {
  expect(picklParkRegistrationOpen("2026-09-05", undefined)).toBe(true);
  expect(picklParkRegistrationOpen(PICKLPARK_SATURDAYS[0], undefined)).toBe(
    true,
  );
  expect(picklParkRegistrationOpen("2026-10-24", undefined)).toBe(true);
  expect(picklParkRegistrationOpen("2026-10-25", undefined)).toBe(false);
});

test("an empty value is the same as unset", () => {
  expect(picklParkRegistrationOpen("2026-09-05", "")).toBe(true);
  expect(picklParkRegistrationOpen("2026-09-05", "  ")).toBe(true);
});

test('"true" is accepted for backwards compatibility and cannot sell a finished season', () => {
  expect(picklParkRegistrationOpen("2026-09-05", "true")).toBe(true);
  expect(picklParkRegistrationOpen("2026-09-05", "TRUE")).toBe(true);
  expect(picklParkRegistrationOpen("2026-10-25", "true")).toBe(false);
});

test("any other value is the kill switch — closed even mid-window", () => {
  // Fail CLOSED on a typo: an operator reaching for this env var is trying to
  // stop sales, so "False", "no", "0" and "off" must all stop them.
  for (const value of ["false", "False", "FALSE", "no", "0", "off", "closed"]) {
    expect(picklParkRegistrationOpen("2026-09-05", value), value).toBe(false);
    expect(picklParkRegistrationOpen("2026-10-03", value), value).toBe(false);
  }
});

test("openNowFlags reads the same gate for the empty-state offer card", () => {
  const prev = process.env[FLAG];
  try {
    delete process.env[FLAG];
    expect(openNowFlags("2026-09-05").picklParkRegistrationOpen).toBe(true);
    expect(openNowFlags("2026-10-25").picklParkRegistrationOpen).toBe(false);
    process.env[FLAG] = "false";
    expect(openNowFlags("2026-09-05").picklParkRegistrationOpen).toBe(false);
  } finally {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  }
});

test("the fall flag keeps its ships-dark posture — unset means closed", () => {
  const prev = process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN;
  try {
    delete process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN;
    expect(openNowFlags("2026-09-05").fallRegistrationOpen).toBe(false);
    process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN = "true";
    expect(openNowFlags("2026-09-05").fallRegistrationOpen).toBe(true);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN;
    else process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN = prev;
  }
});
