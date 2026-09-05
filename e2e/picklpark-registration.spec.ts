import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  validatePicklParkRegistration,
  isDuplicatePicklParkRegistration,
  type PicklParkRegistrationData,
} from "../src/lib/validate-picklpark-registration";
import { buildPicklParkSeasonConfirmationEmail } from "../src/lib/email/picklpark-season-confirmation";
import {
  PICKLPARK_SEASON_GROUPS,
  PICKLPARK_SEASON_PRICE_USD,
  PICKLPARK_SEASON_PRICE_ENV_VAR,
  picklParkSeasonSlotsFor,
} from "../src/data/picklpark-season-2026";
import {
  PICKLPARK_INDOOR_NOTE,
  PICKLPARK_MAKEUP_DATES,
  PICKLPARK_OPEN_COURT_END_TIME,
  PICKLPARK_OPEN_COURT_START_TIME,
  PICKLPARK_SATURDAYS,
  PICKLPARK_PICKLEBALL_COURTS,
  PICKLPARK_PLAYERS_PER_COURT,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_SESSION_FORMAT,
  PICKLPARK_SLOTS_BY_GROUP,
  PICKLPARK_START_TIME,
  PICKLPARK_VENUE,
  PICKLPARK_YOUTH_BLOCKS,
} from "../src/data/picklpark-2026";
import { PLAYERS_PER_PICKLEBALL_COURT } from "../src/data/venue-parking";

// Pure-function + route specs — no dev server. Run with:
//   npx playwright test e2e/picklpark-registration.spec.ts --project=desktop

const PICKLPARK_DB = "picklpark-regs-db-test";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_PICKLPARK_REGS_DB_ID = PICKLPARK_DB;
process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";

import { POST as CHECKOUT_POST } from "../src/app/api/checkout-picklpark/route";

function validForm(): PicklParkRegistrationData {
  return {
    group: "Red/Orange",
    parentName: "Test Parent",
    email: "parent@example.com",
    phone: "301-555-0142",
    childFirstName: "Testkid",
    childBirthYear: String(new Date().getFullYear() - 10),
    emergencyName: "Emergency Person",
    emergencyPhone: "301-555-0143",
    allergies: "",
    smsConsent: false,
  };
}

function checkoutReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/checkout-picklpark", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

/** A Confirmed roster row for the capacity/duplicate queries. */
function confirmedRow(childFirstName: string, parentEmail: string) {
  return {
    id: `row-${childFirstName}`,
    properties: {
      "Child First Name": { rich_text: [{ plain_text: childFirstName }] },
      "Parent Email": { email: parentEmail },
    },
  };
}

test.describe("picklpark season product data stays consistent", () => {
  test("price matches the Montgomery County season at $225", () => {
    expect(PICKLPARK_SEASON_PRICE_USD).toBe(225);
  });

  test("seat caps are DERIVED per band from the court booking", () => {
    for (const band of PICKLPARK_YOUTH_BLOCKS.map((b) => b.level)) {
      expect(picklParkSeasonSlotsFor(band)).toBe(
        PICKLPARK_SLOTS_BY_GROUP[band],
      );
      expect(PICKLPARK_SLOTS_BY_GROUP[band]).toBe(
        PICKLPARK_PICKLEBALL_COURTS * PICKLPARK_PLAYERS_PER_COURT[band],
      );
    }
  });

  test("the site-wide per-court cap is the default, and is NOT the dial", () => {
    // Raising a band means editing PICKLPARK_PLAYERS_PER_COURT, never the
    // site-wide constant that also sizes every drop-in.
    expect(PLAYERS_PER_PICKLEBALL_COURT).toBe(4);
    for (const band of PICKLPARK_YOUTH_BLOCKS.map((b) => b.level)) {
      expect(PICKLPARK_PLAYERS_PER_COURT[band]).toBe(
        PLAYERS_PER_PICKLEBALL_COURT,
      );
    }
  });

  test("groups are the two bands, with canonical ball-color words", () => {
    expect(PICKLPARK_SEASON_GROUPS.map((g) => g.group)).toEqual(
      PICKLPARK_YOUTH_BLOCKS.map((b) => b.level),
    );
    expect(PICKLPARK_SEASON_GROUPS.map((g) => g.label)).toEqual([
      "Red & Orange Ball",
      "Green & Yellow Ball",
    ]);
    expect(PICKLPARK_SEASON_GROUPS.map((g) => g.timeLabel)).toEqual([
      "3:00–4:00 PM",
      "4:00–5:00 PM",
    ]);
  });

  test("the season runs 3–5 PM, after the 2 PM Open Court hour", () => {
    // Open Court hands straight off into the season — that adjacency is the
    // whole conversion argument for running it first, so pin that it holds.
    expect(PICKLPARK_OPEN_COURT_START_TIME).toBe("2:00 PM");
    expect(PICKLPARK_OPEN_COURT_END_TIME).toBe(PICKLPARK_START_TIME);
    expect(PICKLPARK_START_TIME).toBe("3:00 PM");
    expect(PICKLPARK_YOUTH_BLOCKS[0].startTime).toBe(PICKLPARK_START_TIME);
  });

  test("six Saturdays Sep 19 – Oct 24, all actually Saturdays, makeup Oct 31", () => {
    // Moved up two weeks 2026-09-05 (Sam) from Oct 3 – Nov 7. The first
    // Saturday sits one week after the first Open Court (Sep 12), so exactly
    // one on-ramp hour runs before the season starts.
    expect(PICKLPARK_SATURDAYS).toHaveLength(6);
    expect(PICKLPARK_SATURDAYS[0]).toBe("2026-09-19");
    expect(PICKLPARK_SATURDAYS[5]).toBe("2026-10-24");
    expect(PICKLPARK_MAKEUP_DATES).toEqual(["2026-10-31"]);
    expect(PICKLPARK_SEASON_LABEL).toBe("September 19 – October 24, 2026");
    for (const iso of [...PICKLPARK_SATURDAYS, ...PICKLPARK_MAKEUP_DATES]) {
      // UTC-noon parse is deliberate — date-only strings must never go
      // through a local-midnight Date on a UTC build server.
      expect(new Date(`${iso}T12:00:00Z`).getUTCDay(), iso).toBe(6);
    }
  });
});

test.describe("validatePicklParkRegistration", () => {
  test("accepts a complete registration", () => {
    expect(validatePicklParkRegistration(validForm())).toEqual({});
  });

  test("requires a real group", () => {
    expect(
      validatePicklParkRegistration({ ...validForm(), group: "" }).group,
    ).toBeTruthy();
    expect(
      validatePicklParkRegistration({ ...validForm(), group: "Red" }).group,
    ).toBeTruthy();
  });

  test("rejects out-of-range birth years (season is ages 6–16)", () => {
    const thisYear = new Date().getFullYear();
    for (const bad of [
      String(thisYear - 3),
      String(thisYear - 20),
      "not-a-year",
    ]) {
      expect(
        validatePicklParkRegistration({ ...validForm(), childBirthYear: bad })
          .childBirthYear,
      ).toBeTruthy();
    }
    expect(
      validatePicklParkRegistration({
        ...validForm(),
        childBirthYear: String(thisYear - 6),
      }).childBirthYear,
    ).toBeUndefined();
  });

  test("requires parent contact + emergency contact", () => {
    const errors = validatePicklParkRegistration({
      ...validForm(),
      parentName: "",
      email: "bad-email",
      phone: "123",
      emergencyName: "",
      emergencyPhone: "456",
    });
    expect(errors.parentName).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.phone).toBeTruthy();
    expect(errors.emergencyName).toBeTruthy();
    expect(errors.emergencyPhone).toBeTruthy();
  });
});

test.describe("isDuplicatePicklParkRegistration", () => {
  const keys = [
    { parentEmail: "Parent@Example.com", childFirstName: "Ava" },
    { parentEmail: "other@example.com", childFirstName: "Max" },
  ];

  test("same parent + same kid is a duplicate (case-insensitive)", () => {
    expect(
      isDuplicatePicklParkRegistration(keys, "parent@example.com", "ava"),
    ).toBe(true);
  });

  test("a sibling or a different family passes", () => {
    expect(
      isDuplicatePicklParkRegistration(keys, "parent@example.com", "Max"),
    ).toBe(false);
    expect(
      isDuplicatePicklParkRegistration(keys, "new@example.com", "Ava"),
    ).toBe(false);
  });
});

test.describe("POST /api/checkout-picklpark (route, pure node)", () => {
  const stub = new FetchStub();
  test.beforeEach(() => stub.reset());
  test.afterEach(() => {
    stub.uninstall();
    delete process.env[PICKLPARK_SEASON_PRICE_ENV_VAR];
  });

  test("ships DARK: 503 while the Stripe price env is unset, nothing egresses", async () => {
    delete process.env[PICKLPARK_SEASON_PRICE_ENV_VAR];
    stub.install();

    const res = await CHECKOUT_POST(checkoutReq(validForm()));
    expect(res.status).toBe(503);
    expect(stub.calls).toHaveLength(0);
  });

  test("invalid body → 400 with field errors, no egress", async () => {
    stub.install();
    const res = await CHECKOUT_POST(
      checkoutReq({ ...validForm(), email: "nope", group: "Purple" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors.group).toBeTruthy();
    expect(json.errors.email).toBeTruthy();
    expect(stub.calls).toHaveLength(0);
  });

  test("a full band → 409 sold_out before Stripe", async () => {
    process.env[PICKLPARK_SEASON_PRICE_ENV_VAR] = "price_picklpark_test";
    stub
      .on(`databases/${PICKLPARK_DB}/query`, {
        results: Array.from(
          { length: picklParkSeasonSlotsFor("Red/Orange") },
          (_, i) => confirmedRow(`Kid${i}`, `family${i}@example.com`),
        ),
      })
      .install();

    const res = await CHECKOUT_POST(checkoutReq(validForm()));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("sold_out");
    for (const call of stub.calls) {
      expect(call.url).not.toContain("stripe");
    }
  });

  test("same kid, same group → 409 duplicate_registration before Stripe", async () => {
    process.env[PICKLPARK_SEASON_PRICE_ENV_VAR] = "price_picklpark_test";
    stub
      .on(`databases/${PICKLPARK_DB}/query`, {
        results: [confirmedRow("Testkid", "parent@example.com")],
      })
      .install();

    const res = await CHECKOUT_POST(checkoutReq(validForm()));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("duplicate_registration");
    for (const call of stub.calls) {
      expect(call.url).not.toContain("stripe");
    }
  });
});

test.describe("picklpark season confirmation email", () => {
  function build() {
    return buildPicklParkSeasonConfirmationEmail({
      parentFirst: "Jordan",
      childFirst: "Ava",
      groupLabel: "Red & Orange Ball",
      timeLabel: "3:00–4:00 PM",
      amountUsd: "225.00",
      venue: PICKLPARK_VENUE,
      saturdays: PICKLPARK_SATURDAYS,
      makeupDates: PICKLPARK_MAKEUP_DATES,
    });
  }

  test("carries the group, every Saturday, the venue, and the makeup date", () => {
    const { subject, text } = build();
    expect(subject).toContain("Red & Orange Ball");
    expect(text).toContain("Saturdays 3:00–4:00 PM");
    expect(text).toContain("Saturday, September 19");
    expect(text).toContain("Saturday, October 24");
    for (const iso of PICKLPARK_SATURDAYS) {
      const day = Number(iso.split("-")[2]);
      expect(text).toContain(` ${day}`);
    }
    expect(text).toContain(PICKLPARK_VENUE);
    expect(text).toContain("October 31");
  });

  test("spells out the hour — 30 minutes of drills, 30 of games (Sam, 2026-09-05)", () => {
    const { text } = build();
    expect(text).toContain(PICKLPARK_SESSION_FORMAT);
    expect(PICKLPARK_SESSION_FORMAT).toContain("30 minutes of coached drills");
    expect(PICKLPARK_SESSION_FORMAT).toContain("30 minutes of game play");
  });

  test("quotes the real paid amount (season price exists in Stripe)", () => {
    const { text } = build();
    expect(text).toContain("Paid: $225.00 (full season).");
  });

  test("carries the indoor promise that earns price parity with MoCo", () => {
    // $225 buys a 60-minute block here against Walter Johnson's 90. The
    // reason is the venue, not the clock — a confirmation that quotes the
    // price without it is selling the shorter hour and none of the reason.
    const { text } = build();
    expect(text).toContain(PICKLPARK_INDOOR_NOTE);
  });

  test("states the non-refundable terms and speaks Coach voice", () => {
    const { text } = build();
    expect(text).toContain("Hi Jordan,");
    expect(text).toContain("non-refundable");
    expect(text).toContain("better than yesterday, together");
    expect(text).toContain("301-325-4731");
  });
});
