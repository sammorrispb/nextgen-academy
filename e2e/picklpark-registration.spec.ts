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
  PICKLPARK_SEASON_SPOTS_PER_GROUP,
} from "../src/data/picklpark-season-2026";
import {
  PICKLPARK_MAKEUP_DATES,
  PICKLPARK_SATURDAYS,
  PICKLPARK_PICKLEBALL_COURTS,
  PICKLPARK_SLOTS_PER_GROUP,
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
    group: "Green",
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

/** A Confirmed Green roster row for the capacity/duplicate queries. */
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
  test("price is the operator-set $175", () => {
    expect(PICKLPARK_SEASON_PRICE_USD).toBe(175);
  });

  test("seat cap is DERIVED from the court booking (2 pickleball courts × 4)", () => {
    expect(PICKLPARK_SEASON_SPOTS_PER_GROUP).toBe(PICKLPARK_SLOTS_PER_GROUP);
    expect(PICKLPARK_SLOTS_PER_GROUP).toBe(
      PICKLPARK_PICKLEBALL_COURTS * PLAYERS_PER_PICKLEBALL_COURT,
    );
    expect(PICKLPARK_SEASON_SPOTS_PER_GROUP).toBe(8);
  });

  test("groups mirror the Saturday blocks with canonical ball-color labels", () => {
    expect(PICKLPARK_SEASON_GROUPS.map((g) => g.group)).toEqual(
      PICKLPARK_YOUTH_BLOCKS.map((b) => b.level),
    );
    expect(PICKLPARK_SEASON_GROUPS.map((g) => g.label)).toEqual([
      "Green Ball",
      "Yellow Ball",
    ]);
    expect(PICKLPARK_SEASON_GROUPS.map((g) => g.timeLabel)).toEqual([
      "1:00–2:00 PM",
      "2:00–3:00 PM",
    ]);
  });

  test("six Saturdays Oct 3 – Nov 7, all actually Saturdays, makeup Nov 14", () => {
    expect(PICKLPARK_SATURDAYS).toHaveLength(6);
    expect(PICKLPARK_SATURDAYS[0]).toBe("2026-10-03");
    expect(PICKLPARK_SATURDAYS[5]).toBe("2026-11-07");
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

  test("9th registration in a full group → 409 sold_out before Stripe", async () => {
    process.env[PICKLPARK_SEASON_PRICE_ENV_VAR] = "price_picklpark_test";
    stub
      .on(`databases/${PICKLPARK_DB}/query`, {
        results: Array.from({ length: PICKLPARK_SEASON_SPOTS_PER_GROUP }, (_, i) =>
          confirmedRow(`Kid${i}`, `family${i}@example.com`),
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
      groupLabel: "Green Ball",
      timeLabel: "1:00–2:00 PM",
      amountUsd: "175.00",
      venue: PICKLPARK_VENUE,
      saturdays: PICKLPARK_SATURDAYS,
      makeupDates: PICKLPARK_MAKEUP_DATES,
    });
  }

  test("carries the group, every Saturday, the venue, and the makeup date", () => {
    const { subject, text } = build();
    expect(subject).toContain("Green Ball");
    expect(text).toContain("Saturdays 1:00–2:00 PM");
    expect(text).toContain("Saturday, October 3");
    expect(text).toContain("Saturday, November 7");
    for (const iso of PICKLPARK_SATURDAYS) {
      const day = Number(iso.split("-")[2]);
      expect(text).toContain(` ${day}`);
    }
    expect(text).toContain(PICKLPARK_VENUE);
    expect(text).toContain("November 14");
  });

  test("quotes the real paid amount (season price exists in Stripe)", () => {
    const { text } = build();
    expect(text).toContain("Paid: $175.00 (full season).");
  });

  test("states the non-refundable terms and speaks Coach voice", () => {
    const { text } = build();
    expect(text).toContain("Hi Jordan,");
    expect(text).toContain("non-refundable");
    expect(text).toContain("better than yesterday, together");
    expect(text).toContain("301-325-4731");
  });
});
