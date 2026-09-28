import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE import. The L&D base URL is read at module load: leave it unset so
// this spec exercises the production default (www.linkanddink.com). The failure
// alert emails through Resend, whose fetch-based SDK the stub sees.
const SYNC_SECRET = "test-nga-sync-secret-7f3a";
process.env.NGA_SYNC_SECRET = SYNC_SECRET;
process.env.RESEND_API_KEY = "re_test_alert_key";
delete process.env.LINKDINK_BASE_URL;
delete process.env.VERCEL_ENV;

import { syncMvfRegistrationToLinkDink } from "../src/lib/linkdink-roster-sync";

// THE Link & Dink egress invariant (MVF Junior Tournament roster sync). A
// registrant's child first + last name leave NGA for exactly one destination,
// the L&D roster endpoint, in a body of exactly four fields: the stable
// division event key, the child's first and last name, and the parent's email
// (L&D's idempotency-key input, never stored there). No phone, DOB, allergies
// or emergency contact, and never one event row's exact slug. A failed sync
// alerts Sam without any child or parent data in the alert or the logs.
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
// FetchStub records url/method/body; the auth header is captured here.
let sentHeaders: Headers[] = [];
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
  sentHeaders = [];
  logged = [];
  process.env.NGA_SYNC_SECRET = SYNC_SECRET;
  delete process.env.VERCEL_ENV;
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

function install(): void {
  stub.install();
  const stubbed = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    sentHeaders.push(new Headers(init?.headers));
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
      expect(sentHeaders[i].get("x-nga-sync-secret")).toBe(SYNC_SECRET);
      expect(call.url).not.toContain(SYNC_SECRET);
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

  test("fails closed without NGA_SYNC_SECRET: zero L&D calls; production alerts, preview and local stay quiet", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    install();

    // Preview and local builds carry no secret by design: no call anywhere.
    delete process.env.NGA_SYNC_SECRET;
    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(false);
    process.env.NGA_SYNC_SECRET = "";
    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(false);
    expect(stub.calls).toHaveLength(0);

    // Production without the secret is a silent-off sync: Sam hears about it.
    process.env.VERCEL_ENV = "production";
    expect(await syncMvfRegistrationToLinkDink(registration("10u"))).toBe(false);
    expect(stub.callsTo("linkanddink.com")).toHaveLength(0);
    const alerts = stub.callsTo("api.resend.com");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].body).toContain("not_configured");
    expectNoPii(alerts[0].body, "the alert email");
  });

  test("a division with no L&D event makes zero L&D calls, prototype keys included", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    install();

    for (const division of ["12u", "", "constructor", "__proto__", "toString"]) {
      expect(await syncMvfRegistrationToLinkDink(registration(division))).toBe(false);
    }
    expect(stub.callsTo("linkanddink.com")).toHaveLength(0);
    for (const alert of stub.callsTo("api.resend.com")) {
      expectNoPii(alert.body, "the alert email");
    }
    for (const line of logged) expectNoPii(line, "a log line");
  });
});
