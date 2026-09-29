import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";
import { planNewsletterAudience, syncNewsletterAudience, type CrmParent, type SubscriberRow } from "../src/lib/notion-newsletter-sync";

const parent = (over: Partial<CrmParent> = {}): CrmParent => ({
  parentEmail: "parent@example.org", parentName: "Parent", source: "Website",
  crEventsAttended: null, crEventHistory: "", lastCrEvent: "", season: "Fall 2026",
  notes: "", quarantine: false, ...over,
});
const sub = (over: Partial<SubscriberRow> = {}): SubscriberRow => ({
  pageId: "subscriber", parentName: "Parent", email: "parent@example.org",
  status: "Active", referralToken: null, ...over,
});

test("missing CRM families enroll once, normalized across siblings", () => {
  const plan = planNewsletterAudience([parent(), parent({ parentEmail: " PARENT@EXAMPLE.ORG " })], []);
  expect(plan.missing).toEqual([{ email: "parent@example.org", parentName: "Parent" }]);
});

test("unsubscribe or quarantine anywhere wins over active and eligible duplicates", () => {
  for (const [parents, subscribers] of [
    [[parent()], [sub(), sub({ status: "Unsubscribed", email: " PARENT@example.org " })]],
    [[parent(), parent({ quarantine: true })], [sub()]],
  ] as [CrmParent[], SubscriberRow[]][]) {
    const plan = planNewsletterAudience(parents, subscribers);
    expect(plan.missing).toEqual([]);
    expect(plan.subscribers).toEqual([]);
  }
});

test("DD provenance, ambiguous sources, invalid and test addresses never auto-enroll", () => {
  for (const over of [
    { source: "CourtReserve" }, { source: "Google Sheet" }, { source: "" },
    { crEventsAttended: 1 }, { notes: "Imported from DD" }, { season: "Winter 2026" },
    { parentEmail: "broken" }, { parentEmail: "qa@example.com" }, { parentName: "Smoke Test" },
  ]) expect(planNewsletterAudience([parent(over)], []).missing).toEqual([]);
  expect(planNewsletterAudience([parent(), parent({ source: "CourtReserve" })], []).missing).toEqual([]);
});

test("current direct NGA acquisition sources qualify without relaxing historical exclusions", () => {
  for (const source of ["Website Contact Form", "MVF", "Instagram Ad", "Ad: chatgpt.com"]) {
    expect(planNewsletterAudience([parent({ source })], []).missing).toHaveLength(1);
    expect(planNewsletterAudience([parent({ source, crEventsAttended: 1 })], []).missing).toEqual([]);
  }
});

test("existing signups remain subscribed; duplicates send once; unknown statuses do not reactivate", () => {
  expect(planNewsletterAudience([], [sub(), sub()]).subscribers).toHaveLength(1);
  expect(planNewsletterAudience([parent({ source: "" })], [sub()]).subscribers).toHaveLength(1);
  expect(planNewsletterAudience([parent()], [sub({ status: "Paused" })]).missing).toEqual([]);
  expect(planNewsletterAudience([], []).subscribers).toEqual([]);
});

test("audience counts are distinct families with nonoverlapping exclusions", () => {
  const plan = planNewsletterAudience([
    parent(), parent(), parent({ parentEmail: "qa@example.com" }),
    parent({ parentEmail: "invalid" }), parent({ parentEmail: "gone@example.org", quarantine: true }),
  ], []);
  expect(plan.counts).toEqual({ crmFamilies: 4, eligible: 1, suppressed: 1, ddDerived: 0, ambiguous: 0, test: 1, invalid: 1 });
});

const stub = new FetchStub();
test.beforeEach(() => {
  process.env.NOTION_API_KEY = "test-key";
  process.env.NOTION_NEWSLETTER_DB_ID = "newsletter-db";
  process.env.NOTION_PLAYER_CRM_DB_ID = "crm-db";
  stub.reset(); stub.install();
});
test.afterEach(() => stub.uninstall());
const crmPage = { id: "crm", properties: {
  "Parent Email": { email: "parent@example.org" }, "Parent Name": { rich_text: [{ plain_text: "Parent" }] },
  Source: { select: { name: "Website" } },
} };
const subscriberPage = { id: "new", properties: {
  Email: { email: "parent@example.org" }, "Parent Name": { title: [{ plain_text: "Parent" }] },
  Status: { select: { name: "Active" } },
} };

test("sync creates parent-only membership without claiming a self opt-in, and reruns are idempotent", async () => {
  let created = false;
  stub.on("databases/crm-db/query", { results: [crmPage], has_more: false });
  stub.on("databases/newsletter-db/query", () => ({ results: created ? [subscriberPage] : [], has_more: false }));
  stub.on("/pages", () => { created = true; return subscriberPage; });
  const first = await syncNewsletterAudience({ pause: async () => {} });
  const second = await syncNewsletterAudience({ pause: async () => {} });
  expect(first.subscribers.map(s => s.email)).toEqual(["parent@example.org"]);
  expect(first.created).toBe(1);
  expect(second.created).toBe(0);
  const writes = stub.calls.filter(c => c.url.endsWith("/pages"));
  expect(writes).toHaveLength(1);
  const props = JSON.parse(writes[0].body).properties;
  expect(Object.keys(props).sort()).toEqual(["Email", "Marketing Opt-In", "Parent Name", "Status"]);
  expect(props["Marketing Opt-In"].checkbox).toBe(false);
});

test("partial or malformed reads fail closed before creating memberships", async () => {
  stub.on("databases/crm-db/query", { results: [crmPage], has_more: true, next_cursor: null });
  stub.on("databases/newsletter-db/query", { results: [], has_more: false });
  await expect(syncNewsletterAudience({ pause: async () => {} })).rejects.toThrow();
  expect(stub.calls.filter(c => c.url.endsWith("/pages"))).toHaveLength(0);
});

test("second-page failure and missing configuration never yield a partial send list", async () => {
  stub.onDynamic("databases/crm-db/query", c => JSON.parse(c.body).start_cursor
    ? { status: 500, json: {} }
    : { status: 200, json: { results: [crmPage], has_more: true, next_cursor: "next" } });
  stub.on("databases/newsletter-db/query", { results: [], has_more: false });
  await expect(syncNewsletterAudience({ pause: async () => {} })).rejects.toThrow();
  expect(stub.calls.filter(c => c.url.endsWith("/pages"))).toHaveLength(0);
  delete process.env.NOTION_NEWSLETTER_DB_ID;
  await expect(syncNewsletterAudience({ pause: async () => {} })).rejects.toThrow();
});

test("a fresh opt-out during enrollment is never reactivated or sent", async () => {
  let reads = 0;
  stub.on("databases/crm-db/query", { results: [crmPage], has_more: false });
  stub.on("databases/newsletter-db/query", () => ({ results: ++reads === 1 ? [] : [{
    ...subscriberPage, properties: { ...subscriberPage.properties, Status: { select: { name: "Unsubscribed" } } },
  }], has_more: false }));
  const result = await syncNewsletterAudience({ pause: async () => {} });
  expect(result.created).toBe(0);
  expect(result.subscribers).toEqual([]);
  expect(stub.calls.filter(c => c.url.endsWith("/pages"))).toHaveLength(0);
});

test("a rejected create never yields a sendable partial audience", async () => {
  stub.on("databases/crm-db/query", { results: [crmPage], has_more: false });
  stub.on("databases/newsletter-db/query", { results: [], has_more: false });
  stub.on("/pages", {}, 429);
  await expect(syncNewsletterAudience({ pause: async () => {} })).rejects.toThrow("create failed");
});
