import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { notifyInvoiceSent, type InvoiceSentNotice } from "../src/lib/signup-admin-notify";
import {
  GUARANTEED_GAMES_TEXT, MEDALS_TEXT, NO_REFUNDS_TEXT, RAIN_OR_SHINE_TEXT,
  MVF_JUNIOR_TOURNAMENT_DATE_LABEL, MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_VENUE,
} from "../src/data/mvf-junior-tournament-2026";
import {
  assertMvfNotificationCommand, mvfNotificationProbe, MVF_NOTIFICATION_ENV, MVF_NOTIFICATION_INVOICE,
  MVF_NOTIFICATION_METADATA as m,
} from "./fixtures/mvf-notification-probe";

// Pin the approved actual email envelopes, not metaString source spellings.
// This preserves D7's fields/recipients; name rendering is tested separately.
const saved = Object.fromEntries(MVF_NOTIFICATION_ENV.map(key => [key, process.env[key]]));
const probe = mvfNotificationProbe();
const admin = ["nextgenacademypb@gmail.com", "sam.morris2131@gmail.com"];
const partner = "malvero@mvf.org";
const from = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

test.beforeEach(() => probe.install());
test.afterEach(() => {
  probe.uninstall();
  // Fail-soft application code cannot hide an accidental unstubbed egress.
  expect(probe.unexpected).toEqual([]);
});
test.afterAll(() => { for (const key of MVF_NOTIFICATION_ENV) {
  if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
} });

test("notification ledger fake refuses another invoice, event, recipient or method", () => {
  const valid = { action: "notified", event_key: "mvf-junior-tournament-10u-2026-10-24",
    invoice_id: MVF_NOTIFICATION_INVOICE, recipient: "admin" };
  const call = (body: unknown, method = "POST") => ({ url: "synthetic", method, body: JSON.stringify(body) });
  expect(() => assertMvfNotificationCommand(call(valid))).not.toThrow();
  for (const body of [
    { ...valid, invoice_id: "in_other" }, { ...valid, event_key: "other-event" },
    { ...valid, recipient: "unknown" }, { ...valid, action: "roster_claim" },
    { ...valid, extra: "UNAPPROVED" },
  ]) expect(() => assertMvfNotificationCommand(call(body))).toThrow();
  expect(() => assertMvfNotificationCommand(call(valid, "GET"))).toThrow();
});

function partnerInventory(files: Map<string, string>) {
  return [...files].flatMap(([file, source]) => {
    const references = source.match(/\bMVF_PARTNER_EMAIL\b/g)?.length ?? 0;
    const addresses = source.match(/malvero@mvf\.org/gi)?.length ?? 0;
    return references || addresses ? [{ file, references, addresses }] : [];
  }).sort((a, b) => a.file.localeCompare(b.file));
}

test("both MVF partner notification sites remain the complete source inventory", () => {
  const files = new Map<string, string>();
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.[cm]?[jt]sx?$/.test(file)) files.set(file.split(path.sep).join("/"), readFileSync(file, "utf8"));
    }
  }
  visit("src");
  const approved = [
    { file: "src/app/api/stripe/webhook/route.ts", references: 2, addresses: 1 },
    { file: "src/lib/signup-admin-notify.ts", references: 2, addresses: 1 },
  ];
  expect(partnerInventory(files)).toEqual(approved);
  // An in-memory negative control, with no edit to the restricted webhook.
  files.set("src/synthetic-extra-notification.ts", `send({to: "${partner}"})`);
  expect(partnerInventory(files)).not.toEqual(approved);
});

for (const type of ["invoice.paid", "invoice.payment_succeeded"] as const) {
  test(`${type}: exact paid admin/partner and parent envelopes, then quiet redelivery`, async () => {
    expect((await probe.paid(type)).status).toBe(200);
    expect(probe.mail).toEqual([
      { idempotencyKey: `mvf-paid-${MVF_NOTIFICATION_INVOICE}-admin`, payload: {
        from, to: [...admin, partner], subject: "MVF Tournament: Synthetic Junior — 10U",
        text: [
          `Tournament: ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL} — ${MVF_JUNIOR_TOURNAMENT_VENUE}`,
          "Division: 10U", "", "Parent: Synthetic Parent", `Email: ${m.parent_email}`,
          "Phone: 3015550101", "Player: Synthetic Junior (DOB 2017-05-01)",
          "Residency: Montgomery Village resident", "Emergency: Synthetic Contact · 3015550102",
          "Allergies: Synthetic medical note", "", "Paid: $50.00 — NGA $40.00 / MVF $10.00",
          `Stripe: ${MVF_NOTIFICATION_INVOICE}`,
        ].join("\n"),
      } },
      { idempotencyKey: `mvf-paid-${MVF_NOTIFICATION_INVOICE}-parent`, payload: {
        from, to: m.parent_email, bcc: admin[0], reply_to: admin[0],
        subject: `You're in — MVF Junior Tournament, ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}`,
        text: [
          "Hi Synthetic Parent,", "", "Synthetic Junior is registered for the MVF Junior Tournament (10U division).", "",
          `When: ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL}`,
          `Where: ${MVF_JUNIOR_TOURNAMENT_VENUE}`,
          `Format: rotating partner round robin — ${GUARANTEED_GAMES_TEXT} ${MEDALS_TEXT}`, "",
          `Paid: $50.00. ${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT}`, "",
          "What to bring: a refillable water bottle and court shoes — we have loaner paddles.", "",
          "See you Saturday,", "Coach Sam", "Next Gen Pickleball Academy",
        ].join("\n"),
      } },
    ]);
    const alternate = type === "invoice.paid" ? "invoice.payment_succeeded" : "invoice.paid";
    expect((await probe.paid(alternate)).status).toBe(200);
    expect(probe.mail).toHaveLength(2);
    expect(probe.stub.callsTo("api.resend.com")).toHaveLength(2);
  });
}

for (const [kind, label, recipients] of [
  ["mvf-junior-tournament", "MVF Junior Tournament", [...admin, partner]],
  ["lesson", "Lesson", admin],
  ["monday-girls-dropin", "Monday Girls drop-in", admin],
] as const) {
  test(`${kind}: exact invoice-sent output and recipient boundary`, async () => {
    const notice: InvoiceSentNotice = {
      kind, headline: "UNUSED_HEADLINE_SENTINEL", parentName: "Synthetic Parent", parentEmail: m.parent_email,
      parentPhone: "3015550101", childFirstName: "Synthetic Junior", amountUsd: "50.00",
      invoiceId: MVF_NOTIFICATION_INVOICE, hostedUrl: "https://invoice.stripe.com/i/synthetic", dueDate: "7 days",
      details: ["Division: 10U", "Event: synthetic tournament"],
    };
    // Fields outside the notice contract must not be serialized wholesale.
    await notifyInvoiceSent(Object.assign(notice, { childDob: "DOB_MUST_NOT_LEAVE", allergies: "MEDICAL_MUST_NOT_LEAVE", emergencyName: "CONTACT_MUST_NOT_LEAVE" }));
    expect(probe.mail).toEqual([{ idempotencyKey: null, payload: {
      from, to: recipients, reply_to: admin[0],
      subject: `Invoice sent — ${label}: Synthetic Junior (Synthetic Parent) $50.00`,
      text: [
        `${label} invoice emailed to the parent — awaiting payment.`, "", ...notice.details,
        "Child: Synthetic Junior", "Parent: Synthetic Parent", `Email: ${m.parent_email}`, "Phone: 3015550101", "",
        "Amount: $50.00 — due 7 days", `Stripe invoice: ${MVF_NOTIFICATION_INVOICE}`,
        "Pay link: https://invoice.stripe.com/i/synthetic", "", "You'll get another email here the moment it's paid.",
      ].join("\n"),
    } }]);
    expect(probe.stub.calls).toHaveLength(1);
  });
}
