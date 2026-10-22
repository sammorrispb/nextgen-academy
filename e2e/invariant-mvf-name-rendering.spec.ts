import { test, expect } from "@playwright/test";
import { notifyInvoiceSent } from "../src/lib/signup-admin-notify";
import { invoiceSafeName } from "../src/lib/invoice-text";
import { escapeHtml } from "../src/lib/html";
import { mvfTournamentPaymentReminderHtml } from "../src/lib/email/mvf-tournament-payment-reminder";
import { mvfTournamentPreEventReminderHtml } from "../src/lib/email/mvf-tournament-pre-event-reminder";
import { mvfNotificationProbe, MVF_NOTIFICATION_ENV } from "./fixtures/mvf-notification-probe";

// These regression expectations intentionally expose current rendering gaps.
// They do not narrow D7's approved fields, recipients or medical free text.
const saved = Object.fromEntries(MVF_NOTIFICATION_ENV.map(key => [key, process.env[key]]));
const probe = mvfNotificationProbe();
const name = "Synthetic https://untrusted.example/name";
const markup = 'Synthetic <a href="https://untrusted.example/name">Name</a>';

test.beforeEach(() => probe.install());
test.afterEach(() => { probe.uninstall(); expect(probe.unexpected).toEqual([]); });
test.afterAll(() => { for (const key of MVF_NOTIFICATION_ENV) {
  if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
} });

test("MVF invoice-sent notice cleans the actual name lines as well as its subject", async () => {
  await notifyInvoiceSent({ kind: "mvf-junior-tournament", headline: "synthetic", parentName: name,
    parentEmail: "synthetic.parent@example.invalid", parentPhone: "3015550101", childFirstName: name,
    amountUsd: "50.00", invoiceId: "in_SyntheticNames", hostedUrl: null, dueDate: "7 days", details: [] });
  expect(probe.mail).toHaveLength(1);
  expect(probe.mail[0].payload.subject).toContain(invoiceSafeName(name));
  const lines = String(probe.mail[0].payload.text).split("\n");
  expect.soft(lines).toContain(`Child: ${invoiceSafeName(name)}`);
  expect.soft(lines).toContain(`Parent: ${invoiceSafeName(name, "parent")}`);
});

test("paid partner and parent output cannot turn typed names into links", async () => {
  expect((await probe.paid("invoice.paid", { child_first_name: name, child_last_name: "Junior",
    parent_name: name, emergency_name: name })).status).toBe(200);
  expect(probe.mail).toHaveLength(2);
  // Check only name renderings: approved email/phone/medical data are separate.
  for (const message of probe.mail) {
    expect.soft(String(message.payload.subject)).not.toContain("untrusted.example");
    expect.soft(String(message.payload.text)).not.toContain("untrusted.example");
  }
});

test("payment-reminder HTML renders parent and child markup as inert text", () => {
  const html = mvfTournamentPaymentReminderHtml({ parentFirst: markup, childFirst: markup,
    divisionLabel: "10U", amountUsd: "50.00", residencyLabel: "MV resident",
    payUrl: "https://invoice.stripe.com/i/synthetic" });
  expect.soft(html).not.toContain('<a href="https://untrusted.example/name">');
  expect.soft(html).toContain(escapeHtml(markup));
  expect(html).toContain('href="https://invoice.stripe.com/i/synthetic"');
});

test("pre-event reminder HTML renders parent and child markup as inert text", () => {
  const html = mvfTournamentPreEventReminderHtml({ parentFirst: markup, childFirst: markup, divisionLabel: "10U" });
  expect.soft(html).not.toContain('<a href="https://untrusted.example/name">');
  expect.soft(html).toContain(escapeHtml(markup));
});
