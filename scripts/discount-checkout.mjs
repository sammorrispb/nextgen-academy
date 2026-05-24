#!/usr/bin/env node
// One-shot: create a Stripe Checkout link for an NGA drop-in with a coupon
// pre-applied (e.g. a 50%-off referral comp). The link, once paid, fans out
// through the same /api/stripe/webhook flow as a regular checkout — Notion
// drop-in row, admin email, parent confirmation, capacity bump, etc.
//
// Env required (run from a machine with the NGA secrets, not Link & Dink):
//   STRIPE_SECRET_KEY        — NGA account (acct_1TU4iSBpXOfTC961)
//   STRIPE_DROPIN_PRICE_ID   — the $40 drop-in price
//   NOTION_API_KEY           — to look up the session row by ID
//
// Example:
//   node scripts/discount-checkout.mjs \
//     --session-id=35efa3ac27dc81168769d1b0590bfe29 \
//     --parent-name="Franz Malitig" \
//     --parent-email=franz.malitig@icloud.com \
//     --parent-phone=+13015551212 \
//     --child-name=Grayson \
//     --child-birth-year=2017 \
//     --discount=50

import process from "node:process";

function parseArgs(argv) {
  const out = {};
  for (const tok of argv.slice(2)) {
    if (tok === "--dry-run") { out["dry-run"] = "true"; continue; }
    if (!tok.startsWith("--")) continue;
    const eq = tok.indexOf("=");
    if (eq < 0) { out[tok.slice(2)] = "true"; continue; }
    out[tok.slice(2, eq)] = tok.slice(eq + 1);
  }
  return out;
}

const args = parseArgs(process.argv);
const required = [
  "session-id",
  "parent-name",
  "parent-email",
  "child-name",
  "child-birth-year",
];
const missing = required.filter((k) => !args[k]);
if (missing.length) {
  console.error(`Missing required args: ${missing.join(", ")}`);
  console.error("See script header for usage.");
  process.exit(1);
}

const discountPct = Number(args.discount ?? 50);
if (!(discountPct > 0 && discountPct <= 100)) {
  console.error("--discount must be > 0 and ≤ 100");
  process.exit(1);
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE = process.env.STRIPE_DROPIN_PRICE_ID;
const NOTION_KEY = process.env.NOTION_API_KEY;
if (!STRIPE_KEY || !STRIPE_PRICE || !NOTION_KEY) {
  console.error(
    "Missing env: need STRIPE_SECRET_KEY, STRIPE_DROPIN_PRICE_ID, NOTION_API_KEY",
  );
  process.exit(1);
}

function readText(prop) {
  const arr = prop?.rich_text ?? prop?.title ?? [];
  return Array.isArray(arr) ? arr.map((r) => r.plain_text ?? "").join("") : "";
}

async function notionGetPage(id) {
  const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    headers: {
      Authorization: `Bearer ${NOTION_KEY}`,
      "Notion-Version": "2022-06-28",
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Notion ${res.status}: ${body}`);
  return JSON.parse(body);
}

async function stripePost(path, params) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${path}: ${data?.error?.message ?? res.statusText}`);
  }
  return data;
}

const page = await notionGetPage(args["session-id"]);
const props = page.properties ?? {};
const sessionTitle = readText(props["Session"]);
const sessionDate = props["Date"]?.date?.start ?? "";
const sessionStart = readText(props["Start time"]);
const sessionEnd = readText(props["End time"]);
const sessionLocation = readText(props["Location"]);
const status = props["Status"]?.select?.name ?? "";

if (status !== "Open") {
  console.error(`Session status is "${status}" — only Open sessions can be registered.`);
  process.exit(1);
}
if (!sessionDate) {
  console.error("Session row has no Date.");
  process.exit(1);
}

const childName = args["child-name"];
const parentEmail = args["parent-email"];
const parentName = args["parent-name"];
const parentPhone = args["parent-phone"] ?? "";
const birthYear = String(Number(args["child-birth-year"]));

const summary = {
  session: `${sessionTitle} — ${sessionDate} ${sessionStart}`,
  location: sessionLocation,
  parent: `${parentName} <${parentEmail}>${parentPhone ? ` ${parentPhone}` : ""}`,
  child: `${childName} (born ${birthYear})`,
  discountPct,
};
console.error("Preparing checkout:", JSON.stringify(summary, null, 2));

if (args["dry-run"] === "true") {
  console.error("--dry-run set; not calling Stripe.");
  process.exit(0);
}

const coupon = await stripePost("coupons", {
  name: `${childName} — ${discountPct}% off (${sessionDate})`,
  percent_off: String(discountPct),
  duration: "once",
  max_redemptions: "1",
});
console.error(`Coupon created: ${coupon.id} (${discountPct}% off, 1 redemption)`);

const origin =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";

const checkout = await stripePost("checkout/sessions", {
  mode: "payment",
  "line_items[0][price]": STRIPE_PRICE,
  "line_items[0][quantity]": "1",
  customer_email: parentEmail,
  "discounts[0][coupon]": coupon.id,
  "payment_intent_data[description]": `${sessionTitle} — ${childName}`,
  "metadata[session_id]": args["session-id"],
  "metadata[session_title]": sessionTitle,
  "metadata[session_date]": sessionDate,
  "metadata[session_start]": sessionStart,
  "metadata[session_end]": sessionEnd,
  "metadata[session_location]": sessionLocation,
  "metadata[parent_name]": parentName,
  "metadata[parent_phone]": parentPhone,
  "metadata[child_first_name]": childName,
  "metadata[child_birth_year]": birthYear,
  "metadata[display_consent]": "false",
  "metadata[sms_consent]": "false",
  "metadata[sms_consent_text]": "",
  success_url: `${origin}/schedule/success?cs={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/schedule`,
});

console.log(checkout.url);
