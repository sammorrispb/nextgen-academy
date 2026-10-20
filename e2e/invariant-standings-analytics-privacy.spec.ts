import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { trackEvent } from "../src/lib/funnelClient";
import { POST } from "../src/app/api/analytics/route";
import { metadata as fallMetadata } from "../src/app/fall/standings/[group]/[token]/page";
import { metadata as leagueMetadata } from "../src/app/standings/[slug]/[token]/page";

const GLOBALS = ["window", "document", "navigator", "fetch"] as const;
const originals = new Map(GLOBALS.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const ENV = ["OPEN_BRAIN_ANALYTICS_URL", "LEAD_INGEST_TOKEN"] as const;
const savedEnv = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
const links = [
  "/standings/green/synthetic-capability",
  "/fall/standings/Green/synthetic-capability",
  "/standings/green/synthetic-capability/",
  "/standings%2Fgreen%2Fsynthetic-capability",
  "/standings%252Fgreen%252Fsynthetic-capability",
  "/standings%2525252Fgreen%2525252Fsynthetic-capability",
  "/standings%2Fgreen%2Fsynthetic-capability%ZZ",
  "/standings%2F%FFgreen%2Fsynthetic-capability",
];
let calls: { url: string; body: string }[];
let beacons: Blob[];
let providers: unknown[][];
let cookieAccesses: number;
let location: { pathname: string };
function global(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
test.beforeEach(() => {
  calls = []; beacons = []; providers = []; cookieAccesses = 0;
  location = { pathname: "/schedule" };
  process.env.OPEN_BRAIN_ANALYTICS_URL = "https://analytics.example.test/ingest";
  process.env.LEAD_INGEST_TOKEN = "synthetic-ingest-key";
  global("window", { location, sessionStorage: { getItem: () => null },
    gtag: (...args: unknown[]) => providers.push(args), fbq: (...args: unknown[]) => providers.push(args) });
  global("document", { get cookie() { cookieAccesses++; return "ld_visitor=synthetic-visitor"; }, set cookie(_value: string) { cookieAccesses++; } });
  global("navigator", { sendBeacon: (_url: string, body: Blob) => { beacons.push(body); return true; } });
  global("fetch", (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: String(init.body) });
    return Promise.resolve(new Response(null, { status: 204 }));
  });
});
test.afterEach(() => {
  for (const key of GLOBALS) {
    const descriptor = originals.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  for (const key of ENV) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
for (const link of links) {
  test(`standings capability route produces no analytics or visitor state: ${link}`, () => {
    location.pathname = link;
    trackEvent("page_view", { referrer: "" });
    trackEvent("cta_click", { label: "Footer", destination: "/schedule" });
    expect(beacons).toEqual([]); expect(calls).toEqual([]); expect(providers).toEqual([]);
    expect(cookieAccesses).toBe(0);
  });
  test(`proxy drops a token-bearing page before upstream work: ${link}`, async () => {
    const response = await POST(new Request("https://nga.example.test/api/analytics", {
      method: "POST", body: JSON.stringify({ event_name: "page_view", page: link, props: {} }),
    }));
    expect(response.status).toBe(204); expect(calls).toEqual([]);
  });
}
for (const field of ["referrer", "url", "destination"]) {
  test(`a public-page event cannot carry a capability URL in nested ${field}`, () => {
    trackEvent("cta_click", { label: "Synthetic", nested: [{ [field]: `https://nga.example.test${links[0]}` }] } as never);
    expect(beacons).toEqual([]); expect(calls).toEqual([]); expect(providers).toEqual([]);
  });
  test(`proxy rejects a nested ${field} capability without relying on a Referer header`, async () => {
    await POST(new Request("https://nga.example.test/api/analytics", {
      method: "POST", body: JSON.stringify({ event_name: "cta_click", page: "/schedule", props: { nested: [{ [field]: links[1] }] } }),
    }));
    expect(calls).toEqual([]);
  });
}
test("a protected Referer prevents a public-looking proxy event", async () => {
  await POST(new Request("https://nga.example.test/api/analytics", {
    method: "POST", headers: { referer: `https://nga.example.test${links[0]}` },
    body: JSON.stringify({ event_name: "page_view", page: "/schedule" }),
  }));
  expect(calls).toEqual([]);
});
test("ordinary public events and a neighboring route retain their transport", async () => {
  location.pathname = "/standings-news";
  trackEvent("page_view", { referrer: "https://example.test/" });
  expect(beacons).toHaveLength(1);
  const body = JSON.parse(await beacons[0].text());
  expect(body.page).toBe("/standings-news");
  const response = await POST(new Request("https://nga.example.test/api/analytics", { method: "POST", body: JSON.stringify(body) }));
  expect(response.status).toBe(204); expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0].body)).toEqual(body);
});

test("a public-to-private SPA transition rechecks the current path before transport", () => {
  trackEvent("page_view", { referrer: "" });
  expect(beacons).toHaveLength(1);
  location.pathname = links[0];
  trackEvent("page_view", { referrer: "" });
  trackEvent("cta_click", { label: "Synthetic delayed callback" });
  expect(beacons).toHaveLength(1); expect(calls).toEqual([]); expect(providers).toEqual([]);
});
test("a capability referrer on an ordinary page never reaches analytics", () => {
  Object.defineProperty(document, "referrer", { value: `https://nga.example.test${links[1]}` });
  trackEvent("page_view", { referrer: document.referrer });
  expect(beacons).toEqual([]); expect(calls).toEqual([]); expect(providers).toEqual([]);
});
test("production source cannot bootstrap optional providers or their automatic SPA capture", () => {
  const files = (path: string): string[] => readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(path, entry.name)) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [join(path, entry.name)] : []);
  for (const path of files(join(process.cwd(), "src"))) {
    expect(readFileSync(path, "utf8"), path).not.toMatch(/googletagmanager\.com|connect\.facebook\.net|window\.(?:gtag|fbq)\s*\(|gtag\(['"]config|fbq\(['"]init/);
  }
});

test("a capability used as an arbitrary JSON key is refused on both boundaries", async () => {
  const props = { label: "Synthetic", [links[0]]: "value" };
  trackEvent("cta_click", props);
  expect(beacons).toEqual([]); expect(providers).toEqual([]);
  await POST(new Request("https://nga.example.test/api/analytics", { method: "POST", body: JSON.stringify({ page: "/schedule", props }) }));
  expect(calls).toEqual([]);
});
test("ordinary encoded public URL remains a usable event property", async () => {
  const destination = encodeURIComponent(encodeURIComponent(encodeURIComponent("https://example.test/schedule")));
  trackEvent("cta_click", { label: "Synthetic", destination });
  expect(beacons).toHaveLength(1);
  const body = JSON.parse(await beacons[0].text());
  await POST(new Request("https://nga.example.test/api/analytics", { method: "POST", body: JSON.stringify(body) }));
  expect(calls).toHaveLength(1);
});

test("both signed standings families declare no-referrer", () => {
  expect(fallMetadata.referrer).toBe("no-referrer");
  expect(leagueMetadata.referrer).toBe("no-referrer");
});
