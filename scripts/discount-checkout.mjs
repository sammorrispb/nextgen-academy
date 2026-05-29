#!/usr/bin/env node
// One-shot: create a Stripe *Payment Link* for an NGA drop-in with a coupon
// pre-applied (e.g. a 50%-off referral comp). The link, once paid, fans out
// through the same /api/stripe/webhook flow as a regular checkout — Notion
// drop-in row, admin email, parent confirmation, capacity bump, etc.
//
// Why a Payment Link and not a Checkout Session:
//   A Checkout Session expires 24h after creation (Stripe's hard max). Minting
//   one days before an event guaranteed it died before the parent acted on it —
//   they'd land on "this checkout session has timed out." A Payment Link never
//   expires; it stays payable until the event. We still make it effectively
//   one-shot via restrictions.completed_sessions.limit=1, so the link
//   auto-deactivates after the first paid registration.
//
// How the discount + prefill ride along:
//   Payment Links have no `discounts` create param, so we attach the coupon to
//   a single-use promotion code and auto-apply it through the link URL's
//   `prefilled_promo_code` query param (needs allow_promotion_codes=true). This
//   is the same coupon+auto-promo-code pattern the referral payout already uses
//   (see processReferralReward / src/lib/referral-rewards.ts). The parent's
//   email is prefilled via `prefilled_email`. Both are editable by the customer,
//   which is fine — the webhook reads the email they actually pay with.
//
// Metadata: Stripe copies a Payment Link's top-level `metadata` onto every
//   Checkout Session the link creates, so `session.metadata` arrives at the
//   webhook exactly as before — no webhook change needed.
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
console.error("Preparing payment link:", JSON.stringify(summary, null, 2));

if (args["dry-run"] === "true") {
  console.error("--dry-run set; not calling Stripe.");
  process.exit(0);
}

// 1) Coupon — the underlying discount. duration:once is a no-op for one-time
//    payments but harmless. max_redemptions:1 caps it across everything.
const coupon = await stripePost("coupons", {
  name: `${childName} — ${discountPct}% off (${sessionDate})`,
  percent_off: String(discountPct),
  duration: "once",
  max_redemptions: "1",
});
console.error(`Coupon created: ${coupon.id} (${discountPct}% off, 1 redemption)`);

// 2) Promotion code on top of the coupon — this is what we can auto-apply via
//    the link URL. Let Stripe generate the code so re-runs never collide.
const promo = await stripePost("promotion_codes", {
  "promotion[type]": "coupon",
  "promotion[coupon]": coupon.id,
  max_redemptions: "1",
});
console.error(`Promotion code created: ${promo.code} (${promo.id})`);

const origin =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

// 3) Payment Link — never expires, single-use via the completed-sessions
//    restriction. Top-level metadata is copied onto each Checkout Session the
//    link creates, so the existing webhook reads session.metadata unchanged.
const link = await stripePost("payment_links", {
  "line_items[0][price]": STRIPE_PRICE,
  "line_items[0][quantity]": "1",
  allow_promotion_codes: "true",
  "restrictions[completed_sessions][limit]": "1",
  inactive_message:
    "This registration link has already been used. Text Coach Sam at 301-325-4731 for a new one.",
  "after_completion[type]": "redirect",
  "after_completion[redirect][url]": `${origin}/schedule/success?cs={CHECKOUT_SESSION_ID}`,
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
});

// Prefill the email + auto-apply the discount via URL params. Both are
// percent-encoded by URL, and both stay editable by the customer at checkout.
const url = new URL(link.url);
url.searchParams.set("prefilled_email", parentEmail);
url.searchParams.set("prefilled_promo_code", promo.code);

console.error(`Payment link created: ${link.id} (never expires, 1 paid session max)`);
console.log(url.toString());
