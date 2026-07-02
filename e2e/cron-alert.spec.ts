import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
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
  return { ok: false, attempted, succeeded, failures };
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
      ok: true,
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
      ok: true,
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
        return { ok: true, attempted: 0, succeeded: 0, failures: [] };
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
      ok: true,
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

  test("failures → 500, ok:false, ONE alert email to Sam (cc admin) with signature + counts", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    const route = withCronAlert("test-cron", async () => ({
      ok: false,
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
    expect(json.failures.length).toBe(2);

    const alerts = stub.callsTo("api.resend.com");
    expect(alerts.length, "exactly one alert email per failing run").toBe(1);
    expect(alerts[0].body).toContain(ALERT_TO);
    expect(alerts[0].body).toContain(ALERT_CC);
    expect(alerts[0].body).toContain("[cron-alert]");
    expect(alerts[0].body).toContain("resend_rejected");
    expect(alerts[0].body).toContain("test-cron");
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
    expect(alerts[0].body).toContain("notion exploded");
  });

  test("NO PII reaches the alert egress: emails/names in failures never hit the Resend payload", async () => {
    stub.on("api.resend.com", { id: "email_alert" });
    const route = withCronAlert("test-cron", async () => ({
      ok: false,
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
