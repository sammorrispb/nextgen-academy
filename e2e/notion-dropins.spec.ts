import { test, expect } from "@playwright/test";
import {
  classifyNotionFailure,
  createDropInRegistrationResult,
  type DropInRow,
} from "../src/lib/notion-dropins";

test.describe("classifyNotionFailure", () => {
  test("429 rate-limit is transient (worth a Stripe retry)", () => {
    expect(classifyNotionFailure(429)).toBe("transient");
  });

  test("5xx server errors are transient", () => {
    expect(classifyNotionFailure(500)).toBe("transient");
    expect(classifyNotionFailure(502)).toBe("transient");
    expect(classifyNotionFailure(503)).toBe("transient");
  });

  test("other 4xx are permanent (retry would fail identically)", () => {
    expect(classifyNotionFailure(400)).toBe("permanent");
    expect(classifyNotionFailure(401)).toBe("permanent");
    expect(classifyNotionFailure(404)).toBe("permanent");
    expect(classifyNotionFailure(422)).toBe("permanent");
  });
});

// Fail-soft on the optional `Source` attribution column. Regression guard for
// the 2026-06-13 Landon incident: #174 shipped a Source write before the Notion
// property existed, so every drop-in create 400'd and stranded paid parents
// unregistered. The roster row (source of truth for reminders/check-in/refunds)
// must survive a rejection that only concerns Source.
test.describe("createDropInRegistrationResult — Source fail-soft", () => {
  const realFetch = globalThis.fetch;
  const realKey = process.env.NOTION_API_KEY;
  const realDb = process.env.NOTION_DROPINS_DB_ID;

  function row(overrides: Partial<DropInRow> = {}): DropInRow {
    return {
      parentName: "Test Parent",
      parentEmail: "parent@example.com",
      parentPhone: "",
      childFirstName: "Kid",
      childBirthYear: 2015,
      sessionTitle: "Walter Johnson HS",
      sessionDate: "2026-06-14",
      sessionStartTime: "10:00 AM",
      location: "Walter Johnson HS",
      publicArea: "",
      locationHidden: false,
      level: null,
      amountPaidUsd: 20,
      stripeCheckoutSessionId: "cs_test_failsoft",
      stripePaymentIntentId: "pi_test",
      displayConsent: false,
      smsConsent: false,
      smsConsentText: "",
      source: "Website",
      ...overrides,
    };
  }

  type Call = { propertyKeys: string[] };
  let calls: Call[];

  // Queue of responses the stub returns in order; each call shifts one.
  function stubFetch(responses: Array<{ ok: boolean; status: number; body?: string }>) {
    const queue = [...responses];
    globalThis.fetch = (async (_url: string, init?: { body?: string }) => {
      const parsed = init?.body ? JSON.parse(init.body) : {};
      calls.push({ propertyKeys: Object.keys(parsed.properties ?? {}) });
      const r = queue.shift() ?? { ok: false, status: 500, body: "{}" };
      return {
        ok: r.ok,
        status: r.status,
        text: async () => r.body ?? "",
      };
    }) as unknown as typeof fetch;
  }

  test.beforeEach(() => {
    process.env.NOTION_API_KEY = "test-key";
    process.env.NOTION_DROPINS_DB_ID = "test-db";
    calls = [];
  });

  test.afterEach(() => {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.NOTION_API_KEY;
    else process.env.NOTION_API_KEY = realKey;
    if (realDb === undefined) delete process.env.NOTION_DROPINS_DB_ID;
    else process.env.NOTION_DROPINS_DB_ID = realDb;
  });

  test("Source-named rejection retries WITHOUT Source and the row still lands", async () => {
    stubFetch([
      { ok: false, status: 400, body: "Source is not a property that exists." },
      { ok: true, status: 200, body: "{}" },
    ]);

    const result = await createDropInRegistrationResult(row());

    expect(result).toBe("ok");
    expect(calls).toHaveLength(2);
    // First attempt carried Source; the retry dropped it so the core row lands.
    expect(calls[0].propertyKeys).toContain("Source");
    expect(calls[1].propertyKeys).not.toContain("Source");
    // Everything else the row needs is still present on the retry.
    expect(calls[1].propertyKeys).toContain("Registration");
    expect(calls[1].propertyKeys).toContain("Stripe Checkout Session ID");
  });

  test("happy path writes Source once, no retry", async () => {
    stubFetch([{ ok: true, status: 200, body: "{}" }]);

    const result = await createDropInRegistrationResult(row());

    expect(result).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0].propertyKeys).toContain("Source");
  });

  test("a permanent rejection NOT about Source is not masked by the retry", async () => {
    // e.g. an invalid Status option — retrying without Source must not hide it.
    stubFetch([
      { ok: false, status: 400, body: "Status is expected to be select." },
    ]);

    const result = await createDropInRegistrationResult(row());

    expect(result).toBe("permanent");
    expect(calls).toHaveLength(1); // no retry
  });

  test("transient failure is not retried as a Source problem", async () => {
    stubFetch([{ ok: false, status: 503, body: "service unavailable" }]);

    const result = await createDropInRegistrationResult(row());

    expect(result).toBe("transient");
    expect(calls).toHaveLength(1);
  });
});
