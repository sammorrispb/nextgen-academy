import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

process.env.NOTION_API_KEY = "ntn_test_mondaygirls_capacity";
process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID = "monday-girls-regs-db-capacity";
process.env.NOTION_WAIVERS_DB_ID = "waivers-db-capacity";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";
process.env.STRIPE_MONDAY_GIRLS_PRICE_ID = "price_monday_girls_capacity";

import { POST } from "../src/app/api/checkout-monday-girls/route";
import {
  MONDAY_GIRLS_ADVANCED_BEGINNER,
  MONDAY_GIRLS_BEGINNER,
  MONDAY_GIRLS_BLOCK_SEATS,
  MONDAY_GIRLS_LEVELS,
  MONDAY_GIRLS_PICKLEBALL_COURTS,
  MONDAY_GIRLS_TENNIS_COURTS,
  mondayGirlsBlockSeats,
} from "../src/data/monday-girls-2026";
import {
  MONDAY_GIRLS_SEASON_GROUPS,
  findMondayGirlsSeasonGroup,
  mondayGirlsSeasonSeats,
} from "../src/data/monday-girls-season-2026";
import {
  PICKLEBALL_COURTS_PER_TENNIS_COURT,
  PLAYERS_PER_PICKLEBALL_COURT,
} from "../src/data/venue-parking";

// THE INVARIANT: the Monday Girls block has ONE seat cap, shared by both
// levels — not one cap per level.
//
// This looks like the bug invariant-fall-seat-cap-per-group.spec.ts exists to
// prevent, and it is the opposite. The distinction is physical, and it is the
// whole reason this file exists:
//
//   Walter Johnson  — Green plays 1:00–2:30, Yellow plays 2:30–4:00. Different
//                     hours, so each group owns its own court-time and a shared
//                     scalar cap would gate one group on the other's fill. Seats
//                     MUST be per group there.
//
//   Monday Girls    — Beginner and Advanced Beginner play the SAME 6:00–7:00 PM
//                     hour, on the SAME single tennis court (Sam, 2026-09-20:
//                     "it's that same session, expanding the group"). One
//                     booking, one hour, one cap. A per-level cap of 8 would put
//                     16 girls on 2 pickleball courts; a per-level cap of 4
//                     would refuse an all-beginner fill the court can hold,
//                     which defeats the point of widening the block.
//
// So: if a future change reintroduces a per-level seat map here, or re-adds a
// `Group` filter to the capacity query, this spec must go red. Both are pinned
// below — behaviourally where possible, by source where the absence of a thing
// is the point.

const DATA_DIR = join(process.cwd(), "src", "data");
const NOTION_LIB = join(
  process.cwd(),
  "src",
  "lib",
  "notion-monday-girls-registrations.ts",
);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

test.describe("Monday Girls — one cap for the whole block", () => {
  test("seats are DERIVED from the one court booking, not typed", () => {
    expect(MONDAY_GIRLS_TENNIS_COURTS).toBe(1);
    expect(MONDAY_GIRLS_PICKLEBALL_COURTS).toBe(
      MONDAY_GIRLS_TENNIS_COURTS * PICKLEBALL_COURTS_PER_TENNIS_COURT,
    );
    expect(MONDAY_GIRLS_BLOCK_SEATS).toBe(
      MONDAY_GIRLS_PICKLEBALL_COURTS * PLAYERS_PER_PICKLEBALL_COURT,
    );
    expect(mondayGirlsBlockSeats()).toBe(MONDAY_GIRLS_BLOCK_SEATS);
    expect(mondayGirlsSeasonSeats()).toBe(MONDAY_GIRLS_BLOCK_SEATS);
  });

  test("the cap is a single number, NOT a per-level map", () => {
    // A number, not an object — the shape itself is the invariant. Turning
    // MONDAY_GIRLS_BLOCK_SEATS back into a Record keyed by level turns this red.
    expect(typeof MONDAY_GIRLS_BLOCK_SEATS).toBe("number");
    expect(typeof mondayGirlsSeasonSeats()).toBe("number");
    // And the seat accessors take NO level argument: a signature that accepted
    // one would mean the caller believes levels have separate caps.
    expect(mondayGirlsBlockSeats).toHaveLength(0);
    expect(mondayGirlsSeasonSeats).toHaveLength(0);
  });

  test("the block's total capacity does not scale with the number of levels", () => {
    // Two levels today. Adding a third must not add seats to a one-court hour.
    expect(MONDAY_GIRLS_LEVELS.length).toBeGreaterThan(1);
    expect(MONDAY_GIRLS_BLOCK_SEATS).toBe(
      MONDAY_GIRLS_PICKLEBALL_COURTS * PLAYERS_PER_PICKLEBALL_COURT,
    );
    expect(MONDAY_GIRLS_BLOCK_SEATS).not.toBe(
      MONDAY_GIRLS_LEVELS.length *
        MONDAY_GIRLS_PICKLEBALL_COURTS *
        PLAYERS_PER_PICKLEBALL_COURT,
    );
  });

  test("no per-level seat map survives in the data module", () => {
    const src = read(join(DATA_DIR, "monday-girls-2026.ts"));
    expect(src).not.toMatch(/SLOTS_BY_GROUP/);
    expect(src).not.toMatch(/mondayGirlsSlotsFor/);
    const season = read(join(DATA_DIR, "monday-girls-season-2026.ts"));
    expect(season).not.toMatch(/mondayGirlsSeasonSlotsFor/);
  });
});

test.describe("Monday Girls — both levels exist and stay addressable", () => {
  test("the live Notion select value for Beginner is byte-identical", () => {
    // Real Confirmed rows in the roster DB carry this exact string. Renaming it
    // strands them from every count, the duplicate guard and the admin roster.
    expect(MONDAY_GIRLS_BEGINNER).toBe("Girls Beginner");
  });

  test("Advanced Beginner is a distinct second level", () => {
    expect(MONDAY_GIRLS_ADVANCED_BEGINNER).toBe("Girls Advanced Beginner");
    expect(MONDAY_GIRLS_ADVANCED_BEGINNER).not.toBe(MONDAY_GIRLS_BEGINNER);
    expect(new Set(MONDAY_GIRLS_LEVELS).size).toBe(MONDAY_GIRLS_LEVELS.length);
  });

  test("every level resolves to a season option, and both share the hour", () => {
    for (const level of MONDAY_GIRLS_LEVELS) {
      expect(findMondayGirlsSeasonGroup(level), level).toBeDefined();
    }
    expect(MONDAY_GIRLS_SEASON_GROUPS).toHaveLength(MONDAY_GIRLS_LEVELS.length);
    // Same hour for both — the physical fact the shared cap rests on.
    const times = new Set(MONDAY_GIRLS_SEASON_GROUPS.map((g) => g.timeLabel));
    expect(times.size).toBe(1);
  });

  test("an unknown level is still rejected", () => {
    expect(findMondayGirlsSeasonGroup("Girls Expert")).toBeUndefined();
    expect(findMondayGirlsSeasonGroup(undefined)).toBeUndefined();
  });
});

test.describe("Monday Girls — the capacity query counts the whole block", () => {
  test("neither roster query filters on Group", () => {
    const src = read(NOTION_LIB);
    // The capacity + duplicate-guard queries must see BOTH levels. A
    // reintroduced Group filter would let 8 beginners AND 8 advanced beginners
    // each fill "their" half of a court that holds 8 in total.
    const capacityBlock = src.slice(
      src.indexOf("fetchMondayGirlsRegistrationKeys"),
    );
    expect(capacityBlock).not.toMatch(
      /property:\s*"Group"|"property":\s*"Group"/,
    );
  });
});

const PARENT_EMAIL = "capacity-probe@example.com";

function body(group: string): string {
  return JSON.stringify({
    group,
    parentName: "Capacity Parent",
    email: PARENT_EMAIL,
    phone: "3015550142",
    childFirstName: "Capacityprobe",
    childBirthYear: String(new Date().getFullYear() - 9),
    emergencyName: "Capacity Emergency",
    emergencyPhone: "3015550143",
    allergies: "",
    smsConsent: false,
  });
}

function req(payload: string): NextRequest {
  return new NextRequest("http://localhost/api/checkout-monday-girls", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json" },
  });
}

const stub = new FetchStub();

/**
 * Fill the roster with `count` Confirmed rows split across BOTH levels, so a
 * per-level count would see only half of them and wrongly report room.
 */
function installRoster(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: `row-${i}`,
    properties: {
      "Child First Name": { rich_text: [{ plain_text: `Kid${i}` }] },
      "Parent Email": { email: `family${i}@example.com` },
      Group: {
        select: {
          name: i % 2 === 0 ? MONDAY_GIRLS_BEGINNER : MONDAY_GIRLS_ADVANCED_BEGINNER,
        },
      },
    },
  }));
  stub
    .on(/api\.notion\.com\/v1\/databases\/(.*)\/query/, (call: RecordedFetch) => {
      // Discriminate on the DB in the URL, never on the filter body — the
      // absence of a Group filter is exactly what this spec pins.
      const isRoster = call.url.includes("monday-girls-regs-db-capacity");
      if (!isRoster) return { results: [{ id: "waiver-row", properties: {} }] };

      // HONOUR a Group filter if the route sends one. Notion would, so a stub
      // that ignores it makes the sold-out assertions below unfalsifiable: a
      // route narrowed to one level would still be handed the whole block and
      // the test would pass. Mutation-checked — re-adding the filter to the
      // capacity query must turn the sold-out test red, not just the source
      // pin.
      const asked = /"property"\s*:\s*"Group"[\s\S]*?"equals"\s*:\s*"([^"]+)"/.exec(
        call.body,
      )?.[1];
      return {
        results: asked
          ? rows.filter((r) => r.properties.Group.select.name === asked)
          : rows,
      };
    })
    .install();
}

test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("Monday Girls — checkout enforces the block cap", () => {
  test("a full block is sold out to BOTH levels, however the seats are split", async () => {
    installRoster(MONDAY_GIRLS_BLOCK_SEATS);
    for (const level of MONDAY_GIRLS_LEVELS) {
      const res = await POST(req(body(level)));
      expect(res.status, `${level} should be sold out`).toBe(409);
      expect((await res.json()).code).toBe("sold_out");
    }
  });

  test("one seat short of full, either level can still buy it", async () => {
    installRoster(MONDAY_GIRLS_BLOCK_SEATS - 1);
    for (const level of MONDAY_GIRLS_LEVELS) {
      // Runs past the capacity gate; the Stripe SDK then rejects on the dummy
      // key, which is fine — clearing the gate is the assertion.
      const res = await POST(req(body(level))).catch(() => null);
      if (res) {
        const payload = await res.json().catch(() => ({}));
        expect(payload.code, `${level} should not be sold out`).not.toBe(
          "sold_out",
        );
      }
    }
  });
});
