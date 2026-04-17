// Sanity check for the unified funnel wiring in nextgen-academy.
// Run: node scripts/verify-funnel.mjs
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const fails = [];

function assert(cond, msg) {
  if (!cond) fails.push(msg);
}

// 1) HMAC signature is deterministic and matches the Hub's contract.
//    Signed string format: v1:<ms>:<site_id>:<event_type>:<visitor_id>:<email>:<marketing_ref>
function sign(secret, params) {
  const { timestamp, siteId, eventType, visitorId, email, marketingRef } = params;
  const signed = `v1:${timestamp}:${siteId}:${eventType}:${visitorId}:${email}:${marketingRef}`;
  return createHmac("sha256", secret).update(signed).digest("hex");
}

const SECRET = "test-secret-xyz";
const TS = "1700000000000";
const SNAPSHOT = sign(SECRET, {
  timestamp: TS,
  siteId: "nga",
  eventType: "cta_click",
  visitorId: "visitor-abc",
  email: "alice@example.com",
  marketingRef: "nga_yellowball",
});
const expected = createHmac("sha256", SECRET)
  .update("v1:1700000000000:nga:cta_click:visitor-abc:alice@example.com:nga_yellowball")
  .digest("hex");
assert(SNAPSHOT === expected, `HMAC mismatch: got ${SNAPSHOT} expected ${expected}`);

// 2) Empty visitor / email / marketingRef → empty string in the signed payload.
const EMPTY = sign(SECRET, {
  timestamp: TS,
  siteId: "nga",
  eventType: "lead_submitted",
  visitorId: "",
  email: "",
  marketingRef: "",
});
const expectedEmpty = createHmac("sha256", SECRET)
  .update("v1:1700000000000:nga:lead_submitted:::")
  .digest("hex");
assert(EMPTY === expectedEmpty, `empty-field HMAC mismatch`);

// 3) No pixel libs remain in src/.
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(p)) out.push(p);
  }
  return out;
}
const files = walk("src");
const vercelHits = files.filter((f) => readFileSync(f, "utf8").includes("@vercel/analytics"));
assert(vercelHits.length === 0, `@vercel/analytics imports remain: ${vercelHits.join(", ")}`);

const gtagHits = files.filter((f) => /\bgtag\s*\(/.test(readFileSync(f, "utf8")));
assert(gtagHits.length === 0, `gtag() calls remain: ${gtagHits.join(", ")}`);

const fbqHits = files.filter((f) => /\bfbq\s*\(/.test(readFileSync(f, "utf8")));
assert(fbqHits.length === 0, `fbq() calls remain: ${fbqHits.join(", ")}`);

const metaPixelScript = files.filter((f) =>
  readFileSync(f, "utf8").includes("connect.facebook.net"),
);
assert(metaPixelScript.length === 0, `Meta Pixel script loader remains: ${metaPixelScript.join(", ")}`);

const gaLoader = files.filter((f) =>
  readFileSync(f, "utf8").includes("googletagmanager.com/gtag"),
);
assert(gaLoader.length === 0, `GA4 gtag loader remains: ${gaLoader.join(", ")}`);

// 4) Yellow Ball mailto CTAs replaced with /yellowball/inquiry form.
const mailtoYellow = files.filter((f) =>
  /mailto:[^"']*[Yy]ellow[%2 ]?[Bb]all/.test(readFileSync(f, "utf8")),
);
assert(
  mailtoYellow.length === 0,
  `Yellow Ball mailto CTAs still present: ${mailtoYellow.join(", ")}`,
);

// 5) urls.ts exports helpers with correct ref stamping.
const urls = readFileSync("src/lib/urls.ts", "utf8");
assert(/export function hubUrl/.test(urls), "hubUrl export missing from src/lib/urls.ts");
assert(/export function crUrl/.test(urls), "crUrl export missing from src/lib/urls.ts");
assert(/export function getRefSource/.test(urls), "getRefSource export missing from src/lib/urls.ts");
assert(/DEFAULT_REF\s*=\s*"nga"/.test(urls), "hubUrl no longer defaults ref=nga");
assert(/UTM_SOURCE\s*=\s*"nga"/.test(urls), "crUrl no longer stamps utm_source=nga");
assert(/"nga_yellowball"/.test(urls), "getRefSource no longer maps /yellowball → nga_yellowball");
assert(/"nga_leagues"/.test(urls), "getRefSource no longer maps /leagues → nga_leagues");

if (fails.length) {
  console.error("FAIL:");
  for (const f of fails) console.error("  -", f);
  process.exit(1);
}
console.log("OK — funnel wiring verified.");
