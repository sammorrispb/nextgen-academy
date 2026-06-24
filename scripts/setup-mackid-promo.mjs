#!/usr/bin/env node
// Idempotently provision the Macaroni Kid camp discount on the NGA Stripe
// account (acct_1TU4iSBpXOfTC961):
//
//   a "MACKID" promotion code = 15% off, restricted to the *live* camp
//   product(s) — i.e. whatever product owns STRIPE_CAMP_DAY_PRICE_ID ($50
//   single morning) and STRIPE_CAMP_WEEK_PRICE_ID ($150 full Mon–Thu week).
//
// Why this script (and not scripts/setup-camp-stripe.mjs):
//   setup-camp-stripe.mjs provisions a *future* expanded-schedule pricing model
//   (Full $295 / AM $170 / PM $170) on a NEW "NGA Summer Camp" product and
//   restricts its MACKID coupon to THAT product. The site's /api/checkout-camp
//   actually charges STRIPE_CAMP_DAY_PRICE_ID / STRIPE_CAMP_WEEK_PRICE_ID, which
//   live on a DIFFERENT product (prod_UdZrVIQyygPk87 per agent-log). A coupon
//   restricted to the wrong product silently fails to apply at checkout — the
//   parent types MACKID, sees no discount, and pays full price. This script
//   resolves the restriction from the SAME env vars the app reads, so the
//   coupon always matches the price that's actually charged.
//
// allow_promotion_codes is already true on the camp checkout, so once this
// code exists in Stripe, a Macaroni Kid family just types MACKID at checkout.
// The restriction keeps it off the $20 drop-in (a different product).
//
// Safe to re-run: the promo code and coupon are found-or-created. If MACKID
// already exists, the script verifies its coupon covers the live camp
// product(s) and reports — it never mutates or duplicates an existing code.
//
// Env required (run from a machine with the NGA secrets — the agent/MCP Stripe
// key reaches "Link and Dink", NOT NGA, so this MUST be run by Sam):
//   STRIPE_SECRET_KEY          — NGA account (acct_1TU4iSBpXOfTC961)
//   STRIPE_CAMP_DAY_PRICE_ID   — the $50 single-morning price
//   STRIPE_CAMP_WEEK_PRICE_ID  — the $150 full-week price
// All three are read from the environment or, failing that, from
// nextgen-academy/.env.local. Price IDs may also be passed as flags.
//
// Usage:
//   node scripts/setup-mackid-promo.mjs            # create / verify
//   node scripts/setup-mackid-promo.mjs --dry-run  # preview, no Stripe writes
//   node scripts/setup-mackid-promo.mjs \
//     --day-price=price_xxx --week-price=price_yyy

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";

const NGA_ACCOUNT_ID = "acct_1TU4iSBpXOfTC961";
const PROMO_CODE = "MACKID";
const PERCENT_OFF = 15;
const COUPON_NAME = "Macaroni Kid — 15% off camp";

function parseArgs(argv) {
  const out = {};
  for (const tok of argv.slice(2)) {
    if (tok === "--dry-run") { out["dry-run"] = true; continue; }
    if (!tok.startsWith("--")) continue;
    const eq = tok.indexOf("=");
    if (eq < 0) { out[tok.slice(2)] = true; continue; }
    out[tok.slice(2, eq)] = tok.slice(eq + 1);
  }
  return out;
}
const args = parseArgs(process.argv);

// Read a var from the process env, falling back to nextgen-academy/.env.local.
let envFileCache;
function fromEnv(name) {
  if (process.env[name]) return process.env[name];
  if (envFileCache === undefined) {
    try {
      const here = dirname(fileURLToPath(import.meta.url));
      envFileCache = readFileSync(join(here, "..", ".env.local"), "utf8");
    } catch {
      envFileCache = "";
    }
  }
  const line = envFileCache.split("\n").find((l) => l.startsWith(`${name}=`));
  return line
    ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "")
    : null;
}

const KEY = fromEnv("STRIPE_SECRET_KEY");
if (!KEY) {
  console.error(
    "STRIPE_SECRET_KEY not set and not found in .env.local. Pass the NGA key:\n" +
      "  STRIPE_SECRET_KEY=sk_live_... node scripts/setup-mackid-promo.mjs",
  );
  process.exit(1);
}

const dayPriceId = args["day-price"] || fromEnv("STRIPE_CAMP_DAY_PRICE_ID");
const weekPriceId = args["week-price"] || fromEnv("STRIPE_CAMP_WEEK_PRICE_ID");
if (!dayPriceId || !weekPriceId) {
  console.error(
    "Need the live camp price IDs to scope the coupon. Set both\n" +
      "  STRIPE_CAMP_DAY_PRICE_ID and STRIPE_CAMP_WEEK_PRICE_ID\n" +
      "in the environment or .env.local, or pass --day-price= / --week-price=.",
  );
  process.exit(1);
}

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe GET ${path}: ${data?.error?.message ?? res.statusText}`);
  }
  return data;
}

async function stripePost(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe POST ${path}: ${data?.error?.message ?? res.statusText}`);
  }
  return data;
}

// Guard: a wrong-account write would scatter a camp coupon into Link & Dink.
const acct = await stripeGet("account");
if (acct.id !== NGA_ACCOUNT_ID) {
  console.error(
    `Refusing to run: key is for account ${acct.id} ` +
      `(${acct.settings?.dashboard?.display_name ?? "unknown"}), ` +
      `expected NGA ${NGA_ACCOUNT_ID}.\n` +
      "The agent/MCP Stripe key only reaches Link & Dink — run this with the " +
      "NGA secret key.",
  );
  process.exit(1);
}
console.log(`Account OK: ${acct.id} (NGA)\n`);

// Resolve the products the live camp prices belong to — the coupon restricts
// to exactly these so MACKID applies to the real $50/$150 charge and nothing
// else (notably not the $20 drop-in, a separate product).
const dayPrice = await stripeGet(`prices/${dayPriceId}`);
const weekPrice = await stripeGet(`prices/${weekPriceId}`);
const campProducts = [...new Set([dayPrice.product, weekPrice.product])];

console.log("Live camp prices:");
console.log(`  day  ${dayPrice.id}  $${(dayPrice.unit_amount ?? 0) / 100}  product ${dayPrice.product}`);
console.log(`  week ${weekPrice.id}  $${(weekPrice.unit_amount ?? 0) / 100}  product ${weekPrice.product}`);
console.log(`Coupon will be restricted to product(s): ${campProducts.join(", ")}\n`);

function couponCoversCamp(coupon) {
  const restricted = coupon?.applies_to?.products;
  if (!restricted) return false; // unrestricted = applies to everything incl. drop-in
  return campProducts.every((p) => restricted.includes(p));
}

// Already provisioned? Verify and stop — never mutate or duplicate.
const existing = await stripeGet(
  `promotion_codes?code=${encodeURIComponent(PROMO_CODE)}&limit=1`,
);
if (existing.data[0]) {
  const pc = existing.data[0];
  const covers = couponCoversCamp(pc.coupon);
  console.log(
    `Found existing promotion code ${PROMO_CODE} (${pc.id})\n` +
      `  active:        ${pc.active}\n` +
      `  coupon:        ${pc.coupon?.id} (${pc.coupon?.percent_off}% off)\n` +
      `  applies_to:    ${JSON.stringify(pc.coupon?.applies_to?.products ?? "ALL products")}\n` +
      `  covers camp:   ${covers ? "yes ✓" : "NO ✗"}`,
  );
  if (!pc.active) {
    console.log("\n⚠  Code is INACTIVE — re-activate it in the Stripe Dashboard.");
  }
  if (!covers) {
    console.log(
      "\n⚠  This code does NOT cover the live camp product(s) above, so a parent " +
        "entering MACKID would see no discount. Archive it in Stripe and re-run " +
        "this script, or widen its coupon's product restriction to include them.",
    );
  }
  if (pc.active && covers) {
    console.log("\nNothing to do — MACKID is live and scoped to the camp. ✓");
  }
  process.exit(0);
}

if (args["dry-run"]) {
  console.log(
    `--dry-run set; would create:\n` +
      `  coupon "${COUPON_NAME}" — ${PERCENT_OFF}% off, applies_to ${campProducts.join(", ")}\n` +
      `  promotion code ${PROMO_CODE} (active, unlimited redemptions)`,
  );
  process.exit(0);
}

// Reuse a matching coupon from a prior partial run rather than duplicating.
const coupons = await stripeGet("coupons?limit=100");
let coupon = coupons.data.find(
  (c) => c.name === COUPON_NAME && c.percent_off === PERCENT_OFF && c.valid && couponCoversCamp(c),
);
if (!coupon) {
  const params = {
    name: COUPON_NAME,
    percent_off: String(PERCENT_OFF),
    duration: "once",
  };
  campProducts.forEach((p, i) => { params[`applies_to[products][${i}]`] = p; });
  coupon = await stripePost("coupons", params);
  console.log(`Created coupon ${coupon.id} (${PERCENT_OFF}% off, camp product only)`);
} else {
  console.log(`Reusing existing coupon ${coupon.id} (${PERCENT_OFF}% off)`);
}

const promo = await stripePost("promotion_codes", {
  "promotion[type]": "coupon",
  "promotion[coupon]": coupon.id,
  code: PROMO_CODE,
  active: "true",
});
console.log(`Created promotion code ${promo.code} (${promo.id})`);
console.log("\nMacaroni Kid families enter code MACKID at checkout for 15% off. ✓");
