import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";

import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";
import { POST as FALL_CHECKOUT } from "../src/app/api/checkout-fall/route";
import { FALL_SLOTS_BY_GROUP } from "../src/data/fall-2026";

// Green and Yellow stopped holding the same number of seats on 2026-08-29
// (Yellow runs 5 a court against the same single booking, Green stays on 4).
// The sold-out gate in checkout-fall is the only thing standing between that
// decision and an oversold court, and it used to read ONE shared constant —
// so a per-group cap that the gate ignores would sell Yellow's two extra
// seats into Green.
//
// These drive the real route handler with the network stubbed, so they fail
// on the gate's behaviour, not on its source text.

const ENV_KEYS = [
  "NOTION_API_KEY",
  "NOTION_FALL_REGS_DB_ID",
  "NOTION_WAIVERS_DB_ID",
  "STRIPE_FALL_SEASON_PRICE_ID",
] as const;

let saved: Record<string, string | undefined> = {};
let stub: FetchStub;

/** One Confirmed roster row, in the shape fetchFallRegistrationKeys reads. */
function rosterRow(i: number) {
  return {
    properties: {
      "Child First Name": { rich_text: [{ plain_text: `Kid${i}` }] },
      "Parent Email": { email: `parent${i}@example.com` },
    },
  };
}

/** Serves `taken` Confirmed rows for whichever group the route asks about. */
function installStub(taken: Record<string, number>) {
  stub = new FetchStub();
  stub.on(/api\.notion\.com\/v1\/databases\/.*\/query/, (call: RecordedFetch) => {
    // The waiver lookup queries a different DB id; only the roster query
    // filters on Group, so key off that rather than on call order.
    const group = /"equals":"(Green|Yellow)"/.exec(call.body)?.[1];
    if (!group) return { results: [] }; // waiver DB → no waiver on file
    return {
      results: Array.from({ length: taken[group] ?? 0 }, (_, i) => rosterRow(i)),
    };
  });
  stub.install();
}

function body(group: "Green" | "Yellow") {
  return {
    group,
    parentName: "Dana Parent",
    email: "dana@example.com",
    phone: "3013254731",
    childFirstName: "Ava",
    childBirthYear: "2014",
    emergencyName: "Sam Parent",
    emergencyPhone: "3013254732",
  };
}

function req(group: "Green" | "Yellow") {
  return new NextRequest("https://nextgenpbacademy.com/api/checkout-fall", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body(group)),
  });
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

test.describe("fall checkout enforces each group's OWN seat cap", () => {
  test("Green fills at its own cap, not Yellow's larger one", async () => {
    installStub({ Green: FALL_SLOTS_BY_GROUP.Green });
    const res = await FALL_CHECKOUT(req("Green"));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("sold_out");
  });

  test("Yellow is still open at the seat that closes Green", async () => {
    // The whole point of the per-group cap. If the gate reads one shared
    // number, this is the assertion that goes red.
    installStub({ Yellow: FALL_SLOTS_BY_GROUP.Green });
    const res = await FALL_CHECKOUT(req("Yellow"));
    const json = await res.json();
    expect(json.code).not.toBe("sold_out");
    // It stops at the waiver gate, which sits just past the cap check — proof
    // the request got THROUGH the cap rather than failing for another reason.
    expect(json.code).toBe("waiver_required");
  });

  test("Yellow fills at its own cap", async () => {
    installStub({ Yellow: FALL_SLOTS_BY_GROUP.Yellow });
    const res = await FALL_CHECKOUT(req("Yellow"));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("sold_out");
  });

  test("one seat short, either group still sells", async () => {
    for (const group of ["Green", "Yellow"] as const) {
      installStub({ [group]: FALL_SLOTS_BY_GROUP[group] - 1 });
      const res = await FALL_CHECKOUT(req(group));
      expect((await res.json()).code).toBe("waiver_required");
      stub.uninstall();
    }
  });

  test("a group's roster never gates a different group", async () => {
    // A full Green must not close Yellow, and vice versa.
    installStub({ Green: FALL_SLOTS_BY_GROUP.Green, Yellow: 0 });
    expect((await (await FALL_CHECKOUT(req("Yellow"))).json()).code).toBe(
      "waiver_required",
    );
    stub.uninstall();
    installStub({ Green: 0, Yellow: FALL_SLOTS_BY_GROUP.Yellow });
    expect((await (await FALL_CHECKOUT(req("Green"))).json()).code).toBe(
      "waiver_required",
    );
  });
});
