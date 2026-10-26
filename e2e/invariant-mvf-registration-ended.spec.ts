import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import Page, { metadata } from "../src/app/mvf-junior-tournament/page";
import { POST } from "../src/app/api/checkout-mvf-junior-tournament/route";
import { mvfTournamentJsonLd } from "../src/lib/mvf-tournament-jsonld";
import { FetchStub } from "./fixtures/fetch-stub";
import { DenyProviderNetwork } from "./fixtures/deny-provider-network";

const require = createRequire(`${process.cwd()}/package.json`);
const runtime = require("playwright/jsx-runtime");
const originalRuntime = { ...runtime };
const originalNow = Date.now;
const END = Date.parse("2026-10-24T19:00:00-04:00");
const stub = new FetchStub();
const network = new DenyProviderNetwork();
const calls: string[] = [];
const dependencies = [
  ["./src/lib/stripe.ts", ["getStripe"]],
  ["./src/lib/notion-waivers.ts", ["hasWaiverOnFile"]],
  ["./src/lib/mvf-capacity.ts", ["reserveMvfSeat", "bindMvfSeat"]],
  ["./src/lib/stripe-invoices.ts", ["createAndSendSignupInvoice"]],
  ["./src/lib/notion-mvf-tournament-registrations.ts", ["createMvfTournamentRegistration"]],
] as const;
let restore: Array<() => void>;

test.beforeEach(() => {
  Date.now = () => END + 1;
  Object.assign(runtime, { jsx: jsx.jsx, jsxs: jsx.jsxs, Fragment: jsx.Fragment });
  calls.length = 0;
  restore = [];
  for (const [path, names] of dependencies) {
    const dependencyModule = require(path) as Record<string, unknown>;
    for (const name of names) {
      const original = dependencyModule[name];
      dependencyModule[name] = () => { calls.push(name); throw new Error("Closed-event dependency reached"); };
      restore.push(() => { dependencyModule[name] = original; });
    }
  }
  stub.reset(); stub.install(); network.install();
});
test.afterEach(() => {
  Date.now = originalNow;
  Object.assign(runtime, originalRuntime);
  for (const undo of restore.reverse()) undo();
  stub.uninstall(); network.uninstall();
  expect(stub.calls, "no waiver, reservation, mail or roster request").toEqual([]);
  expect(network.attempts, "no SDK provider traffic").toEqual([]);
});

function request(body: unknown, raw = false) {
  return new NextRequest("http://localhost/api/checkout-mvf-junior-tournament", {
    method: "POST", body: raw ? String(body) : JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": "10.92.1.1" },
  });
}
const valid = {
  parentName: "Synthetic Guardian", email: "synthetic@example.invalid", phone: "2025550100",
  childFirstName: "Synthetic", childLastName: "Fixture", childDob: "2017-03-15",
  emergencyName: "Synthetic Guardian", emergencyPhone: "2025550101",
  division: "10u", resident: true, allergies: "", smsConsent: false,
};

for (const division of ["10u", "14u"]) {
  test(`ended event rejects ${division} before any configured service or body processing`, async () => {
    const response = await POST(request({ ...valid, division, childDob: division === "14u" ? "2013-03-15" : valid.childDob,
      eventDate: "2099-10-24", registrationOpen: true, submissionId: "11111111-1111-4111-8111-111111111111" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "registration_closed", error: "This tournament has ended. Registration is closed." });
    expect(calls).toEqual([]);
  });
}

test("closure takes precedence over malformed JSON and repeated retries", async () => {
  for (let i = 0; i < 22; i++) {
    const response = await POST(request("{invalid", true));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("registration_closed");
  }
  expect(calls).toEqual([]);
});

test("scheduled Eastern end is the boundary even when the server runs in UTC", async () => {
  Date.now = () => END - 1;
  expect((await POST(request("{invalid", true))).status).toBe(400);
  Date.now = () => END;
  expect((await POST(request("{invalid", true))).status).toBe(409);
  Date.now = () => Date.parse("2026-10-26T12:00:00Z");
  expect((await POST(request(valid))).status).toBe(409);
  expect(calls).toEqual([]);
});

test("historical page retains noindex facts and replaces registration with an ended notice", () => {
  const html = renderToStaticMarkup(Page());
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(html).toContain("This tournament has ended. Registration is closed.");
  expect(html).toContain("Saturday, October 24, 2026");
  expect(html).toContain("North Creek Community Center");
  expect(html).not.toContain("<form");
  expect(html).not.toMatch(/Fill this in|lock your player|Register —/);
  expect(mvfTournamentJsonLd()).not.toHaveProperty("offers");
  expect(calls).toEqual([]);
});

test("pre-event historical rendering still has its original form and offers", () => {
  Date.now = () => END - 1;
  const html = renderToStaticMarkup(Page());
  expect(html).toContain("<form");
  expect(html).not.toContain("This tournament has ended. Registration is closed.");
  expect(mvfTournamentJsonLd()).toHaveProperty("offers");
  expect(calls).toEqual([]);
});
