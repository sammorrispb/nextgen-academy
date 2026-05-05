#!/usr/bin/env node
// Idempotently ensure NGA's $35 drop-in product + price exist on
// acct_1SOoW57210nhTc4j. Prints the price ID to paste into
// STRIPE_DROPIN_PRICE_ID in .env.local + Vercel.
//
// Usage:  STRIPE_SECRET_KEY=sk_live_... node scripts/setup-stripe-product.mjs

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY not set");
  process.exit(1);
}

const stripe = new Stripe(key);

const PRODUCT_NAME = "NGA Drop-in Session";
const UNIT_AMOUNT_CENTS = 3500;
const CURRENCY = "usd";

const products = await stripe.products.list({ limit: 100, active: true });
let product = products.data.find((p) => p.name === PRODUCT_NAME);
if (!product) {
  product = await stripe.products.create({
    name: PRODUCT_NAME,
    description:
      "Single drop-in pickleball session at Next Gen Pickleball Academy. Non-refundable.",
  });
  console.log(`Created product ${product.id}`);
} else {
  console.log(`Found product ${product.id}`);
}

const prices = await stripe.prices.list({ product: product.id, limit: 100 });
let price = prices.data.find(
  (p) =>
    p.unit_amount === UNIT_AMOUNT_CENTS &&
    p.currency === CURRENCY &&
    p.active &&
    !p.recurring,
);
if (!price) {
  price = await stripe.prices.create({
    product: product.id,
    unit_amount: UNIT_AMOUNT_CENTS,
    currency: CURRENCY,
  });
  console.log(`Created price ${price.id}`);
} else {
  console.log(`Found price ${price.id}`);
}

console.log("\nAdd to .env.local + Vercel env:");
console.log(`STRIPE_DROPIN_PRICE_ID=${price.id}`);
