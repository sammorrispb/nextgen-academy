import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import Stripe from "stripe";
import ts from "typescript";
import { FetchStub } from "./fixtures/fetch-stub";
import { FakeStripeInvoicing } from "./fixtures/fake-stripe-invoices";
import { DenyProviderNetwork } from "./fixtures/deny-provider-network";
import { getStripe } from "../src/lib/stripe";
import { POST } from "../src/app/api/checkout-mvf-junior-tournament/route";
import { markMvfTournamentRegPaid } from "../src/lib/notion-mvf-tournament-registrations";
import {
  MVF_JUNIOR_TOURNAMENT_DATE_ISO,
  MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_TITLE,
  MVF_JUNIOR_TOURNAMENT_VENUE,
} from "../src/data/mvf-junior-tournament-2026";
import { SMS_CONSENT_TEXT } from "../src/data/sms-consent";

// Guard the entire serialized payload, including innocently named new keys.
// Stripe's Node HTTP transport bypasses FetchStub: patch the cached SDK client
// with the existing offline invoice fake before calling the actual route.
const TOUCHED_ENV = [
  "STRIPE_SECRET_KEY", "NOTION_API_KEY", "NOTION_MVF_TOURNAMENT_REGS_DB_ID",
  "NOTION_WAIVERS_DB_ID", "RESEND_API_KEY", "VERCEL_ENV", "LINKDINK_BASE_URL",
  "NGA_SYNC_SECRET", "OPEN_BRAIN_INGEST_URL", "OPEN_BRAIN_INGEST_SECRET",
  "LEAD_INGEST_TOKEN", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER", "CRON_ALERT_SMS_TO", "CRON_ALERT_LOGS_URL",
] as const;
const savedEnv = Object.fromEntries(TOUCHED_ENV.map(key => [key, process.env[key]]));
const stub = new FetchStub();
const network = new DenyProviderNetwork();
let fake: FakeStripeInvoicing;
let restoreStripe = () => {};
let checkoutMailEnabled = false;
const CAPACITY = "https://capacity.example.invalid/play/api/internal/nga-tournament-capacity";
const ROSTER_QUERY = "https://api.notion.com/v1/databases/qa_payload_roster/query";
const NOTION_CREATE = "https://api.notion.com/v1/pages";
const SUBMISSION = "71000000-0000-4000-8000-000000000001";

const METADATA_KEYS = [
  "kind", "event_label", "event_date", "event_time", "venue", "division",
  "nga_capacity_submission_id", "division_label", "resident", "amount_usd",
  "nga_revenue_share", "nga_share_usd", "mvf_share_usd", "parent_name",
  "parent_email", "parent_phone", "child_first_name", "child_last_name",
  "child_dob", "emergency_name", "emergency_phone", "allergies",
  "waiver_accepted", "sms_consent", "sms_consent_text", "payment_owner",
];
const CREATE_KEYS = [
  "Parent Name", "Parent Email", "Parent Phone", "Child First Name",
  "Child Last Name", "Child DOB", "Division", "Resident", "Status", "Paid",
  "Amount Paid", "Stripe Invoice ID", "SMS Consent", "SMS Consent Text",
  "Emergency Name", "Emergency Phone", "Allergies",
];
const PAID_KEYS = ["Paid", "Status", "Amount Paid", "Stripe Payment Intent ID"];

const originalNow = Date.now;
test.beforeEach(() => {
  // Exercise historical signup contracts while the event was still open.
  Date.now = () => Date.parse("2026-10-23T12:00:00Z");
  network.install();
  checkoutMailEnabled = false;
  for (const key of TOUCHED_ENV) delete process.env[key];
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "sk_test_offline_payload_inventory",
    NOTION_API_KEY: "ntn_offline_payload_inventory",
    NOTION_MVF_TOURNAMENT_REGS_DB_ID: "qa_payload_roster",
    NOTION_WAIVERS_DB_ID: "qa_payload_waivers",
    NGA_SYNC_SECRET: "qa-payload-capacity",
    LINKDINK_BASE_URL: "https://capacity.example.invalid",
  });
  fake = new FakeStripeInvoicing();
  restoreStripe = fake.install(getStripe());
  stub.reset();
  stub.install();
});
test.afterEach(() => {
  Date.now = originalNow;
  restoreStripe();
  stub.uninstall();
  network.uninstall();
  for (const key of TOUCHED_ENV) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  // Fail-soft runtime code may swallow FetchStub's error. Still fail this
  // test if it even attempted an unapproved destination or transport method.
  const allowed = new Set([
    `POST ${CAPACITY}`, `POST ${ROSTER_QUERY}`, `POST ${NOTION_CREATE}`,
    "POST https://api.notion.com/v1/databases/qa_payload_waivers/query",
    "POST https://capacity.example.invalid/play/api/internal/nga-roster-add",
    "PATCH https://api.notion.com/v1/pages/qa-paid-row",
  ]);
  if (checkoutMailEnabled) allowed.add("POST https://api.resend.com/emails");
  expect(network.attempts, "SDK traffic must stay inside the offline fixtures, even when a handler catches its error").toEqual([]);
  expect(stub.calls.filter(call => !allowed.has(`${call.method} ${call.url}`))).toEqual([]);
});

for (const scenario of [
  { division: "10u", label: "10U", childDob: "2017-03-15", resident: true, smsConsent: true, amount: "50.00", nga: "40.00", mvf: "10.00" },
  { division: "14u", label: "14U", childDob: "2013-03-15", resident: false, smsConsent: false, amount: "60.00", nga: "48.00", mvf: "12.00" },
]) {
  test(`${scenario.label} checkout emits only the complete approved invoice metadata and Notion properties`, async () => {
    const data = {
      division: scenario.division, resident: scenario.resident,
      parentName: "Synthetic Guardian", email: "synthetic.guardian@example.invalid",
      phone: "2025550100", childFirstName: "Synthetic", childLastName: "Fixture",
      childDob: scenario.childDob, emergencyName: "Synthetic Backup",
      emergencyPhone: "2025550110", allergies: "Synthetic medical note ".repeat(25),
      smsConsent: scenario.smsConsent, submissionId: SUBMISSION,
      // A future spread of unvalidated form fields must not export this value.
      healthNotes: "UNAPPROVED_PAYLOAD_SENTINEL",
    };
    stub.on("https://api.notion.com/v1/databases/qa_payload_waivers/query", { results: [{ id: "qa-waiver" }] });
    stub.on(ROSTER_QUERY, { results: [] });
    stub.on(NOTION_CREATE, { id: "qa-roster-row" });
    stub.onDynamic(CAPACITY, call => {
      const body = JSON.parse(call.body);
      if (body.action === "reserve") return { status: 200, json: { ok: true, state: "held", invoice_id: null } };
      if (body.action === "bind") return { status: 200, json: { ok: true, invoice_id: body.invoice_id } };
      if (body.action === "roster_claim") return { status: 200, json: { ok: true, claimed: true } };
      throw new Error(`Unexpected synthetic capacity action: ${body.action}`);
    });
    stub.on("https://capacity.example.invalid/play/api/internal/nga-roster-add", { ok: true, rsvpId: "qa-rsvp", playerId: "qa-player", alreadyOnRoster: false });
    if (scenario.division === "10u") {
      // Observe the actual checkout caller's details and parent envelope, not
      // just a notice hand-built by a test. All delivery remains stubbed.
      checkoutMailEnabled = true;
      process.env.RESEND_API_KEY = "re_offline_checkout_payload";
      stub.onDynamic(/^https:\/\/api\.resend\.com\/emails$/, call => {
        expect(call.method).toBe("POST");
        return { status: 200, json: { id: "mail-offline-checkout" } };
      });
    }

    const response = await POST(new NextRequest("http://localhost/api/checkout-mvf-junior-tournament", {
      method: "POST", body: JSON.stringify(data),
      headers: { "content-type": "application/json", "x-forwarded-for": scenario.resident ? "192.0.2.171" : "192.0.2.172" },
    }));
    expect(response.status).toBe(200);
    expect(fake.all()).toHaveLength(1);
    const invoice = fake.all()[0];
    expect(invoice.sends).toBe(1);
    expect(Object.keys(invoice.metadata).sort()).toEqual([...METADATA_KEYS].sort());
    expect(invoice.metadata).toEqual({
      kind: "mvf-junior-tournament", event_label: MVF_JUNIOR_TOURNAMENT_TITLE,
      event_date: MVF_JUNIOR_TOURNAMENT_DATE_ISO,
      event_time: MVF_JUNIOR_TOURNAMENT_TIME_LABEL, venue: MVF_JUNIOR_TOURNAMENT_VENUE,
      division: scenario.division, nga_capacity_submission_id: SUBMISSION,
      division_label: scenario.label, resident: String(scenario.resident),
      amount_usd: scenario.amount, nga_revenue_share: "0.8",
      nga_share_usd: scenario.nga, mvf_share_usd: scenario.mvf,
      parent_name: data.parentName, parent_email: data.email, parent_phone: data.phone,
      child_first_name: data.childFirstName, child_last_name: data.childLastName,
      child_dob: data.childDob, emergency_name: data.emergencyName,
      emergency_phone: data.emergencyPhone, allergies: data.allergies.slice(0, 480),
      waiver_accepted: "true", sms_consent: String(scenario.smsConsent),
      sms_consent_text: scenario.smsConsent ? SMS_CONSENT_TEXT : "",
      payment_owner: "nga_site",
    });

    const creates = stub.calls.filter(call => call.url === NOTION_CREATE && call.method === "POST");
    expect(creates).toHaveLength(1);
    const payload = JSON.parse(creates[0].body);
    expect(Object.keys(payload).sort()).toEqual(["parent", "properties"]);
    expect(Object.keys(payload.properties).sort()).toEqual([...CREATE_KEYS].sort());
    expect(payload).toEqual({
      parent: { database_id: "qa_payload_roster" },
      properties: {
        "Parent Name": { title: [{ text: { content: data.parentName } }] },
        "Parent Email": { email: data.email }, "Parent Phone": { phone_number: data.phone },
        "Child First Name": { rich_text: [{ text: { content: data.childFirstName } }] },
        "Child Last Name": { rich_text: [{ text: { content: data.childLastName } }] },
        "Child DOB": { date: { start: data.childDob } },
        Division: { select: { name: scenario.label } }, Resident: { checkbox: scenario.resident },
        Status: { select: { name: "Pending" } }, Paid: { checkbox: false },
        "Amount Paid": { number: Number(scenario.amount) },
        "Stripe Invoice ID": { rich_text: [{ text: { content: invoice.id } }] },
        "SMS Consent": { checkbox: scenario.smsConsent },
        "SMS Consent Text": { rich_text: [{ text: { content: scenario.smsConsent ? SMS_CONSENT_TEXT : "" } }] },
        "Emergency Name": { rich_text: [{ text: { content: data.emergencyName } }] },
        "Emergency Phone": { phone_number: data.emergencyPhone },
        Allergies: { rich_text: [{ text: { content: data.allergies } }] },
      },
    });
    const mail = stub.callsTo("api.resend.com");
    if (scenario.division === "10u") {
      expect(mail).toHaveLength(2);
      const [partner, parent] = mail.map(call => JSON.parse(call.body));
      const from = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
      const academy = "nextgenacademypb@gmail.com";
      expect(partner).toEqual({
        from, to: [academy, "sam.morris2131@gmail.com", "malvero@mvf.org"], reply_to: academy,
        subject: "Invoice sent — MVF Junior Tournament: Synthetic Fixture (Synthetic Guardian) $50.00",
        text: [
          "MVF Junior Tournament invoice emailed to the parent — awaiting payment.", "",
          "Division: 10U (Ages 6–10)",
          `Event: ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL} — ${MVF_JUNIOR_TOURNAMENT_VENUE}`,
          "Entry: $50.00 (MV resident) — NGA $40.00 / MVF $10.00",
          `Child: ${data.childFirstName} ${data.childLastName}`, `Parent: ${data.parentName}`,
          `Email: ${data.email}`, `Phone: ${data.phone}`, "",
          "Amount: $50.00 — due 7 days", `Stripe invoice: ${invoice.id}`,
          `Pay link: ${invoice.hosted_invoice_url}`, "", "You'll get another email here the moment it's paid.",
        ].join("\n"),
      });
      // Exact destination/field inventory, with focused content assertions
      // rather than a large HTML style snapshot. Pre-payment parent mail
      // carries the pay link and first names, not the D7 medical/DOB fields.
      expect(Object.keys(parent).sort()).toEqual(["bcc", "from", "html", "reply_to", "subject", "text", "to"]);
      expect(parent).toMatchObject({
        from, to: data.email, bcc: academy, reply_to: academy,
        subject: "One step left — lock in Synthetic's MVF Junior Tournament spot",
        text: expect.any(String), html: expect.any(String),
      });
      expect(parent.text).toContain("Hi Synthetic,");
      expect(parent.text).toContain("Thanks for registering Synthetic for the MVF Junior Tournament (10U division)! One step left: complete the $50.00 entry fee (MV resident) to lock in the spot.");
      expect(parent.text).toContain(`Pay here: ${invoice.hosted_invoice_url}`);
      expect(parent.html).toContain(`<a href="${invoice.hosted_invoice_url}"`);
      expect(parent.html).toContain("Pay the entry fee");
      for (const privateValue of [
        data.parentName, data.childLastName, data.childDob, data.phone,
        data.emergencyName, data.emergencyPhone, "Synthetic medical note", data.healthNotes,
      ]) {
        expect(`${parent.subject}\n${parent.text}\n${parent.html}`).not.toContain(privateValue);
      }
    } else {
      // This scenario also verifies the missing-mail-credential branch.
      expect(mail).toHaveLength(0);
    }
  });
}

test("the provider network guard blocks HTTP(S), TCP/TLS and an unmocked Stripe SDK call", async () => {
  // Invalid ports are a second fail-closed boundary for this fixture's own
  // negative controls: even a broken guard cannot connect to a provider.
  const guard = new DenyProviderNetwork().install();
  const endpoint = { host: "synthetic.example.invalid", port: 65536 };
  try {
    for (const attempt of [
      () => http.request(endpoint), () => http.get(endpoint),
      () => https.request(endpoint), () => https.get(endpoint),
      () => net.connect(endpoint), () => net.createConnection(endpoint),
      () => new net.Socket().connect(endpoint), () => tls.connect(endpoint),
    ]) expect(attempt).toThrow("[deny-provider-network] blocked");
    const stripe = new Stripe("sk_test_offline_transport_probe", {
      host: endpoint.host, port: endpoint.port, protocol: "http", maxNetworkRetries: 0,
    });
    await expect(stripe.balance.retrieve()).rejects.toThrow();
    expect(guard.attempts.map(attempt => attempt.operation)).toEqual([
      "http.request", "http.get", "https.request", "https.get", "net.connect",
      "net.createConnection", "net.Socket.connect", "tls.connect", "http.request",
    ]);
    expect(guard.attempts.every(attempt => attempt.destination === "synthetic.example.invalid:65536")).toBe(true);
  } finally {
    guard.uninstall();
  }
});

test("marking the roster paid serializes exactly the four approved update properties", async () => {
  stub.on(ROSTER_QUERY, { results: [{ id: "qa-paid-row", properties: { Paid: { checkbox: false } } }] });
  stub.on("https://api.notion.com/v1/pages/qa-paid-row", { id: "qa-paid-row" });
  expect(await markMvfTournamentRegPaid("in_QAPayload", 60, "pi_QAPayload")).toBe("ok");
  const patches = stub.calls.filter(call => call.method === "PATCH");
  expect(patches).toHaveLength(1);
  const payload = JSON.parse(patches[0].body);
  expect(Object.keys(payload.properties).sort()).toEqual([...PAID_KEYS].sort());
  expect(payload).toEqual({ properties: {
    Paid: { checkbox: true }, Status: { select: { name: "Confirmed" } },
    "Amount Paid": { number: 60 },
    "Stripe Payment Intent ID": { rich_text: [{ text: { content: "pi_QAPayload" } }] },
  } });
  expect(fake.all()).toHaveLength(0);
});

// Behavior catches newly serialized fields. This complementary AST pin also
// rejects spreads/computed properties, even when today's fixture leaves them empty.
function propertiesNamed(source: string, name: string): ts.PropertyAssignment[] {
  const file = ts.createSourceFile("payload.ts", source, ts.ScriptTarget.Latest, true);
  const found: ts.PropertyAssignment[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && !ts.isComputedPropertyName(node.name) && node.name.getText(file).replace(/^['"]|['"]$/g, "") === name) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function literalKeys(node: ts.PropertyAssignment): string[] {
  expect(ts.isObjectLiteralExpression(node.initializer), "egress payload must stay an explicit object").toBe(true);
  const object = node.initializer as ts.ObjectLiteralExpression;
  return object.properties.map(property => {
    expect(ts.isPropertyAssignment(property), "spreads, shorthand and methods need explicit field review").toBe(true);
    const assignment = property as ts.PropertyAssignment;
    expect(ts.isComputedPropertyName(assignment.name), "computed egress keys need explicit field review").toBe(false);
    return assignment.name.getText().replace(/^['"]|['"]$/g, "");
  }).sort();
}

test("MVF metadata and Notion writes cannot widen through spreads or computed properties", () => {
  const checkout = readFileSync(join(__dirname, "../src/app/api/checkout-mvf-junior-tournament/route.ts"), "utf8");
  const metadata = propertiesNamed(checkout, "metadata");
  expect(metadata).toHaveLength(1);
  expect(literalKeys(metadata[0])).toEqual(METADATA_KEYS.filter(key => key !== "payment_owner").sort());
  const roster = readFileSync(join(__dirname, "../src/lib/notion-mvf-tournament-registrations.ts"), "utf8");
  const properties = propertiesNamed(roster, "properties");
  expect(properties).toHaveLength(2);
  expect(literalKeys(properties[0])).toEqual([...CREATE_KEYS].sort());
  expect(literalKeys(properties[1])).toEqual([...PAID_KEYS].sort());
  // Empty spreads can evade a behavior fixture; computed/shorthand keys can
  // evade a text regex. The same source guard must reject each construction.
  for (const expression of ["{ ...extra }", "{ ['healthNotes']: value }", "{ healthNotes }"]) {
    const [unsafe] = propertiesNamed(`({ metadata: ${expression} })`, "metadata");
    expect(() => literalKeys(unsafe), expression).toThrow();
  }
});

function paidHandler(source: string): ts.FunctionDeclaration {
  const file = ts.createSourceFile("webhook.ts", source, ts.ScriptTarget.Latest, true);
  const handlers = file.statements.filter((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "handleMvfTournamentPaid");
  expect(handlers, "the entire MVF paid handler must be inventoried").toHaveLength(1);
  return handlers[0];
}

function guardPaidMetadata(source: string): void {
  const keys = new Set<string>();
  const isNamed = (node: ts.Node | undefined, name: string) =>
    node !== undefined && ts.isIdentifier(node) && node.text === name;
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      expect(isNamed(node.expression, "m"), "direct metadata access bypasses the field inventory").toBe(false);
    }
    if (ts.isVariableDeclaration(node)) {
      expect(isNamed(node.initializer, "m") || isNamed(node.initializer, "metaString"), "metadata/read-helper aliases bypass the field inventory").toBe(false);
    }
    if (ts.isCallExpression(node) && isNamed(node.expression, "metaString")) {
      expect(node.arguments).toHaveLength(2);
      expect(isNamed(node.arguments[0], "m"), "metadata reads must use the inventoried object").toBe(true);
      expect(ts.isStringLiteral(node.arguments[1]), "metadata read keys must be explicit literals").toBe(true);
      keys.add((node.arguments[1] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(paidHandler(source));
  expect([...keys].sort()).toEqual([
    "allergies", "child_dob", "child_first_name", "child_last_name", "division",
    "division_label", "emergency_name", "emergency_phone", "event_date",
    "mvf_share_usd", "nga_share_usd", "parent_name", "parent_phone", "resident",
    "sms_consent", "sms_consent_text",
  ]);
}

test("the full MVF paid handler reads only the approved metadata without direct or aliased access", () => {
  const source = readFileSync(join(__dirname, "../src/app/api/stripe/webhook/route.ts"), "utf8");
  guardPaidMetadata(source);
  const handler = paidHandler(source).getText();
  for (const extra of [
    'metaString(m, "healthNotes");', 'metaString(other, "parent_name");',
    'metaString(m, fieldName);', "m.healthNotes;", 'm["healthNotes"];',
    "const alias = m;", "const readMetadata = metaString;",
  ]) {
    // Perturb an in-memory copy only: runtime/webhook files are never modified.
    expect(() => guardPaidMetadata(handler.replace("{", `{ ${extra}`)), extra).toThrow();
  }
});
