import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the lib (mirrors invariant-crew-followup-egress).
process.env.CRON_SECRET = "test-cron-secret";
process.env.RESEND_API_KEY = "re_test";
// Keep the SMS fallback offline: sendSms() returns { skipped: "not_configured" }
// without touching the network when the TWILIO_* envs are absent.
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_FROM_NUMBER;
delete process.env.CRON_ALERT_LOGS_URL;
delete process.env.CRON_ALERT_SMS_TO;

import {
  buildCronAlertEmail,
  deliverCronAlert,
  rollupFailure,
  scrubPii,
  withCronAlert,
  type CronFailure,
  type CronRunResult,
} from "../src/lib/cron-alert";

const ALERT_TO = "sam.morris2131@gmail.com";
const ALERT_CC = "nextgenacademypb@gmail.com";

function req(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/cron/test-cron", {
    method: "GET",
    headers,
  });
}

function failing(failures: CronFailure[], attempted = 3, succeeded = 1): CronRunResult {
  return { attempted, succeeded, failures };
}

// ─── Alert-body builder ──────────────────────────────────────────────────────

test.describe("buildCronAlertEmail", () => {
  test("carries cron name, counts, signatures, refs, and a logs link", () => {
    const { subject, text } = buildCronAlertEmail(
      "dropin-reminder",
      failing([
        { signature: "resend_rejected", ref: "page-abc123", detail: "resend: 429 rate limited" },
        { signature: "flag_write_failed", ref: "page-def456" },
      ]),
    );
    expect(subject).toContain("[cron-alert]");
    expect(subject).toContain("dropin-reminder");
    expect(text).toContain("dropin-reminder");
    expect(text).toContain("Attempted: 3");
    expect(text).toContain("Succeeded: 1");
    expect(text).toContain("Failed: 2");
    expect(text).toContain("resend_rejected");
    expect(text).toContain("flag_write_failed");
    expect(text).toContain("page-abc123");
    expect(text).toContain("429 rate limited");
    expect(text.toLowerCase()).toContain("logs");
    expect(text).toContain("[cron/dropin-reminder]");
  });

  test("subject is stable across runs with the same failure signature (Gmail threading)", () => {
    const a = buildCronAlertEmail(
      "reconcile-cancelled-sessions",
      failing([{ signature: "session_cancel_fanout_failed", ref: "row-1", detail: "boom tick 1" }]),
    );
    const b = buildCronAlertEmail(
      "reconcile-cancelled-sessions",
      failing([{ signature: "session_cancel_fanout_failed", ref: "row-2", detail: "different detail, tick 2" }], 5, 4),
    );
    expect(a.subject).toBe(b.subject);
  });

  test("distinct signature sets produce distinct subjects", () => {
    const a = buildCronAlertEmail("x", failing([{ signature: "resend_rejected" }]));
    const b = buildCronAlertEmail("x", failing([{ signature: "notion_write_failed" }]));
    expect(a.subject).not.toBe(b.subject);
  });

  test("NO PII: emails/phones in failure details are scrubbed; extra fields never render", () => {
    const piiFailure = {
      signature: "resend_rejected",
      ref: "page-abc123",
      detail: "resend: mailbox parent.jane@example.com rejected; callback 301-325-9999",
      // Fields a careless call site might leave on the object — the builder
      // must render only signature/ref/detail, so these never appear.
      parentEmail: "parent.jane@example.com",
      childFirst: "Kiddotest",
      parentName: "Jane Piitest",
    } as unknown as CronFailure;

    const { subject, text } = buildCronAlertEmail("dropin-reminder", failing([piiFailure]));
    const rendered = subject + "\n" + text;
    expect(rendered).not.toContain("parent.jane@example.com");
    expect(rendered).not.toContain("Kiddotest");
    expect(rendered).not.toContain("Piitest");
    expect(rendered).not.toContain("301-325-9999");
    // The PII-free parts still land.
    expect(rendered).toContain("page-abc123");
    expect(rendered).toContain("resend_rejected");
  });

  test("caps the listed failures and says how many more (alert stays readable)", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      signature: "subscriber_send_failed",
      ref: `subscriber#${i}`,
    }));
    const { text } = buildCronAlertEmail("weekly-newsletter", failing(many, 25, 0));
    expect(text).toContain("subscriber#19");
    expect(text).not.toContain("subscriber#20");
    expect(text).toContain("5 more");
    expect(text).toContain("Failed: 25");
  });
});

test.describe("scrubPii", () => {
  test("redacts email addresses and US phone numbers, keeps ids and dates", () => {
    const out = scrubPii("row 557f01d8 on 2026-07-01: a@b.co / (301) 555-1234 failed");
    expect(out).not.toContain("a@b.co");
    expect(out).not.toContain("555-1234");
    expect(out).toContain("557f01d8");
    expect(out).toContain("2026-07-01");
  });

  // F8: the phone regex must be digit-boundary-guarded so a 10-digit run
  // INSIDE a longer number (ms timestamp, numeric ID) is never redacted.
  test("digit boundaries: a 13-digit ms timestamp and long numeric ids survive", () => {
    const out = scrubPii("enqueued at 1751371200000 for invoice 12345678901234567");
    expect(out).toContain("1751371200000");
    expect(out).toContain("12345678901234567");
    expect(out).not.toContain("redacted");
  });

  test("still redacts standalone 10-digit phones with/without separators and +1", () => {
    for (const phone of [
      "3013254731",
      "301-325-4731",
      "(301) 325-4731",
      "+1 301 325 4731",
      "+13013254731",
      "301.325.4731",
    ]) {
      expect(scrubPii(`call ${phone} now`), phone).toBe("call [phone redacted] now");
    }
  });
});

// ─── Wrapper: auth, statuses, alert egress ──────────────────────────────────

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("withCronAlert — auth (fail closed, matches existing cron routes)", () => {
  test("no Authorization → 401, zero downstream calls", async () => {
    const route = withCronAlert("test-cron", async () => ({
      attempted: 0,
      succeeded: 0,
      failures: [],
    }));
    const res = await route(req(undefined));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong token → 401, zero downstream calls", async () => {
    const route = withCronAlert("test-cron", async () => ({
      attempted: 0,
      succeeded: 0,
      failures: [],
    }));
    const res = await route(req("nope"));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("CRON_SECRET unset → 500 without running the handler", async () => {
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      let ran = false;
      const route = withCronAlert("test-cron", async () => {
        ran = true;
        return { attempted: 0, succeeded: 0, failures: [] };
      });
      const res = await route(req("test-cron-secret"));
      expect(res.status).toBe(500);
      expect(ran).toBe(false);
    } finally {
      process.env.CRON_SECRET = saved;
    }
  });
});

test.describe("withCronAlert — outcomes", () => {
  test("clean run → 200, ok:true, body merged, NO alert email", async () => {
    const route = withCronAlert("test-cron", async () => ({
      attempted: 4,
      succeeded: 4,
      failures: [],
      body: { widgets: 4, target_date_et: "2026-07-02" },
    }));
    const res = await route(req("test-cron-secret"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.widgets).toBe(4);
    expect(stub.callsTo("api.resend.com").length).toBe(0);
  });

  // F10: the wrapper derives the outcome from failures.length ALONE — a
  // handler with zero failure entries is a clean run even when succeeded <
  // attempted (e.g. rows legitimately skipped).
  test("empty failures → 200 even when succeeded < attempted (failures[] is the only failure signal)", async () => {
    const route = withCronAlert("test-cron", async () => ({
      attempted: 5,
      succeeded: 2,
      failures: [],
    }));
    const res = await route(req("test-cron-secret"));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(stub.callsTo("api.resend.com").length).toBe(0);
  });

  test("failures → 500 + ONE alert email to Sam (cc admin) with signature + counts", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    const route = withCronAlert("test-cron", async () => ({
      attempted: 3,
      succeeded: 1,
      failures: [
        { signature: "resend_rejected", ref: "page-1", detail: "resend: 500" },
        { signature: "resend_rejected", ref: "page-2", detail: "resend: 500" },
      ],
      body: { target_date_et: "2026-07-02" },
    }));
    const res = await route(req("test-cron-secret"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);

    const alerts = stub.callsTo("api.resend.com");
    expect(alerts.length, "exactly one alert email per failing run").toBe(1);
    expect(alerts[0].body).toContain(ALERT_TO);
    expect(alerts[0].body).toContain(ALERT_CC);
    expect(alerts[0].body).toContain("[cron-alert]");
    expect(alerts[0].body).toContain("resend_rejected");
    expect(alerts[0].body).toContain("test-cron");
  });

  // F9(a): detail stays in LOGS. The 500 body is a fixed generic shape — no
  // failure details, refs, exception text, or merged route body ride the
  // HTTP response.
  test("500 body is generic { ok, cron, error } — no failures, refs, or route body", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    const route = withCronAlert("test-cron", async () => ({
      attempted: 3,
      succeeded: 1,
      failures: [{ signature: "resend_rejected", ref: "page-1", detail: "resend: 500" }],
      body: { target_date_et: "2026-07-02" },
    }));
    const res = await route(req("test-cron-secret"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual(["cron", "error", "ok"]);
    expect(json).toEqual({ ok: false, cron: "test-cron", error: "run failed — see logs" });
  });

  test("handler throws → 500 + alert with unhandled_exception (cron can never die silently)", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    const route = withCronAlert("test-cron", async () => {
      throw new Error("notion exploded");
    });
    const res = await route(req("test-cron-secret"));
    expect(res.status).toBe(500);
    const alerts = stub.callsTo("api.resend.com");
    expect(alerts.length).toBe(1);
    expect(alerts[0].body).toContain("unhandled_exception");
  });

  // F9(b): regexes can't scrub child names out of arbitrary exception text
  // (drop-in rows are titled by child) — so the alert carries only the error
  // CLASS name; the raw message goes to console.error / the logs.
  test("thrown message text NEVER reaches the alert email or the 500 body — only the error class name does", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    class NotionRowError extends Error {}
    const route = withCronAlert("test-cron", async () => {
      throw new NotionRowError("row Kiddotest Piitest 2026-07-01 rejected");
    });
    const res = await route(req("test-cron-secret"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("Kiddotest");

    const alerts = stub.callsTo("api.resend.com");
    expect(alerts.length).toBe(1);
    expect(alerts[0].body).toContain("NotionRowError");
    expect(alerts[0].body).not.toContain("Kiddotest");
    expect(alerts[0].body).not.toContain("Piitest");
  });

  test("NO PII reaches the alert egress: emails/names in failures never hit the Resend payload", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    const route = withCronAlert("test-cron", async () => ({
      attempted: 1,
      succeeded: 0,
      failures: [
        {
          signature: "resend_rejected",
          ref: "page-xyz",
          detail: "resend: mailbox parent.jane@example.com rejected",
          parentEmail: "parent.jane@example.com",
          childFirst: "Kiddotest",
        } as unknown as CronFailure,
      ],
    }));
    await route(req("test-cron-secret"));
    const alerts = stub.callsTo("api.resend.com");
    expect(alerts.length).toBe(1);
    expect(alerts[0].body).not.toContain("parent.jane@example.com");
    expect(alerts[0].body).not.toContain("Kiddotest");
    expect(alerts[0].body).toContain("page-xyz");
  });
});

// ─── F4: alertEmailUtcHours throttle (Resend 100/day quota guard) ───────────

test.describe("withCronAlert — alertEmailUtcHours throttle", () => {
  const HOUR = new Date().getUTCHours();
  const failingHandler = async () => ({
    attempted: 2,
    succeeded: 0,
    failures: [{ signature: "resend_rejected", ref: "page-1" }],
  });

  test("current UTC hour IN the window → failing run still emails the alert", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    const route = withCronAlert("test-cron", failingHandler, {
      alertEmailUtcHours: [HOUR],
    });
    const res = await route(req("test-cron-secret"));
    expect(res.status).toBe(500);
    expect(stub.callsTo("api.resend.com").length).toBe(1);
  });

  test("current UTC hour OUTSIDE the window → 500 (dash stays red) but NO email and NO SMS", async () => {
    const route = withCronAlert("test-cron", failingHandler, {
      alertEmailUtcHours: [(HOUR + 1) % 24, (HOUR + 2) % 24],
    });
    const res = await route(req("test-cron-secret"));
    // Still red on the Vercel cron dashboard…
    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
    // …but zero alert egress of any kind: no email, and the SMS fallback must
    // NOT fire (it only escalates when an ATTEMPTED email fails, and a
    // throttled email was never attempted).
    expect(stub.calls.length).toBe(0);
  });

  test("clean run with a throttle window → 200, no alert either way", async () => {
    const route = withCronAlert(
      "test-cron",
      async () => ({ attempted: 1, succeeded: 1, failures: [] }),
      { alertEmailUtcHours: [(HOUR + 1) % 24] },
    );
    const res = await route(req("test-cron-secret"));
    expect(res.status).toBe(200);
    expect(stub.calls.length).toBe(0);
  });
});

// ─── Throttle WIRING: every sub-daily cron must cap its alert emails ─────────
//
// The wrapper honors alertEmailUtcHours (F4 above); this pins that each cron
// firing more than once a day per vercel.json actually PASSES it — a stuck
// dependency on an unthrottled 2-hourly cron would burn 12 alert emails/day
// from the shared Resend 100/day quota. OBSERVE-only source assertions (same
// pattern as invariant-camp-promo-code.spec.ts).

test.describe("alertEmailUtcHours wiring — sub-daily crons per vercel.json", () => {
  const SUB_DAILY = [
    { name: "coach-pre-event", schedule: "0 * * * *" },
    { name: "mark-passed-sessions", schedule: "0 * * * *" },
    { name: "reconcile-cancelled-sessions", schedule: "0 */2 * * *" },
  ];

  const vercelJson = JSON.parse(
    readFileSync(join(__dirname, "..", "vercel.json"), "utf8"),
  ) as { crons: Array<{ path: string; schedule: string }> };

  for (const { name, schedule } of SUB_DAILY) {
    test(`${name} runs sub-daily (${schedule}) and wires alertEmailUtcHours [0,6,12,18]`, () => {
      const cron = vercelJson.crons.find((c) => c.path === `/api/cron/${name}`);
      expect(cron?.schedule, `vercel.json schedule for ${name}`).toBe(schedule);

      const src = readFileSync(
        join(__dirname, "..", "src", "app", "api", "cron", name, "route.ts"),
        "utf8",
      );
      expect(src).toMatch(/alertEmailUtcHours:\s*\[0,\s*6,\s*12,\s*18\]/);
    });
  }
});

// ─── F5/F7: per-kind failure aggregation helper ─────────────────────────────

test.describe("rollupFailure — one entry per failure kind, not per row", () => {
  test("zero refs → null (no failure entry at all)", () => {
    expect(rollupFailure("invalid_parent_email", [], "row(s) with bad email")).toBeNull();
  });

  test("N refs → ONE entry carrying the count and every page-id ref", () => {
    const f = rollupFailure(
      "invalid_parent_email",
      ["page-a", "page-b", "page-c"],
      "row(s) with missing/malformed parent email",
    );
    expect(f).not.toBeNull();
    expect(f!.signature).toBe("invalid_parent_email");
    expect(f!.detail).toContain("3 row(s) with missing/malformed parent email");
    expect(f!.detail).toContain("page-a");
    expect(f!.detail).toContain("page-b");
    expect(f!.detail).toContain("page-c");
  });

  test("caps the listed refs and counts the remainder (alert stays readable)", () => {
    const refs = Array.from({ length: 30 }, (_, i) => `page-${i}`);
    const f = rollupFailure("invalid_parent_email", refs, "row(s)");
    expect(f!.detail).toContain("30 row(s)");
    expect(f!.detail).toContain("page-19");
    expect(f!.detail).not.toContain("page-20");
    expect(f!.detail).toContain("10 more");
  });
});

test.describe("deliverCronAlert — SMS fallback when the alert email itself fails", () => {
  test("Resend rejects → falls back to SMS (offline here: not_configured), never throws", async () => {
    // Resend returns a non-2xx → the SDK yields an error, not a send.
    stub.on("api.resend.com", { message: "nope" }, 500);
    const outcome = await deliverCronAlert(
      "test-cron",
      failing([{ signature: "resend_rejected", ref: "page-1" }]),
    );
    expect(outcome.emailed).toBe(false);
    // TWILIO_* env is unset in this spec, so the fallback is attempted and
    // reports skipped:not_configured — the branch itself is exercised.
    expect(outcome.sms).toBe("skipped_not_configured");
    expect(stub.callsTo("api.resend.com").length).toBe(1);
  });

  test("Resend accepts → no SMS attempt", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    const outcome = await deliverCronAlert(
      "test-cron",
      failing([{ signature: "resend_rejected" }]),
    );
    expect(outcome.emailed).toBe(true);
    expect(outcome.sms).toBe("not_attempted");
  });

  test("RESEND_API_KEY missing (the dead-key incident) → SMS fallback attempted", async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const outcome = await deliverCronAlert(
        "test-cron",
        failing([{ signature: "resend_not_configured" }]),
      );
      expect(outcome.emailed).toBe(false);
      expect(outcome.sms).toBe("skipped_not_configured");
      expect(stub.calls.length, "no network call without a key").toBe(0);
    } finally {
      process.env.RESEND_API_KEY = saved;
    }
  });
});
