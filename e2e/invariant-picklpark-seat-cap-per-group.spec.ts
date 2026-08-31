import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";

import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";
import { POST as PICKLPARK_CHECKOUT } from "../src/app/api/checkout-picklpark/route";
import {
  PICKLPARK_SLOTS_BY_GROUP,
  type PicklParkBandLevel,
} from "../src/data/picklpark-2026";

// The Pickl Park season shipped with the pre-2026-08-29 shape the Walter
// Johnson season had already been burned by: ONE shared spots-per-group
// constant read by the sold-out gate, so a per-group cap the gate ignored
// would sell one band's seats into the other.
//
// WHAT THESE PROVE, HONESTLY. Both bands hold the same number of seats today
// (2 courts × 4), which means a gate that hardcoded one band's value would
// still behave identically — a mutation to `slotsFor("Red/Orange")` does NOT
// turn these red, and it was checked. What the spec locks is the SHAPE: it
// imports `PICKLPARK_SLOTS_BY_GROUP` as a per-band record, so collapsing the
// seat source back to a scalar fails to compile here, and every threshold
// below is read per band rather than typed. The behavioural half becomes
// discriminating the moment the two numbers diverge — which is exactly when
// the bug bites, and is why the fall spec (Green 8 / Yellow 10) can catch it
// today and this one cannot yet.
//
// These drive the real route handler with the network stubbed, so they assert
// the gate's BEHAVIOUR, not its source text.

const ENV_KEYS = [
  "NOTION_API_KEY",
  "NOTION_PICKLPARK_REGS_DB_ID",
  "NOTION_WAIVERS_DB_ID",
  "STRIPE_PICKLPARK_SEASON_PRICE_ID",
] as const;

const BANDS = Object.keys(PICKLPARK_SLOTS_BY_GROUP) as PicklParkBandLevel[];

let saved: Record<string, string | undefined> = {};
let stub: FetchStub;

/** One Confirmed roster row, in the shape fetchPicklParkRegistrationKeys reads. */
function rosterRow(i: number) {
  return {
    properties: {
      "Child First Name": { rich_text: [{ plain_text: `Kid${i}` }] },
      "Parent Email": { email: `parent${i}@example.com` },
    },
  };
}

/** Serves `taken` Confirmed rows for whichever band the route asks about. */
function installStub(taken: Partial<Record<PicklParkBandLevel, number>>) {
  stub = new FetchStub();
  stub.on(/api\.notion\.com\/v1\/databases\/.*\/query/, (call: RecordedFetch) => {
    // The waiver lookup queries a different DB id; only the roster query
    // filters on Group, so key off that rather than on call order.
    const group = /"equals":"(Red\/Orange|Green\/Yellow)"/.exec(call.body)?.[1] as
      | PicklParkBandLevel
      | undefined;
    if (!group) return { results: [] }; // waiver DB → no waiver on file
    return {
      results: Array.from({ length: taken[group] ?? 0 }, (_, i) => rosterRow(i)),
    };
  });
  stub.install();
}

function req(group: PicklParkBandLevel) {
  return new NextRequest(
    "https://nextgenpbacademy.com/api/checkout-picklpark",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        group,
        parentName: "Dana Parent",
        email: "dana@example.com",
        phone: "3013254731",
        childFirstName: "Ava",
        childBirthYear: "2014",
        emergencyName: "Sam Parent",
        emergencyPhone: "3013254732",
      }),
    },
  );
}

test.beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    process.env[k] = `test-${k}`;
  }
});

test.afterEach(() => {
  stub?.uninstall();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

test.describe("Pickl Park checkout enforces each band's OWN seat cap", () => {
  test("the season has exactly two bands, and both are capped", () => {
    expect(BANDS).toEqual(["Red/Orange", "Green/Yellow"]);
    for (const band of BANDS) {
      expect(PICKLPARK_SLOTS_BY_GROUP[band]).toBeGreaterThan(0);
    }
  });

  test("each band fills at its own cap", async () => {
    for (const band of BANDS) {
      installStub({ [band]: PICKLPARK_SLOTS_BY_GROUP[band] });
      const res = await PICKLPARK_CHECKOUT(req(band));
      expect(res.status, `${band} should be sold out at its cap`).toBe(409);
      expect((await res.json()).code).toBe("sold_out");
      stub.uninstall();
    }
  });

  test("one seat short, either band still sells", async () => {
    for (const band of BANDS) {
      installStub({ [band]: PICKLPARK_SLOTS_BY_GROUP[band] - 1 });
      const res = await PICKLPARK_CHECKOUT(req(band));
      // It stops at the waiver gate, which sits just past the cap check —
      // proof the request got THROUGH the cap rather than failing elsewhere.
      expect((await res.json()).code, `${band} should still sell`).toBe(
        "waiver_required",
      );
      stub.uninstall();
    }
  });

  test("a full band never gates the other one", async () => {
    // Fill one band to ITS cap; the other must still sell. Today both caps
    // match so this passes either way — it is the regression net for the day
    // one band gets a third court.
    for (const full of BANDS) {
      const other = BANDS.find((b) => b !== full)!;
      installStub({ [full]: PICKLPARK_SLOTS_BY_GROUP[full], [other]: 0 });
      const res = await PICKLPARK_CHECKOUT(req(other));
      expect(
        (await res.json()).code,
        `a full ${full} must not close ${other}`,
      ).toBe("waiver_required");
      stub.uninstall();
    }
  });

  test("the seat source is a per-band record, not one shared number", () => {
    // The compile-time half of the guard, and the half that actually bites
    // today: this file imports PICKLPARK_SLOTS_BY_GROUP and indexes it by
    // band. Collapsing it back to a scalar breaks the build here rather than
    // silently re-introducing the shared-cap bug.
    expect(typeof PICKLPARK_SLOTS_BY_GROUP).toBe("object");
    expect(Object.keys(PICKLPARK_SLOTS_BY_GROUP).sort()).toEqual(
      [...BANDS].sort(),
    );
    // If a future booking diverges the bands, the behavioural tests above
    // start discriminating on their own — no new test needed.
  });
});
