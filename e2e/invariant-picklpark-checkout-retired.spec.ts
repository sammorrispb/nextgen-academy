import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

// Env deliberately SET, not deleted — deleting it would make every downstream
// writer self-skip, which proves only that the call didn't happen, not that
// the route declines to make it. Same lesson as invariant-waitlist-pii-egress.
process.env.NOTION_API_KEY = "ntn_test_picklpark_retired";
process.env.NOTION_PICKLPARK_REGS_DB_ID = "picklpark-regs-db-retired";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";
process.env.STRIPE_PICKLPARK_SEASON_PRICE_ID = "price_picklpark_retired";
process.env.OPEN_BRAIN_INGEST_URL = "https://open-brain.example.com/ingest";
process.env.LEAD_INGEST_TOKEN = "ob-token-retired";

import { GET, POST } from "../src/app/api/checkout-picklpark/route";
import { PICKLPARK_LEAGUES } from "../src/data/picklpark-leagues-2026";

// REPLACES two specs deleted on 2026-09-07 when NGA stopped selling the Pickl
// Park season:
//
//   invariant-picklpark-registration-pii-egress — proved child PII reached
//     ONLY Notion. The route no longer reads a body at all, so the honest
//     successor is the stronger claim below: it egresses NOTHING, and echoes
//     nothing back, even when handed a full child payload.
//   invariant-picklpark-seat-cap-per-group — proved one band's fill could not
//     gate the other. There are no bands any more; it guarded a cancelled
//     product, and its own header conceded the behavioural half was already
//     weak (both caps are equal, so a mutation didn't turn it red).
//
// This one CAN fail: re-add a Stripe or Notion branch, or echo the request
// body into the response, and it goes red. That is the point — a retired
// payment route is exactly where a future edit quietly reopens a charge.

const CHILD_PAYLOAD = {
  group: "Green/Yellow",
  parentName: "Egress Probe",
  parentEmail: "probe@example.com",
  parentPhone: "301-555-0100",
  childFirstName: "Wren",
  childBirthYear: 2015,
  emergencyName: "Emergency Probe",
  emergencyPhone: "301-555-0101",
  allergies: "peanuts, tree nuts",
  waiverAccepted: true,
};

function req(body: unknown): Request {
  return new Request("https://nextgenpbacademy.com/api/checkout-picklpark", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test("POST is 410 Gone — not 503, which would mean 'try later'", async () => {
  stub.install();
  const res = await POST();
  expect(res.status).toBe(410);
  expect(stub.calls).toHaveLength(0);
});

test("GET is 410 too, so a bookmarked link can't look alive", async () => {
  stub.install();
  const res = await GET();
  expect(res.status).toBe(410);
  expect(stub.calls).toHaveLength(0);
});

test("a full child payload egresses nowhere and is never echoed back", async () => {
  stub.install();
  // The route takes no argument; construct the request anyway so this spec
  // fails loudly the day someone re-adds a body-reading branch.
  void req(CHILD_PAYLOAD);
  const res = await POST();
  const text = await res.text();

  expect(stub.calls).toHaveLength(0);
  for (const value of ["Wren", "2015", "peanuts", "probe@example.com", "301-555-0100"]) {
    expect(text).not.toContain(value);
  }
});

test("the refusal routes a family to podplay instead of dead-ending them", async () => {
  const body = await (await POST()).json();
  const urls = (body.leagues as { signupUrl: string }[]).map((l) => l.signupUrl);
  expect(urls).toEqual(PICKLPARK_LEAGUES.map((l) => l.signupUrl));
  for (const url of urls) {
    expect(url).toContain("thepicklpark.podplay.app");
  }
});

test("no dollar figure leaks from the retired route", async () => {
  const text = await (await POST()).text();
  expect(text).not.toMatch(/\$\s*\d/);
  expect(text).not.toContain("225");
});
