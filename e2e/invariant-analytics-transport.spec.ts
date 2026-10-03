import { test, expect } from "@playwright/test";
import { trackEvent, type AnalyticsEventMap } from "../src/lib/funnelClient";

// Synthetic browser/provider boundary only. No real requests or credentials.
const keys = ["window", "document", "navigator", "fetch"] as const;
const originals = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let beacons: Array<{ url: string; blob: Blob }>;
let requests: Array<{ url: string; init: RequestInit }>;
let google: unknown[][];
let meta: unknown[][];
let fakeWindow: { location: { pathname: string }; sessionStorage: { getItem: () => string }; gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void };
function setGlobal(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
function beacon(mode: "accepted" | "rejected" | "throws" | "absent") {
  setGlobal("navigator", mode === "absent" ? {} : { sendBeacon: (url: string, blob: Blob) => {
    beacons.push({ url, blob });
    if (mode === "throws") throw new Error("synthetic beacon failure");
    return mode === "accepted";
  } });
}
function lead() { trackEvent("lead_form_submitted", { interest: "synthetic", page: "/yellowball/inquiry" }); }
function expectLead() {
  expect(google).toEqual([["event", "generate_lead", { content_name: "lead_form_submitted" }]]);
  expect(meta).toEqual([["track", "Lead", { content_name: "lead_form_submitted" }]]);
}
test.beforeEach(() => {
  beacons = []; requests = []; google = []; meta = [];
  fakeWindow = { location: { pathname: "/yellowball/inquiry" }, sessionStorage: { getItem: () => JSON.stringify({ utm_source: "synthetic-campaign" }) }, gtag: (...args) => { google.push(args); }, fbq: (...args) => { meta.push(args); } };
  setGlobal("window", fakeWindow);
  setGlobal("document", { cookie: "ld_visitor=synthetic-visitor" });
  setGlobal("fetch", (url: string, init: RequestInit) => { requests.push({ url, init }); return Promise.resolve(new Response(null, { status: 202 })); });
  beacon("accepted");
});
test.afterEach(() => {
  for (const key of keys) {
    const descriptor = originals.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
for (const mode of ["accepted", "rejected", "throws", "absent"] as const) {
  test(`one first-party transport and independent lead mirrors: beacon ${mode}`, async () => {
    beacon(mode); lead();
    expect(beacons.length).toBe(mode === "absent" ? 0 : 1);
    expect(requests.length).toBe(mode === "accepted" ? 0 : 1);
    const body = mode === "accepted" ? JSON.parse(await beacons[0].blob.text()) : JSON.parse(String(requests[0].init.body));
    expect(mode === "accepted" ? beacons[0].url : requests[0].url).toBe("/api/analytics");
    expect(body).toEqual({ event_name: "lead_form_submitted", props: { interest: "synthetic", page: "/yellowball/inquiry", visitor_id: "synthetic-visitor", business: "nga", utm_source: "synthetic-campaign" }, page: "/yellowball/inquiry" });
    if (mode !== "accepted") expect(requests[0].init).toMatchObject({ method: "POST", keepalive: true });
    expectLead();
  });
}
for (const mode of ["sync", "async"] as const) {
  test(`fetch ${mode} failure never breaks lead mirrors`, async () => {
    beacon("rejected"); setGlobal("fetch", () => {
      if (mode === "sync") throw new Error("synthetic fetch failure");
      return Promise.reject(new Error("synthetic fetch failure"));
    });
    expect(lead).not.toThrow(); await Promise.resolve(); expectLead();
  });
}
for (const provider of ["gtag", "fbq"] as const) {
  test(`${provider} failure leaves the other provider and first-party independent`, () => {
    fakeWindow[provider] = () => { throw new Error("synthetic provider failure"); };
    expect(lead).not.toThrow(); expect(beacons).toHaveLength(1);
    expect(provider === "gtag" ? meta : google).toHaveLength(1);
  });
  test(`missing ${provider} leaves the other provider available`, () => {
    delete fakeWindow[provider]; expect(lead).not.toThrow();
    expect(provider === "gtag" ? meta : google).toHaveLength(1);
  });
}
test("Yellow Ball canonical and legacy records produce exactly one third-party lead", async () => {
  lead(); trackEvent("yellowball_lead_submitted", { child_age: 12, source: "synthetic", parent_name: "Synthetic Parent" });
  expect(beacons).toHaveLength(2);
  expect(JSON.parse(await beacons[1].blob.text()).props).toMatchObject({ child_age: 12, parent_name: "Synthetic Parent", source: "synthetic" });
  expectLead();
});
const eventNames: Array<keyof AnalyticsEventMap> = ["cta_click", "lead_form", "lead_form_started", "lead_form_submitted", "waitlist_submitted", "newsletter_signup_started", "newsletter_signup_submitted", "eval_book_started", "eval_book_submitted", "crew_interest_started", "crew_interest_submitted", "fall_interest_started", "fall_interest_submitted", "league_interest_started", "league_interest_submitted", "external_link", "scroll_depth", "free_trial_rsvp"];
for (const name of eventNames) {
  test(`${name}: only trusted coarse event identifiers leave for third parties`, () => {
    const props = { child_age: 12, parent_name: "Synthetic Parent", email: "synthetic@example.invalid", interest: "Synthetic Child", label: "Synthetic Child", url: "/private?token=synthetic", page: "/private?child=synthetic", notes: "Synthetic medical note", content_name: "caller-controlled", nested: { child_name: "Synthetic Child", birth_year: 2014 } };
    trackEvent(name, props as never);
    const isLead = name.endsWith("_submitted");
    expect(google).toEqual([["event", isLead ? "generate_lead" : name, { content_name: name }]]);
    expect(meta).toEqual([[isLead ? "track" : "trackCustom", isLead ? "Lead" : name, { content_name: name }]]);
  });
}
test("page-view ownership remains in Analytics; first-party page view is preserved", () => {
  trackEvent("page_view", { referrer: "synthetic" });
  expect(beacons).toHaveLength(1); expect(google).toEqual([]); expect(meta).toEqual([]);
});
test("SSR and absent optional tags are safe", () => {
  setGlobal("window", undefined); expect(lead).not.toThrow(); expect(beacons).toEqual([]);
  setGlobal("window", fakeWindow); delete fakeWindow.gtag; delete fakeWindow.fbq;
  expect(lead).not.toThrow(); expect(beacons).toHaveLength(1);
});
for (const name of ["", "unknown_submitted", "child-name-submitted", null, undefined]) {
  test(`invalid event ${String(name)} never leaves the browser`, () => {
    expect(() => trackEvent(name as never, {} as never)).not.toThrow();
    expect(beacons).toEqual([]); expect(requests).toEqual([]); expect(google).toEqual([]); expect(meta).toEqual([]);
  });
}
for (const props of [null, undefined, "synthetic", [], 12]) {
  test(`invalid props ${JSON.stringify(props)} never leave the browser`, () => {
    expect(() => trackEvent("cta_click", props as never)).not.toThrow();
    expect(beacons).toEqual([]); expect(requests).toEqual([]); expect(google).toEqual([]); expect(meta).toEqual([]);
  });
}
test("empty props are safe for a known event", () => {
  expect(() => trackEvent("lead_form_started", {})).not.toThrow(); expect(beacons).toHaveLength(1); expect(google).toHaveLength(1); expect(meta).toHaveLength(1);
});
test("blocked cookies and storage do not suppress first-party transport or mirrors", () => {
  setGlobal("document", { get cookie() { throw new Error("synthetic privacy restriction"); } });
  fakeWindow.sessionStorage.getItem = () => { throw new Error("synthetic storage restriction"); };
  expect(lead).not.toThrow(); expect(beacons).toHaveLength(1); expectLead();
});
test("malformed visitor cookie does not break events", () => {
  setGlobal("document", { cookie: "ld_visitor=%E0%A4%A" });
  expect(lead).not.toThrow(); expect(beacons).toHaveLength(1); expectLead();
});
test("unserializable first-party props cannot suppress safe coarse mirrors", () => {
  const props: { interest?: string; loop?: unknown } = {}; props.loop = props;
  expect(() => trackEvent("lead_form_submitted", props)).not.toThrow();
  expect(beacons).toEqual([]); expect(requests).toEqual([]); expectLead();
});
