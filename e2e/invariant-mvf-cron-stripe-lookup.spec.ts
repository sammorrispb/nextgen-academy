import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";

// Incident 2026-10-19: the MVF pre-event reminder reached 1 of 10 paid
// families. Nine invoices lived on an older Stripe account, so every
// `invoices.retrieve` threw `resource_missing`, and the idempotency check's
// catch counted the row as skipped. No failure entry, so withCronAlert
// returned 200 and sent no alert. These specs pin the opposite: a row a cron
// can't handle is reported, the batch keeps going, and the run goes red.
//
// Stripe rides node http (FetchStub can't see it), so the pre-event engine
// takes an injected invoice store and the payment-reminder route reads a
// patched getStripe() singleton. Notion and Resend ride fetch: the alert
// email itself is a Resend call, told apart from parent sends by recipient.

const ENV = [
  "CRON_SECRET",
  "RESEND_API_KEY",
  "NOTION_API_KEY",
  "NOTION_MVF_TOURNAMENT_REGS_DB_ID",
  "STRIPE_SECRET_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "CRON_ALERT_SMS_TO",
] as const;
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";

import { withCronAlert } from "../src/lib/cron-alert";
import {
  runMvfTournamentPreEventReminder,
  type PreEventInvoiceStore,
} from "../src/lib/mvf-tournament-pre-event-run";
import { MVF_TOURNAMENT_PRE_EVENT_SEND_DATE_ISO } from "../src/lib/email/mvf-tournament-pre-event-reminder";
import { GET as paymentReminder } from "../src/app/api/cron/mvf-tournament-payment-reminder/route";
import { getStripe } from "../src/lib/stripe";

const ALERT_TO = "sam.morris2131@gmail.com";
const OLD = "in_1ULoldAcct7210nhTc4jSynthetic";
const GOOD = "in_1TUgoodBpXOfTC961Synthetic";
const OLD_EMAIL = "old-account-parent@example.com";
const GOOD_EMAIL = "current-account-parent@example.com";
const LONG_AGO = "2026-10-01T12:00:00.000Z";

type Behaviour = "missing" | "fresh" | "flagged" | "paid";

interface FakeRow {
  id: string;
  email: string;
  invoice: string;
  created?: string;
}

function page(r: FakeRow) {
  return {
    id: r.id,
    created_time: r.created ?? LONG_AGO,
    properties: {
      "Parent Name": { title: [{ plain_text: "Synthetic Parent" }] },
      "Parent Email": { email: r.email },
      "Child First Name": { rich_text: [{ plain_text: "Synthkid" }] },
      Division: { select: { name: "10U" } },
      Resident: { checkbox: true },
      "Amount Paid": { number: 25 },
      "Stripe Invoice ID": {
        rich_text: r.invoice ? [{ plain_text: r.invoice }] : [],
      },
    },
  };
}

class FakeInvoices {
  readonly retrieved: string[] = [];
  readonly updates: Array<{ id: string; metadata: Record<string, string> }> = [];
  failUpdates = false;
  constructor(private readonly behaviour: Record<string, Behaviour>) {}

  async retrieve(id: string) {
    this.retrieved.push(id);
    const b = this.behaviour[id];
    if (!b || b === "missing") {
      throw Object.assign(new Error(`No such invoice: '${id}'`), {
        type: "StripeInvalidRequestError",
        code: "resource_missing",
      });
    }
    return {
      id,
      status: b === "paid" ? "paid" : "open",
      hosted_invoice_url: `https://invoice.stripe.com/i/${id}`,
      metadata:
        b === "flagged"
          ? { pre_event_reminder_sent: "true", payment_reminder_sent: "true" }
          : { kind: "mvf-junior-tournament" },
    };
  }

  async update(id: string, params: { metadata: Record<string, string> }) {
    if (this.failUpdates) {
      throw Object.assign(new Error("Stripe is down"), { code: "api_error" });
    }
    this.updates.push({ id, metadata: params.metadata });
    return { id };
  }
}

const stub = new FetchStub();

function installServices(rows: FakeRow[]) {
  stub.reset();
  stub.on("api.notion.com/v1/databases/", {
    results: rows.map(page),
    has_more: false,
    next_cursor: null,
  });
  stub.on("api.resend.com/emails", { id: "synthetic-email-id" });
  stub.install();
}

function sends() {
  return stub.callsTo("api.resend.com/emails").map((c) => {
    const body = JSON.parse(c.body);
    return { to: [body.to].flat() as string[], subject: String(body.subject), text: String(body.text) };
  });
}
const parentSends = () => sends().filter((s) => !s.to.includes(ALERT_TO));
const alerts = () => sends().filter((s) => s.to.includes(ALERT_TO));

function cronRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

test.beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
  process.env.RESEND_API_KEY = "re_test_mvf_cron";
  process.env.NOTION_API_KEY = "ntn_test_mvf_cron";
  process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID = "db-mvf-synthetic";
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;
  delete process.env.CRON_ALERT_SMS_TO;
});
test.afterEach(() => stub.uninstall());
test.afterAll(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

test.describe("pre-event reminder: a failed invoice lookup is reported, not skipped", () => {
  // The real route composed with the send date pinned; the route itself
  // never overrides the date.
  function preEvent(fake: FakeInvoices) {
    return withCronAlert("mvf-tournament-pre-event-reminder", () =>
      runMvfTournamentPreEventReminder({
        todayIso: MVF_TOURNAMENT_PRE_EVENT_SEND_DATE_ISO,
        stripe: { invoices: fake } as unknown as PreEventInvoiceStore,
      }),
    )(cronRequest("/api/cron/mvf-tournament-pre-event-reminder"));
  }

  test("a lookup that throws: no parent email, the run goes red, Sam gets an alert naming the row", async () => {
    installServices([{ id: "page-old-1", email: OLD_EMAIL, invoice: OLD }]);
    const fake = new FakeInvoices({ [OLD]: "missing" });

    const res = await preEvent(fake);

    expect(res.status).toBe(500);
    expect(parentSends()).toEqual([]);
    expect(fake.updates).toEqual([]);
    const [alert, ...more] = alerts();
    expect(more).toEqual([]);
    expect(alert.subject).toContain("stripe_lookup_failed");
    expect(alert.text).toContain("page-old-1");
    expect(alert.text).toContain("resource_missing");
    expect(alert.text).not.toContain(OLD_EMAIL);
    expect(alert.text).not.toContain("Synthetic Parent");
  });

  test("a lookup that succeeds: the parent is emailed and the invoice flagged, 200, no alert", async () => {
    installServices([{ id: "page-good-1", email: GOOD_EMAIL, invoice: GOOD }]);
    const fake = new FakeInvoices({ [GOOD]: "fresh" });

    const res = await preEvent(fake);

    expect(res.status).toBe(200);
    expect(parentSends().map((s) => s.to)).toEqual([[GOOD_EMAIL]]);
    expect(fake.updates).toEqual([{ id: GOOD, metadata: { pre_event_reminder_sent: "true" } }]);
    expect(alerts()).toEqual([]);
  });

  test("the 2026-10-19 shape: one bad lookup among good rows still emails the good rows, and one alert covers the batch", async () => {
    installServices([
      { id: "page-old-1", email: OLD_EMAIL, invoice: OLD },
      { id: "page-good-1", email: GOOD_EMAIL, invoice: GOOD },
      { id: "page-old-2", email: "old-account-two@example.com", invoice: `${OLD}2` },
    ]);
    const fake = new FakeInvoices({ [GOOD]: "fresh" });

    const res = await preEvent(fake);

    expect(res.status).toBe(500);
    expect(parentSends().map((s) => s.to)).toEqual([[GOOD_EMAIL]]);
    expect(fake.updates.map((u) => u.id)).toEqual([GOOD]);
    const [alert, ...more] = alerts();
    expect(more).toEqual([]);
    expect(alert.text).toMatch(/2 paid row\(s\) not emailed/);
    expect(alert.text).toContain("page-old-1");
    expect(alert.text).toContain("page-old-2");
    expect(alert.text).not.toContain("page-good-1");
  });

  test("an invoice already flagged is skipped quietly: no email, 200", async () => {
    installServices([{ id: "page-good-1", email: GOOD_EMAIL, invoice: GOOD }]);
    const fake = new FakeInvoices({ [GOOD]: "flagged" });

    const res = await preEvent(fake);

    expect(res.status).toBe(200);
    expect(sends()).toEqual([]);
  });

  test("a sent-flag that won't save is reported, after the parent was emailed", async () => {
    installServices([{ id: "page-good-1", email: GOOD_EMAIL, invoice: GOOD }]);
    const fake = new FakeInvoices({ [GOOD]: "fresh" });
    fake.failUpdates = true;

    const res = await preEvent(fake);

    expect(res.status).toBe(500);
    expect(parentSends().map((s) => s.to)).toEqual([[GOOD_EMAIL]]);
    expect(alerts()[0].subject).toContain("flag_write_failed");
  });

  test("a paid row with a malformed parent email is reported, not skipped", async () => {
    installServices([{ id: "page-bad-email", email: "parent@example.con@", invoice: GOOD }]);
    const fake = new FakeInvoices({ [GOOD]: "fresh" });

    const res = await preEvent(fake);

    expect(res.status).toBe(500);
    expect(parentSends()).toEqual([]);
    expect(alerts()[0].subject).toContain("invalid_parent_email");
    expect(alerts()[0].text).toContain("page-bad-email");
  });

  test("the route runs the engine on the real ET date, with no way to override it", () => {
    // A date override on a live cron is a re-send button for every family.
    const src = readFileSync(
      join(__dirname, "..", "src", "app", "api", "cron", "mvf-tournament-pre-event-reminder", "route.ts"),
      "utf8",
    );
    expect(src).toMatch(/runMvfTournamentPreEventReminder\(\s*\)/);
    expect(src).not.toMatch(/todayIso|searchParams|nextUrl/);
  });

  test("off the send date it reads nothing and sends nothing", async () => {
    installServices([{ id: "page-good-1", email: GOOD_EMAIL, invoice: GOOD }]);
    const fake = new FakeInvoices({ [GOOD]: "fresh" });

    const result = await runMvfTournamentPreEventReminder({
      todayIso: "2026-10-18",
      stripe: { invoices: fake } as unknown as PreEventInvoiceStore,
    });

    expect(result.failures).toEqual([]);
    expect(stub.calls).toEqual([]);
    expect(fake.retrieved).toEqual([]);
  });
});

test.describe("payment reminder: every due row it can't remind is reported", () => {
  let fake: FakeInvoices;
  let restore: () => void;

  function patchStripe(behaviour: Record<string, Behaviour>) {
    fake = new FakeInvoices(behaviour);
    const stripe = getStripe();
    const { retrieve, update } = stripe.invoices;
    stripe.invoices.retrieve = fake.retrieve.bind(fake) as unknown as typeof retrieve;
    stripe.invoices.update = fake.update.bind(fake) as unknown as typeof update;
    restore = () => {
      stripe.invoices.retrieve = retrieve;
      stripe.invoices.update = update;
    };
  }
  test.afterEach(() => restore?.());

  const run = () => paymentReminder(cronRequest("/api/cron/mvf-tournament-payment-reminder"));

  test("a lookup that throws: no parent email, the run goes red, Sam gets an alert naming the row", async () => {
    installServices([{ id: "page-old-1", email: OLD_EMAIL, invoice: OLD }]);
    patchStripe({ [OLD]: "missing" });

    const res = await run();

    expect(res.status).toBe(500);
    expect(parentSends()).toEqual([]);
    expect(fake.updates).toEqual([]);
    const [alert, ...more] = alerts();
    expect(more).toEqual([]);
    expect(alert.subject).toContain("stripe_lookup_failed");
    expect(alert.text).toContain("page-old-1");
    expect(alert.text).toContain("resource_missing");
    expect(alert.text).not.toContain(OLD_EMAIL);
  });

  test("an open invoice: the parent gets the pay link and the invoice is flagged, 200", async () => {
    installServices([{ id: "page-good-1", email: GOOD_EMAIL, invoice: GOOD }]);
    patchStripe({ [GOOD]: "fresh" });

    const res = await run();

    expect(res.status).toBe(200);
    const [send, ...more] = parentSends();
    expect(more).toEqual([]);
    expect(send.to).toEqual([GOOD_EMAIL]);
    expect(send.text).toContain(`https://invoice.stripe.com/i/${GOOD}`);
    expect(fake.updates).toEqual([
      { id: GOOD, metadata: { kind: "mvf-junior-tournament", payment_reminder_sent: "true" } },
    ]);
    expect(alerts()).toEqual([]);
  });

  test("one bad lookup among good rows: the good row is still reminded, one alert covers the bad one", async () => {
    installServices([
      { id: "page-old-1", email: OLD_EMAIL, invoice: OLD },
      { id: "page-good-1", email: GOOD_EMAIL, invoice: GOOD },
    ]);
    patchStripe({ [GOOD]: "fresh" });

    const res = await run();

    expect(res.status).toBe(500);
    expect(parentSends().map((s) => s.to)).toEqual([[GOOD_EMAIL]]);
    const [alert, ...more] = alerts();
    expect(more).toEqual([]);
    expect(alert.text).toContain("page-old-1");
    expect(alert.text).not.toContain("page-good-1");
  });

  test("a sent-flag that won't save no longer ends the run: the next family is still reminded", async () => {
    installServices([
      { id: "page-good-1", email: GOOD_EMAIL, invoice: GOOD },
      { id: "page-good-2", email: "second-parent@example.com", invoice: `${GOOD}2` },
    ]);
    patchStripe({ [GOOD]: "fresh", [`${GOOD}2`]: "fresh" });
    fake.failUpdates = true;

    const res = await run();

    expect(res.status).toBe(500);
    expect(parentSends().map((s) => s.to)).toEqual([[GOOD_EMAIL], ["second-parent@example.com"]]);
    const [alert] = alerts();
    expect(alert.subject).toContain("flag_write_failed");
    expect(alert.subject).not.toContain("unhandled_exception");
    expect(alert.text).toContain("page-good-1");
    expect(alert.text).toContain("page-good-2");
  });

  test("paid, already-reminded and not-yet-due rows are skipped quietly: no email, 200", async () => {
    installServices([
      { id: "page-paid", email: GOOD_EMAIL, invoice: `${GOOD}paid` },
      { id: "page-flagged", email: GOOD_EMAIL, invoice: `${GOOD}flagged` },
      // Created just now, so not due for five days; its lookup would throw.
      { id: "page-new", email: OLD_EMAIL, invoice: OLD, created: new Date().toISOString() },
    ]);
    patchStripe({ [`${GOOD}paid`]: "paid", [`${GOOD}flagged`]: "flagged" });

    const res = await run();

    expect(res.status).toBe(200);
    expect(sends()).toEqual([]);
    expect(fake.retrieved).not.toContain(OLD);
  });

  test("an unpaid row with no invoice id is reported", async () => {
    installServices([{ id: "page-no-invoice", email: GOOD_EMAIL, invoice: "" }]);
    patchStripe({});

    const res = await run();

    expect(res.status).toBe(500);
    expect(parentSends()).toEqual([]);
    expect(alerts()[0].subject).toContain("missing_invoice_id");
    expect(alerts()[0].text).toContain("page-no-invoice");
  });

  test("a malformed parent email alerts only when the reminder is actually due", async () => {
    installServices([
      { id: "page-due-bad-email", email: "not-an-email", invoice: GOOD },
      { id: "page-paid-bad-email", email: "not-an-email", invoice: `${GOOD}paid` },
    ]);
    patchStripe({ [GOOD]: "fresh", [`${GOOD}paid`]: "paid" });

    const res = await run();

    expect(res.status).toBe(500);
    expect(parentSends()).toEqual([]);
    const [alert] = alerts();
    expect(alert.subject).toContain("invalid_parent_email");
    expect(alert.text).toContain("page-due-bad-email");
    expect(alert.text).not.toContain("page-paid-bad-email");
  });
});
