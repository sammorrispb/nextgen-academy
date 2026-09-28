import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE import (the module reads it per call, but keep the convention).
// Spec files can share a worker, so every key touched here is restored in
// afterAll. The failure alert emails through Resend, whose fetch-based SDK
// the stub sees; the TWILIO_* keys are cleared so its SMS fallback can never
// text a real number from a test run (sendSms() self-skips without them).
const TOUCHED_ENV = [
  "NGA_SYNC_SECRET",
  "RESEND_API_KEY",
  "VERCEL_ENV",
  "LINKDINK_BASE_URL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "CRON_ALERT_SMS_TO",
  "CRON_ALERT_LOGS_URL",
] as const;
const savedEnv = Object.fromEntries(TOUCHED_ENV.map((k) => [k, process.env[k]]));

const SYNC_SECRET = "test-nga-sync-secret-7f3a";
process.env.NGA_SYNC_SECRET = SYNC_SECRET;
process.env.RESEND_API_KEY = "re_test_alert_key";
process.env.VERCEL_ENV = "production";
for (const key of TOUCHED_ENV.slice(3)) delete process.env[key];

import { syncMvfRegistrationToLinkDink } from "../src/lib/linkdink-roster-sync";

// THE Link & Dink egress invariant (MVF Junior Tournament roster sync). A
// registrant's child first + last name leave NGA for exactly one destination,
// the L&D roster endpoint, from a production deploy only, in a body of exactly
// four fields: the stable division event key, the child's first and last
// name, and the parent's email (L&D's idempotency-key input, never stored
// there). No phone, DOB, allergies or emergency contact, and never one event
// row's exact slug. A failed sync alerts Sam without any child or parent data
// in the alert or the logs.
const ENDPOINT = "https://www.linkanddink.com/play/api/internal/nga-roster-add";
const CHILD_FIRST = "Egresskidfirst";
const CHILD_LAST = "Egresskidlast";
const PARENT_EMAIL = "egress.parent@example.com";
const PARENT_PHONE = "3015550187";
const PII = [CHILD_FIRST, CHILD_LAST, PARENT_EMAIL, PARENT_PHONE];

function registration(division: string) {
  return {
    division,
    childFirstName: CHILD_FIRST,
    childLastName: CHILD_LAST,
    parentEmail: PARENT_EMAIL,
    parentPhone: PARENT_PHONE,
  };
}

const stub = new FetchStub();
// FetchStub records url/method/body; the request options are captured here.
let sentInits: RequestInit[] = [];
// Log lines are asserted ONLY for the absence of PII (hostile review item 1:
// a log line is an echo surface), never for their wording.
let logged: string[] = [];
const originalConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
  info: console.info,
};

test.beforeEach(() => {
  stub.reset();
  sentInits = [];
  logged = [];
  process.env.NGA_SYNC_SECRET = SYNC_SECRET;
  process.env.VERCEL_ENV = "production";
  delete process.env.LINKDINK_BASE_URL;
  for (const level of ["error", "warn", "log", "info"] as const) {
    console[level] = (...args: unknown[]) => {
      logged.push(
        args
          .map((a) =>
            a instanceof Error
              ? `${a.name}: ${a.message}`
              : typeof a === "string"
                ? a
                : JSON.stringify(a),
          )
          .join(" "),
      );
    };
  }
});

test.afterEach(() => {
  stub.uninstall();
  Object.assign(console, originalConsole);
});

test.afterAll(() => {
  for (const key of TOUCHED_ENV) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function install(): void {
  stub.install();
  const stubbed = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    sentInits.push(init ?? {});
    return stubbed(input, init);
  }) as typeof globalThis.fetch;
}

function expectNoPii(text: string, where: string): void {
  for (const value of PII) {
    expect(
      text.toLowerCase(),
      `${where} carries registrant PII (${value})`,
    ).not.toContain(value.toLowerCase());
  }
}

test.describe("Link & Dink roster sync egress (MVF Junior Tournament)", () => {
  test("one POST per registration to the L&D roster endpoint: stable event key + exactly four fields", async () => {
    stub.on("www.linkanddink.com/play/api/internal/nga-roster-add", {
      ok: true,
      rsvpId: "rsvp_test",
      alreadyOnRoster: false,
      playerId: "player_test",
    });
    install();

    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(true);
    expect(await syncMvfRegistrationToLinkDink(registration("14u"))).toBe(true);

    expect(stub.calls).toHaveLength(2);
    const expectedKeys = [
      "mvf-junior-tournament-10u-2026-10-24",
      "mvf-junior-tournament-14u-2026-10-24",
    ];
    stub.calls.forEach((call, i) => {
      expect(call.method).toBe("POST");
      expect(call.url).toBe(ENDPOINT);

      const body = JSON.parse(call.body) as Record<string, unknown>;
      // The allowlist. Anything else (a phone, DOB, allergies, an emergency
      // contact, an exact event_slug) is a new field leaving NGA.
      expect(Object.keys(body).sort()).toEqual([
        "email",
        "event_key",
        "first_name",
        "last_name",
      ]);
      expect(body).toEqual({
        event_key: expectedKeys[i],
        first_name: CHILD_FIRST,
        last_name: CHILD_LAST,
        email: PARENT_EMAIL,
      });
      // The division key, never one event row's re-creation slug: L&D
      // cancelled …-10u-2026-10-24-3 and …-14u-2026-10-24-2 and the exact
      // slugs 409'd every sync.
      expect(String(body.event_key)).not.toMatch(/-2026-10-24-\d+$/);
      expect(call.body).not.toContain(PARENT_PHONE);

      // Auth rides a header, never the URL.
      const init = sentInits[i];
      expect(new Headers(init.headers).get("x-nga-sync-secret")).toBe(SYNC_SECRET);
      expect(call.url).not.toContain(SYNC_SECRET);
      // A redirect would carry that header and the body to another origin.
      expect(init.redirect).toBe("error");
      // A hung L&D call is cut off, because the checkout route waits on it.
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  test("already on the roster (a retry) counts as success and does not alert", async () => {
    stub.on("www.linkanddink.com", {
      ok: true,
      rsvpId: "rsvp_test",
      alreadyOnRoster: true,
      playerId: "player_test",
    });
    install();

    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(true);
    expect(stub.calls).toHaveLength(1);
  });

  test("only a production deploy sends; preview and local builds stay off the live roster", async () => {
    stub
      .on("localhost:3001/play/api/internal/nga-roster-add", {
        ok: true,
        rsvpId: "rsvp_test",
        alreadyOnRoster: false,
        playerId: "player_test",
      })
      .on("api.resend.com", { id: "email_alert" });
    install();

    // The secret is set, which is exactly the drift this guards against.
    for (const env of ["preview", "development", undefined]) {
      if (env === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = env;
      expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(false);
    }
    expect(stub.calls).toHaveLength(0);

    // An explicit LINKDINK_BASE_URL is the deliberate way to point a
    // non-production build at an L&D instance (e.g. a local p3).
    process.env.LINKDINK_BASE_URL = "http://localhost:3001";
    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(true);
    expect(stub.calls.map((c) => c.url)).toEqual([
      "http://localhost:3001/play/api/internal/nga-roster-add",
    ]);
    for (const line of logged) expectNoPii(line, "a log line");
  });

  test("an L&D refusal (409 event_cancelled) returns false, never throws, and alerts without registrant PII", async () => {
    stub
      .on(
        "www.linkanddink.com",
        {
          error: "event_cancelled",
          reason: "every event under this key is cancelled",
          event_key: "mvf-junior-tournament-10u-2026-10-24",
          slugs: ["mvf-junior-tournament-10u-2026-10-24-3"],
        },
        409,
      )
      .on("api.resend.com", { id: "email_alert" });
    install();

    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(false);

    const alerts = stub.callsTo("api.resend.com");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].body).toContain("event_cancelled");
    expect(alerts[0].body).toContain("mvf-junior-tournament-10u-2026-10-24");
    expectNoPii(alerts[0].body, "the alert email");
    expect(logged.length).toBeGreaterThan(0);
    for (const line of logged) expectNoPii(line, "a log line");
  });

  test("an L&D error body that echoes the registrant never reaches the log or the alert", async () => {
    // A Postgres failure message can quote the failing row; only L&D's error
    // CODE may travel on, and an unknown code is reported by status alone.
    let reply = 0;
    stub
      .onDynamic("www.linkanddink.com", () => {
        reply += 1;
        return reply === 1
          ? {
              status: 500,
              json: {
                error: "player_create_failed",
                reason: `Failing row contains (${CHILD_FIRST}, ${CHILD_LAST}, ${PARENT_EMAIL})`,
              },
            }
          : { status: 500, json: { error: CHILD_FIRST.toLowerCase() } };
      })
      .on("api.resend.com", { id: "email_alert" });
    install();

    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(false);
    expect(await syncMvfRegistrationToLinkDink(registration("14u"))).toBe(false);

    const alerts = stub.callsTo("api.resend.com");
    expect(alerts).toHaveLength(2);
    expect(alerts[0].body).toContain("player_create_failed");
    expect(alerts[1].body).toContain("http_500");
    for (const alert of alerts) expectNoPii(alert.body, "the alert email");
    for (const line of logged) expectNoPii(line, "a log line");
  });

  test("a network failure or timeout returns false, never throws, and alerts without registrant PII", async () => {
    stub
      .onDynamic("www.linkanddink.com", () => {
        throw new TypeError("fetch failed");
      })
      .on("api.resend.com", { id: "email_alert" });
    install();

    expect(await syncMvfRegistrationToLinkDink(registration("14u"))).toBe(false);

    const alerts = stub.callsTo("api.resend.com");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].body).toContain("request_failed");
    expectNoPii(alerts[0].body, "the alert email");
    for (const line of logged) expectNoPii(line, "a log line");
  });

  test("a 2xx without ok:true is a failure and alerts", async () => {
    stub
      .on("www.linkanddink.com", {})
      .on("api.resend.com", { id: "email_alert" });
    install();

    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(false);
    expect(stub.callsTo("api.resend.com")).toHaveLength(1);
    for (const line of logged) expectNoPii(line, "a log line");
  });

  test("fails closed without NGA_SYNC_SECRET: zero L&D calls, and production alerts under its own signature", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    install();

    delete process.env.NGA_SYNC_SECRET;
    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(false);
    process.env.NGA_SYNC_SECRET = "";
    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(false);

    expect(stub.callsTo("linkanddink.com")).toHaveLength(0);
    const alerts = stub.callsTo("api.resend.com");
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) {
      // Distinct from L&D's own 503 not_configured, which needs a p3 fix.
      expect(alert.body).toContain("nga_secret_unset");
      expectNoPii(alert.body, "the alert email");
    }
  });

  test("a division with no L&D event makes zero L&D calls and alerts once each, prototype keys included", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    install();

    const divisions = ["12u", "", "constructor", "__proto__", "toString"];
    for (const division of divisions) {
      expect(await syncMvfRegistrationToLinkDink(registration(division))).toBe(false);
    }
    expect(stub.callsTo("linkanddink.com")).toHaveLength(0);
    const alerts = stub.callsTo("api.resend.com");
    expect(alerts).toHaveLength(divisions.length);
    for (const alert of alerts) {
      expect(alert.body).toContain("unknown_division");
      expectNoPii(alert.body, "the alert email");
    }
    for (const line of logged) expectNoPii(line, "a log line");
  });
});
