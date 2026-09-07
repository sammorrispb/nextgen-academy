import { test, expect } from "@playwright/test";
import {
  PICKLPARK_REGISTRATION_CLOSES,
  picklParkLeaguesOpen,
  picklParkRegistrationOpen,
} from "../src/lib/picklpark-registration-window";
import { openNowFlags } from "../src/lib/open-now-offers";
import { PICKLPARK_SATURDAYS } from "../src/data/picklpark-2026";

// Pure spec — no dev server.
//   npx playwright test e2e/picklpark-registration-window.spec.ts --project=desktop
//
// REPOSTURED 2026-09-07. This file used to pin the opposite contract: the Pickl
// Park season was OPEN by default and NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN
// was a kill switch. NGA no longer sells that season — The Pickl Park registers
// both leagues through podplay — so the gate split in two, and the split is the
// thing worth pinning:
//
//   picklParkRegistrationOpen  → is NGA taking money?     always false
//   picklParkLeaguesOpen       → is the Saturday running?  true through 10/24
//
// Collapsing them back into one boolean is the regression these guard. If they
// were one flag, retiring the checkout would ALSO have deleted the /fall
// cross-link, the /schedule callout and the open-now card — hiding two live
// leagues from the page our paying families land on.

const FLAG = "NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN";

test("closes on the season's own last Saturday, derived never typed", () => {
  expect(PICKLPARK_REGISTRATION_CLOSES).toBe(
    PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1],
  );
  expect(PICKLPARK_REGISTRATION_CLOSES).toBe("2026-10-24");
});

test("NGA's checkout is retired: no date and no flag value reopens it", () => {
  const prev = process.env[FLAG];
  try {
    for (const value of [undefined, "", "true", "TRUE", "1", "yes", "false"]) {
      for (const iso of ["2026-08-01", "2026-09-19", "2026-10-24", "2026-10-25"]) {
        expect(picklParkRegistrationOpen(iso, value), `${value} @ ${iso}`).toBe(
          false,
        );
      }
    }
    // And through the env-reading path the site actually uses.
    delete process.env[FLAG];
    expect(openNowFlags("2026-09-19").picklParkRegistrationOpen).toBe(false);
    process.env[FLAG] = "true";
    expect(openNowFlags("2026-09-19").picklParkRegistrationOpen).toBe(false);
  } finally {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  }
});

test("the leagues stay advertised through the last Saturday, then retire", () => {
  expect(picklParkLeaguesOpen("2026-09-07")).toBe(true);
  expect(picklParkLeaguesOpen(PICKLPARK_SATURDAYS[0])).toBe(true);
  expect(picklParkLeaguesOpen("2026-10-24")).toBe(true);
  expect(picklParkLeaguesOpen("2026-10-25")).toBe(false);
});

test("advertising the leagues does NOT depend on the retired sales flag", () => {
  const prev = process.env[FLAG];
  try {
    // The kill switch that used to close everything must no longer be able to
    // hide a league The Pickl Park is still selling.
    for (const value of ["false", "False", "off", "0"]) {
      process.env[FLAG] = value;
      expect(picklParkLeaguesOpen("2026-09-19"), value).toBe(true);
    }
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
