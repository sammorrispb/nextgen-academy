#!/usr/bin/env node
// ⚠ NOT the live MACKID source. This script provisions a FUTURE expanded-schedule
//   camp model (Full $295 / AM $170 / PM $170) on a NEW "NGA Summer Camp" product
//   and restricts its MACKID coupon to THAT product. The site currently charges
//   STRIPE_CAMP_DAY_PRICE_ID ($50) / STRIPE_CAMP_WEEK_PRICE_ID ($150) on a
//   DIFFERENT product, so the coupon below would NOT apply to today's checkout.
//   To make MACKID work on the CURRENT $50/$150 camps, run
//   scripts/setup-mackid-promo.mjs instead (it scopes the coupon to the live
//   prices). Only run THIS script when the $295 full-day schedule actually ships.
//
// Idempotently provision the NGA Summer Camp Stripe objects on the NGA account
// (acct_1TU4iSBpXOfTC961):
//   1. one "NGA Summer Camp" product
//   2. three weekly prices — Full $295, AM half-day $170, PM half-day $170
//      (distinguished by lookup_key, since AM and PM share an amount)
//   3. a "MACKID" promotion code = 15% off, restricted to the camp product
//      (so it can't be redeemed against the $20 drop-in checkout)
//
// Safe to re-run: every object is found-or-created. Prints the 3 price IDs to
// paste into STRIPE_CAMP_FULL/AM/PM_PRICE_ID (.env.local + Vercel prod).
//
// NGA Stripe writes use the NGA key (MCP/agent Stripe only reaches L&D). Run it
// yourself with the NGA secret key, e.g.:
//
//   STRIPE_SECRET_KEY=sk_live_... node scripts/setup-camp-stripe.mjs
//
// If STRIPE_SECRET_KEY isn't already exported, the script tries to read it from
// nextgen-academy/.env.local.

import Stripe from "stripe";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function loadKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const envPath = join(here, "..", ".env.local");
    const line = readFileSync(envPath, "utf8")
      .split("\n")
      .find((l) => l.startsWith("STRIPE_SECRET_KEY="));
    if (line) return line.slice("STRIPE_SECRET_KEY=".length).trim().replace(/^["']|["']$/g, "");
  } catch {
    /* fall through */
  }
  return null;
}

const key = loadKey();
if (!key) {
  console.error(
    "STRIPE_SECRET_KEY not set and not found in .env.local. Pass the NGA key:\n" +
      "  STRIPE_SECRET_KEY=sk_live_... node scripts/setup-camp-stripe.mjs",
  );
  process.exit(1);
}

const stripe = new Stripe(key);

// Guard: confirm we're on the NGA account, not L&D — a wrong-account write would
// scatter camp objects into the wrong business.
const NGA_ACCOUNT_ID = "acct_1TU4iSBpXOfTC961";
const acct = await stripe.accounts.retrieve();
if (acct.id !== NGA_ACCOUNT_ID) {
  console.error(
    `Refusing to run: key is for account ${acct.id}, expected NGA ${NGA_ACCOUNT_ID}.`,
  );
  process.exit(1);
}
console.log(`Account OK: ${acct.id}\n`);

const CURRENCY = "usd";
const PRODUCT_NAME = "NGA Summer Camp";

const OPTIONS = [
  { env: "STRIPE_CAMP_FULL_PRICE_ID", nickname: "Full day", lookup: "camp_full_week", cents: 29500 },
  { env: "STRIPE_CAMP_AM_PRICE_ID", nickname: "Morning half-day", lookup: "camp_am_week", cents: 17000 },
  { env: "STRIPE_CAMP_PM_PRICE_ID", nickname: "Afternoon half-day", lookup: "camp_pm_week", cents: 17000 },
];

// 1. Product
const products = await stripe.products.list({ limit: 100, active: true });
let product = products.data.find((p) => p.name === PRODUCT_NAME);
if (!product) {
  product = await stripe.products.create({
    name: PRODUCT_NAME,
    description:
      "Next Gen Pickleball Academy youth summer day camp (ages 6–16), Gaithersburg, MD. Weekly, Mon–Thu.",
  });
  console.log(`Created product ${product.id}`);
} else {
  console.log(`Found product ${product.id}`);
}

// 2. Prices (idempotent via lookup_key)
const envLines = [];
for (const opt of OPTIONS) {
  const existing = await stripe.prices.list({
    lookup_keys: [opt.lookup],
    limit: 1,
  });
  let price = existing.data[0];
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: opt.cents,
      currency: CURRENCY,
      nickname: opt.nickname,
      lookup_key: opt.lookup,
    });
    console.log(`Created price ${price.id} (${opt.nickname}, $${opt.cents / 100})`);
  } else {
    console.log(`Found price ${price.id} (${opt.nickname}, $${(price.unit_amount ?? 0) / 100})`);
  }
  envLines.push(`${opt.env}=${price.id}`);
}

// 3. MACKID promotion code = 15% off, restricted to the camp product.
const PROMO_CODE = "MACKID";
const PERCENT_OFF = 15;

const COUPON_NAME = "Macaroni Kid — 15% off camp";

const existingPromos = await stripe.promotionCodes.list({ code: PROMO_CODE, limit: 1 });
if (existingPromos.data[0]) {
  const pc = existingPromos.data[0];
  console.log(
    `\nFound promotion code ${PROMO_CODE} (${pc.id})` +
      (pc.active ? "" : " [INACTIVE — re-activate in Stripe if needed]"),
  );
} else {
  // Reuse an existing matching coupon (e.g. one left by a prior partial run)
  // rather than creating duplicates.
  const coupons = await stripe.coupons.list({ limit: 100 });
  let coupon = coupons.data.find(
    (c) => c.name === COUPON_NAME && c.percent_off === PERCENT_OFF && c.valid,
  );
  if (!coupon) {
    coupon = await stripe.coupons.create({
      name: COUPON_NAME,
      percent_off: PERCENT_OFF,
      duration: "once",
      applies_to: { products: [product.id] },
    });
    console.log(`\nCreated coupon ${coupon.id} (${PERCENT_OFF}% off, camp product only)`);
  } else {
    console.log(`\nReusing existing coupon ${coupon.id} (${PERCENT_OFF}% off)`);
  }
  // Stripe API (dahlia) nests the coupon under `promotion`, not a top-level
  // `coupon` param.
  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: PROMO_CODE,
    active: true,
  });
  console.log(`Created promotion code ${promo.code} (${promo.id})`);
}

console.log("\n=== Paste into .env.local + Vercel prod env ===");
for (const line of envLines) console.log(line);
console.log("\nMacaroni Kid families enter code MACKID at checkout for 15% off.");
