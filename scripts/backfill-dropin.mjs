#!/usr/bin/env node
// Backfill a Drop-in Registration row for a checkout that was PAID but whose
// row never landed in Notion — e.g. when the Stripe webhook's createDropInRegistration
// silently failed (it logs but doesn't throw, so Stripe never retried).
//
// Faithful replay: reads the Checkout Session straight from Stripe and builds
// the exact same DropInRow the webhook would have, so the backfilled row is
// indistinguishable from a normal registration. Idempotent — bails if a row
// for this checkout session already exists.
//
// Env required (NGA secrets):
//   STRIPE_SECRET_KEY        — NGA account (acct_1TU4iSBpXOfTC961)
//   NOTION_API_KEY
//   NOTION_DROPINS_DB_ID
//
// Example:
//   node scripts/backfill-dropin.mjs --checkout-session-id=cs_live_...

import process from "node:process";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function parseArgs(argv) {
  const out = {};
  for (const tok of argv.slice(2)) {
    if (!tok.startsWith("--")) continue;
    const eq = tok.indexOf("=");
    if (eq < 0) { out[tok.slice(2)] = "true"; continue; }
    out[tok.slice(2, eq)] = tok.slice(eq + 1);
  }
  return out;
}

const args = parseArgs(process.argv);
const csId = args["checkout-session-id"];
if (!csId) {
  console.error("Missing --checkout-session-id");
  process.exit(1);
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const NOTION_KEY = process.env.NOTION_API_KEY;
const DROPINS_DB = process.env.NOTION_DROPINS_DB_ID;
if (!STRIPE_KEY || !NOTION_KEY || !DROPINS_DB) {
  console.error("Missing env: need STRIPE_SECRET_KEY, NOTION_API_KEY, NOTION_DROPINS_DB_ID");
  process.exit(1);
}

function metaString(meta, key) {
  return typeof meta?.[key] === "string" ? meta[key] : "";
}

// 1) Pull the paid session from Stripe.
const sres = await fetch(`https://api.stripe.com/v1/checkout/sessions/${csId}`, {
  headers: { Authorization: `Bearer ${STRIPE_KEY}` },
});
const session = await sres.json();
if (!sres.ok) {
  console.error(`Stripe error: ${session?.error?.message ?? sres.statusText}`);
  process.exit(1);
}
if (session.payment_status !== "paid") {
  console.error(`Session payment_status is "${session.payment_status}" — not paid, refusing to backfill.`);
  process.exit(1);
}

const m = session.metadata ?? {};
const piId =
  typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
const parentEmail =
  session.customer_details?.email ?? session.customer_email ?? "";

const row = {
  parentName: metaString(m, "parent_name"),
  parentEmail,
  parentPhone: metaString(m, "parent_phone"),
  childFirstName: metaString(m, "child_first_name"),
  childBirthYear: Number(metaString(m, "child_birth_year")) || 0,
  sessionTitle: metaString(m, "session_title"),
  sessionDate: metaString(m, "session_date"),
  sessionStartTime: metaString(m, "session_start"),
  location: metaString(m, "session_location"),
  amountPaidUsd: (session.amount_total ?? 0) / 100,
  stripeCheckoutSessionId: session.id,
  stripePaymentIntentId: piId,
  displayConsent: metaString(m, "display_consent") === "true",
  smsConsent: metaString(m, "sms_consent") === "true",
  smsConsentText: metaString(m, "sms_consent_text"),
};
console.error("Replaying:", JSON.stringify(row, null, 2));

// 2) Idempotency — don't double-create if a row already exists.
const qres = await fetch(`${NOTION_API}/databases/${DROPINS_DB}/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${NOTION_KEY}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  },
  body: JSON.stringify({
    filter: {
      property: "Stripe Checkout Session ID",
      rich_text: { equals: session.id },
    },
    page_size: 1,
  }),
});
const qdata = await qres.json();
if (qres.ok && (qdata.results?.length ?? 0) > 0) {
  console.error(`Row already exists (${qdata.results[0].id}) — nothing to do.`);
  process.exit(0);
}

// 3) Create the row — mirrors createDropInRegistration() in src/lib/notion-dropins.ts.
const title = `${row.childFirstName} — ${row.sessionTitle || row.sessionDate}`;
const properties = {
  Registration: { title: [{ text: { content: title } }] },
  "Parent Name": { rich_text: [{ text: { content: row.parentName } }] },
  "Parent Email": { email: row.parentEmail },
  "Parent Phone": { phone_number: row.parentPhone },
  "Child First Name": { rich_text: [{ text: { content: row.childFirstName } }] },
  "Child Birth Year": { number: row.childBirthYear },
  "Session Title": { rich_text: [{ text: { content: row.sessionTitle } }] },
  "Session Start Time": { rich_text: [{ text: { content: row.sessionStartTime } }] },
  Location: { rich_text: [{ text: { content: row.location } }] },
  "Amount Paid": { number: row.amountPaidUsd },
  "Stripe Checkout Session ID": {
    rich_text: [{ text: { content: row.stripeCheckoutSessionId } }],
  },
  Status: { select: { name: "Confirmed" } },
  "Display Consent": { checkbox: row.displayConsent },
  "SMS Consent": { checkbox: row.smsConsent },
  "SMS Consent Text": {
    rich_text: row.smsConsentText ? [{ text: { content: row.smsConsentText } }] : [],
  },
};
if (row.sessionDate) {
  properties["Session Date"] = { date: { start: row.sessionDate } };
}
if (row.stripePaymentIntentId) {
  properties["Stripe Payment Intent ID"] = {
    rich_text: [{ text: { content: row.stripePaymentIntentId } }],
  };
}

const cres = await fetch(`${NOTION_API}/pages`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${NOTION_KEY}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  },
  body: JSON.stringify({ parent: { database_id: DROPINS_DB }, properties }),
});
const cbody = await cres.text();
if (!cres.ok) {
  console.error(`Notion create FAILED ${cres.status}: ${cbody}`);
  process.exit(1);
}
const created = JSON.parse(cbody);
console.error(`Created drop-in row: ${created.id}`);
console.log(created.url ?? created.id);
