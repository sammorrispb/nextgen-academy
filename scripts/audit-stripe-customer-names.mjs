#!/usr/bin/env node
// READ-ONLY audit of NGA Stripe customer names.
//
// Until 2026-09-28 (#375) the lesson, Monday Girls drop-in and MVF invoice
// routes stored whatever name was typed on an anonymous form as the Stripe
// customer's name, and Stripe prints that name on every future invoice to
// that customer. The fix cleans new names; this lists the customers created
// before it whose stored name carries a link-shaped character, so Sam can
// review them in the Stripe dashboard.
//
// Output: one line per flagged customer — id, created date (UTC), reason
// codes — then a summary with how many customers were scanned. It NEVER
// prints a name or an email, and it only ever sends GET /v1/customers.
//
// Reason codes:
//   punct      the name contains . : / or @
//   digit      the name contains a digit (any script)
//   lookalike  a look-alike (any modifier letter, ꞏ, ǀ ǁ ǂ ǃ), a mark
//              outside the name-accent allowlist, or a mark not on a letter
//   non_latin  a character from another script: a real name (review, don't
//              assume abuse) or a look-alike such as the Lisu dot ꓸ
//   other      anything else the invoice cleaner would strip (<, !, emoji…)
//
// Env: STRIPE_SECRET_KEY — the NGA account (acct_1TU4iSBpXOfTC961). Prefer a
// restricted key (rk_…) with only "Customers: Read".
//
// Run:  node scripts/audit-stripe-customer-names.mjs

import process from "node:process";
import { pathToFileURL } from "node:url";

const STRIPE_CUSTOMERS = "https://api.stripe.com/v1/customers";
const PAGE_SIZE = 100;

// Mirrors cleanPersonName() in src/lib/invoice-text.ts (a plain script can't
// import the TypeScript module under every runner). The invoice spec runs the
// same fixtures through both, so the two cannot drift silently.
const NOT_A_NAME_CHARACTER =
  /(?:[^\p{Script=Latin}\u0300-\u0304\u0306-\u030C\u030F\u0311\u031B\u0323-\u0328\u0331'’\- ]|[\p{Lm}\uA78F\u01C0-\u01C3])+/gu;
const MARK_NOT_ON_A_LETTER = /(?<![\p{L}\p{M}])\p{M}+/gu;
// 40 code points, not 40 UTF-16 units: a unit cut can split an astral letter
// into a lone surrogate, which Stripe's form encoder throws on.
const FIRST_40_CHARACTERS = /^([\s\S]{0,40})[\s\S]*$/u;

export function cleanPersonName(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFC")
    .replace(NOT_A_NAME_CHARACTER, " ")
    .replace(MARK_NOT_ON_A_LETTER, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(FIRST_40_CHARACTERS, "$1")
    .trim();
}

const LATIN_LOOKALIKE =
  /[\p{Lm}\uA78F\u01C0-\u01C3]|(?![\u0300-\u0304\u0306-\u030C\u030F\u0311\u031B\u0323-\u0328\u0331])\p{M}|(?<![\p{L}\p{M}])\p{M}/u;
const OTHER_SCRIPT = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

/** Reason codes for one stored name; [] when it is clean. */
export function nameAuditReasons(name) {
  if (typeof name !== "string" || name.trim() === "") return [];
  const n = name.normalize("NFC");
  const reasons = [];
  if (/[.:/@]/.test(n)) reasons.push("punct");
  if (/\p{Nd}/u.test(n)) reasons.push("digit");
  if (LATIN_LOOKALIKE.test(n)) reasons.push("lookalike");
  if (OTHER_SCRIPT.test(n)) reasons.push("non_latin");
  if (
    reasons.length === 0 &&
    // Compared uncapped: a clean name over 40 characters is not a finding.
    cleanPersonName(n) !== n.replace(/\s+/g, " ").trim().replace(FIRST_40_CHARACTERS, "$1").trim()
  ) {
    reasons.push("other");
  }
  return reasons;
}

/**
 * Page through every customer (GET only) and write one line per flagged
 * customer. Returns { scanned, flagged }.
 */
export async function auditCustomers({ apiKey, fetchImpl = fetch, write }) {
  let scanned = 0;
  let flagged = 0;
  let startingAfter;
  for (;;) {
    const url = new URL(STRIPE_CUSTOMERS);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);
    const res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      // Status only: an error body is not ours to echo.
      throw new Error(`Stripe customer list failed: HTTP ${res.status}`);
    }
    const page = await res.json();
    const customers = Array.isArray(page.data) ? page.data : [];
    if (page.has_more && customers.length === 0) {
      // Stopping here would print a partial count that reads like a clean scan.
      throw new Error(`Stripe customer list incomplete: an empty page claimed more after ${scanned} customers`);
    }
    for (const customer of customers) {
      scanned += 1;
      const reasons = nameAuditReasons(customer.name);
      if (reasons.length === 0) continue;
      flagged += 1;
      const created = new Date(customer.created * 1000).toISOString().slice(0, 10);
      write(`${customer.id}\t${created}\t${reasons.join(",")}`);
    }
    if (!page.has_more || customers.length === 0) break;
    startingAfter = customers[customers.length - 1].id;
  }
  write(`scanned ${scanned} customers, flagged ${flagged}`);
  return { scanned, flagged };
}

async function main() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    console.error("STRIPE_SECRET_KEY is not set (NGA account; an rk_ key with Customers: Read is enough).");
    process.exit(2);
  }
  try {
    await auditCustomers({ apiKey, write: (line) => console.log(line) });
  } catch (err) {
    console.error(err instanceof Error ? err.message : "audit failed");
    process.exit(1);
  }
}

// No top-level await: the spec imports this module through a require()-based loader.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
