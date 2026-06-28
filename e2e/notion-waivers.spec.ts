import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

// Gate decision logic: hasWaiverOnFile() drives the pre-checkout block, so its
// fail-open/closed semantics are the security-critical contract. Pure-node
// spec (no dev server): the Notion query rides globalThis.fetch, which the stub
// intercepts.
//   npx playwright test e2e/notion-waivers.spec.ts --project=desktop

const WAIVERS_DB = "waivers-db-test";

import { hasWaiverOnFile } from "../src/lib/notion-waivers";

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  process.env.NOTION_API_KEY = "ntn_test";
  process.env.NOTION_WAIVERS_DB_ID = WAIVERS_DB;
});
test.afterEach(() => stub.uninstall());

test.describe("hasWaiverOnFile", () => {
  test("fail-OPEN when the waivers DB env is unset (never blocks misconfigured checkout)", async () => {
    delete process.env.NOTION_WAIVERS_DB_ID;
    stub.install(); // any fetch would throw — proves we don't even query
    expect(await hasWaiverOnFile("parent@example.com", "3015550100")).toBe(true);
    expect(stub.calls).toHaveLength(0);
  });

  test("configured + no matching row → false (gate blocks)", async () => {
    stub.on(`databases/${WAIVERS_DB}/query`, { results: [] }).install();
    expect(await hasWaiverOnFile("parent@example.com")).toBe(false);
  });

  test("configured + a matching row → true (gate passes)", async () => {
    stub.on(`databases/${WAIVERS_DB}/query`, { results: [{ id: "w_1" }] }).install();
    expect(await hasWaiverOnFile("parent@example.com")).toBe(true);
  });

  test("with no email, the phone-key lookup is used", async () => {
    stub.on(`databases/${WAIVERS_DB}/query`, { results: [{ id: "w_phone" }] }).install();
    expect(await hasWaiverOnFile("", "3015550100")).toBe(true);
    const q = stub.callsTo("/query");
    expect(q).toHaveLength(1);
    // The single query filters on Parent Phone, not Parent Email.
    expect(q[0].body).toContain("Parent Phone");
  });

  test("a transient Notion error fails OPEN (a blip never kills the revenue path)", async () => {
    stub.on(`databases/${WAIVERS_DB}/query`, { message: "rate limited" }, 429).install();
    expect(await hasWaiverOnFile("parent@example.com")).toBe(true);
  });
});
