import { test, expect } from "@playwright/test";
import { POST } from "../src/app/api/analytics/route";
import * as analyticsRoute from "../src/app/api/analytics/route";
import { AfterStub } from "./fixtures/after-stub";

// /api/analytics answers 204 straight away and forwards the event afterwards.
// On Vercel "afterwards" only exists if the work is registered through Next's
// after(): a detached promise can be frozen with the response, and a visitor
// who just tapped a link that leaves the site sends no later request to thaw
// it. These tests pin the registration, not the timing.
//
// The route is fail-open by design (it always answers 204), so every test here
// asserts positively on the upstream call. A broken harness must show up as a
// missing call, never as a quiet pass.

const ENV = ["OPEN_BRAIN_ANALYTICS_URL", "LEAD_INGEST_TOKEN"] as const;
const savedEnv = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
const UPSTREAM = "https://analytics.example.test/ingest";
const after = new AfterStub();
let calls: { url: string; init: RequestInit }[];
let upstreamStatus: number;

const event = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://nga.example.test/api/analytics", { method: "POST", headers, body: JSON.stringify(body) });

const tap = {
  event_name: "external_link",
  props: { label: "switcher_linkanddink", url: "https://www.linkanddink.com/?utm_content=switcher_linkanddink", page: "footer" },
  page: "/schedule",
};

test.beforeEach(() => {
  calls = [];
  upstreamStatus = 202;
  process.env.OPEN_BRAIN_ANALYTICS_URL = UPSTREAM;
  process.env.LEAD_INGEST_TOKEN = "synthetic-ingest-key";
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return Promise.resolve(new Response("synthetic upstream body", { status: upstreamStatus }));
    },
  });
  after.install();
});

test.afterEach(() => {
  after.uninstall();
  if (originalFetch) Object.defineProperty(globalThis, "fetch", originalFetch);
  for (const key of ENV) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("the upstream send is registered through after() and happens inside it", async () => {
  const response = await POST(event(tap));
  expect(response.status).toBe(204);
  // Let any detached promise the handler started reach its fetch.
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(after.tasks).toHaveLength(1);
  expect(calls).toHaveLength(0);

  await after.run();
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe(UPSTREAM);
  expect(calls[0].init.method).toBe("POST");
  expect(JSON.parse(String(calls[0].init.body))).toEqual(tap);
  const headers = calls[0].init.headers as Record<string, string>;
  expect(headers["x-lead-ingest-token"]).toBe("synthetic-ingest-key");
  expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
});

test("the route asks for enough run time to finish the send after responding", () => {
  expect((analyticsRoute as Record<string, unknown>).maxDuration).toBe(30);
});

test("a standings URL still short-circuits before anything is registered or sent", async () => {
  for (const request of [
    event({ event_name: "page_view", page: "/standings/green/synthetic-capability", props: {} }),
    event({ event_name: "cta_click", page: "/schedule", props: { nested: [{ url: "/fall/standings/Green/synthetic-capability" }] } }),
    event({ event_name: "page_view", page: "/schedule" }, { referer: "https://nga.example.test/standings/green/synthetic-capability" }),
  ]) {
    const response = await POST(request);
    expect(response.status).toBe(204);
  }
  await after.run();
  expect(after.tasks).toHaveLength(0);
  expect(calls).toHaveLength(0);

  // Positive control: the same handler, same stubs, does send an ordinary event.
  await POST(event(tap));
  await after.run();
  expect(calls).toHaveLength(1);
});

test("missing env still answers 204 with nothing registered and nothing sent", async () => {
  for (const key of ENV) {
    const saved = process.env[key];
    delete process.env[key];
    const response = await POST(event(tap));
    expect(response.status).toBe(204);
    await after.run();
    expect(calls).toHaveLength(0);
    process.env[key] = saved;
  }
  // Positive control: with both present the send goes out.
  await POST(event(tap));
  await after.run();
  expect(calls).toHaveLength(1);
});

test("an unreadable body answers 204 and sends nothing", async () => {
  const response = await POST(new Request("https://nga.example.test/api/analytics", { method: "POST", body: "{not json" }));
  expect(response.status).toBe(204);
  await after.run();
  expect(calls).toHaveLength(0);
});

test("an upstream failure is logged without the payload, the response body or the token", async () => {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    upstreamStatus = 500;
    await POST(event(tap));
    await after.run();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: () => Promise.reject(new Error("synthetic network failure carrying synthetic-ingest-key")),
    });
    await POST(event(tap));
    await after.run();
  } finally {
    console.error = original;
  }
  expect(calls).toHaveLength(1);
  expect(logged).toHaveLength(2);
  const text = JSON.stringify(logged);
  expect(text).toContain("500");
  expect(text).not.toContain("synthetic-ingest-key");
  expect(text).not.toContain("synthetic upstream body");
  expect(text).not.toContain("switcher_linkanddink");
});
