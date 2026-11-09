import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/checkout-fall/route";
import { FetchStub } from "./fixtures/fetch-stub";

// Sam approved retiring this endpoint on 2026-11-09. Cached forms must not
// create a new checkout, even with the old public flag and price configured.
const submit: (request: NextRequest) => Promise<Response> = POST;
const TOUCHED_ENV = [
  "NEXT_PUBLIC_FALL_REGISTRATION_OPEN", "STRIPE_FALL_SEASON_PRICE_ID",
  "STRIPE_SECRET_KEY", "NOTION_API_KEY", "NOTION_FALL_REGS_DB_ID",
  "NOTION_WAIVERS_DB_ID",
] as const;
let saved: Record<string, string | undefined>;
const stub = new FetchStub();

test.beforeEach(() => {
  saved = Object.fromEntries(TOUCHED_ENV.map((key) => [key, process.env[key]]));
  for (const key of TOUCHED_ENV) delete process.env[key];
  Object.assign(process.env, {
    STRIPE_FALL_SEASON_PRICE_ID: "price_retired_fixture",
    NOTION_API_KEY: "notion_retired_fixture",
    NOTION_FALL_REGS_DB_ID: "db_retired_fixture",
    NOTION_WAIVERS_DB_ID: "db_waiver_fixture",
  });
  // Fake Notion replies keep the pre-fix control away from Stripe; every
  // attempted request is recorded and fails the zero-egress assertion.
  stub.reset();
  stub.on("api.notion.com", { results: [] }).install();
});
test.afterEach(() => {
  stub.uninstall();
  for (const key of TOUCHED_ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const valid = {
  group: "Green", parentName: "Test Parent", email: "parent@example.com",
  phone: "3015550142", childFirstName: "Testkid", childLastName: "Walker",
  childBirthYear: "2016", emergencyName: "Test Contact", emergencyPhone: "3015550143",
};

for (const flag of ["true", "false", undefined]) {
  for (const [label, body] of [
    ["valid Green", JSON.stringify(valid)],
    ["valid Yellow", JSON.stringify({ ...valid, group: "Yellow" })],
    ["empty", ""], ["malformed", "{not-json"],
  ] as const) {
    test(`${label}, public flag ${String(flag)}: closed without reading data or contacting a provider`, async () => {
      if (flag !== undefined) process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN = flag;
      const request = new NextRequest("http://localhost/api/checkout-fall", {
        method: "POST", headers: { "content-type": "application/json" }, body,
      });
      const response = await submit(request);
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        code: "registration_closed",
        error: "The Fall 2026 season has ended. Registration is closed.",
      });
      expect(request.bodyUsed, "retirement must precede parsing parent or child data").toBe(false);
      expect(stub.calls, "no roster lookup, write, waiver lookup or provider call").toEqual([]);
    });
  }
}

test("a body reader that throws is never invoked", async () => {
  let reads = 0;
  const request = new NextRequest("http://localhost/api/checkout-fall", { method: "POST" });
  request.json = async () => { reads += 1; throw new Error("body must remain unread"); };
  expect((await submit(request)).status).toBe(410);
  expect(reads).toBe(0);
  expect(stub.calls).toEqual([]);
});
