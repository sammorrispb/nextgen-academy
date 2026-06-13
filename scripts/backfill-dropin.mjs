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

// Player CRM DB — mirrors NOTION_DB_ID in src/lib/notion-player-sync.ts. Env
// override allowed; the lib's hardcoded default is the fallback.
const PLAYERS_DB = process.env.NOTION_DB_ID || "1e5e34c258384c6cb5f3e846543ecfc7";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_OPTIONS = [
  "Redland MS", "Shannon MS", "Frost MS", "Gaithersburg HS", "Sherwood HS",
  "Westland MS", "Cabin John MS", "Walter Johnson HS", "Olney area", "Camp",
  "Other / TBD",
];
const jsonHeaders = {
  Authorization: `Bearer ${NOTION_KEY}`,
  "Content-Type": "application/json",
  "Notion-Version": NOTION_VERSION,
};

// ---- webhook-parity side-effects (best-effort; never throw) ----
// These faithfully replay what the Stripe webhook's after() block does for a
// drop-in beyond the roster row. KEEP IN SYNC with the cited source functions.

// Mirrors incrementSessionRegistered() + computeRegistrationIncrement() in
// src/lib/notion-sessions.ts: read the session row, bump Registered count
// (opening a court + flipping Status=Full at capacity per Court count × 4),
// write it back.
async function incrementSessionRegistered(sessionRowId) {
  try {
    if (!sessionRowId) {
      console.error("[backfill] no session_id in metadata — skipping count increment (bump Registered count by hand)");
      return;
    }
    const gres = await fetch(`${NOTION_API}/pages/${sessionRowId}`, {
      headers: { Authorization: `Bearer ${NOTION_KEY}`, "Notion-Version": NOTION_VERSION },
    });
    if (!gres.ok) {
      console.error(`[backfill] session read failed ${gres.status} — skipping count increment`);
      return;
    }
    const sp = ((await gres.json()).properties) ?? {};
    const num = (p) => (typeof p?.number === "number" ? p.number : 0);
    const registeredCount = num(sp["Registered count"]);
    const courtCount = num(sp["Court count"]) || 1;
    const maxCourts = Math.max(num(sp["Max courts"]), courtCount);
    const status = sp["Status"]?.select?.name ?? "Open";

    const newCount = registeredCount + 1;
    let newCourtCount = courtCount;
    while (newCount >= newCourtCount * 4 - 1 && newCourtCount < maxCourts) newCourtCount += 1;
    const newStatus = newCount >= newCourtCount * 4 ? "Full" : status;

    const pres = await fetch(`${NOTION_API}/pages/${sessionRowId}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({
        properties: {
          "Registered count": { number: newCount },
          "Court count": { number: newCourtCount },
          Status: { select: { name: newStatus } },
        },
      }),
    });
    if (!pres.ok) {
      console.error(`[backfill] session count PATCH failed ${pres.status}: ${await pres.text().catch(() => "")}`);
      return;
    }
    console.error(`[backfill] session count ${registeredCount} → ${newCount} (courts ${newCourtCount}, status ${newStatus})`);
  } catch (e) {
    console.error(`[backfill] session count increment errored: ${e?.message ?? e}`);
  }
}

// Pure helpers ported from src/lib/notion-player-sync.ts (unit-tested there).
function currentSeasonLabel(now = new Date()) {
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  if (mo <= 1) return `Winter ${y}`;
  if (mo === 11) return `Winter ${y + 1}`;
  if (mo <= 4) return `Spring ${y}`;
  if (mo <= 7) return `Summer ${y}`;
  return `Fall ${y}`;
}
function ageFromBirthYear(birthYear, now = new Date()) {
  if (!birthYear || birthYear < 1900) return undefined;
  const age = now.getUTCFullYear() - birthYear;
  return age >= 0 && age <= 100 ? age : undefined;
}
function matchSite(location) {
  const loc = location?.trim().toLowerCase();
  if (!loc) return undefined;
  return SITE_OPTIONS.find((o) => loc.includes(o.toLowerCase()));
}

// Mirrors syncPlayerFromDropIn() + findPlayerRow() in
// src/lib/notion-player-sync.ts: upsert the player into the Player CRM so a
// backfilled drop-in lands a player row (or refreshes Last Attended) just like
// a webhook registration. Same egress + same child fields (first name + age)
// as the live path — no new PII destination.
async function syncPlayerFromDropIn(r) {
  try {
    const email = r.parentEmail?.trim() || null;
    const phone = r.parentPhone?.trim() || "";
    if (!email && !phone) {
      console.error("[backfill] no parent email/phone — skipping player CRM sync");
      return;
    }
    const contactFilter =
      email && EMAIL_RE.test(email)
        ? { property: "Parent Email", email: { equals: email } }
        : phone
          ? { property: "Parent Phone", phone_number: { equals: phone } }
          : null;
    if (!contactFilter) {
      console.error("[backfill] no usable contact filter — skipping player CRM sync");
      return;
    }
    const child = r.childFirstName?.trim();
    const filter = child
      ? { and: [contactFilter, { property: "Player Name", title: { contains: child } }] }
      : contactFilter;

    const qres = await fetch(`${NOTION_API}/databases/${PLAYERS_DB}/query`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ filter, page_size: 1 }),
    });
    if (!qres.ok) {
      console.error(`[backfill] player query failed ${qres.status} — skipping player CRM sync`);
      return;
    }
    const existingId = (await qres.json()).results?.[0]?.id ?? null;

    if (existingId) {
      const ures = await fetch(`${NOTION_API}/pages/${existingId}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          properties: {
            "Last Attended": { date: { start: r.sessionDate } },
            Status: { select: { name: "Active" } },
          },
        }),
      });
      if (!ures.ok) {
        console.error(`[backfill] player update failed ${ures.status}`);
        return;
      }
      console.error(`[backfill] player CRM: refreshed existing row ${existingId}`);
      return;
    }

    const titleText = child || `Child of ${r.parentName}`;
    const age = ageFromBirthYear(r.childBirthYear);
    const site = matchSite(r.location);
    const properties = {
      "Player Name": { title: [{ text: { content: titleText } }] },
      "Parent Name": { rich_text: [{ text: { content: r.parentName } }] },
      Status: { select: { name: "Active" } },
      Source: { select: { name: "Website" } },
      Audience: { select: { name: "Youth" } },
      Season: { select: { name: currentSeasonLabel() } },
      "Last Attended": { date: { start: r.sessionDate } },
      Notes: {
        rich_text: [
          { text: { content: "Auto-created from a backfilled paid website drop-in registration." } },
        ],
      },
    };
    if (email) properties["Parent Email"] = { email };
    if (phone) properties["Parent Phone"] = { phone_number: phone };
    if (age !== undefined) properties.Age = { number: age };
    if (site) properties.Site = { select: { name: site } };

    const cres2 = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ parent: { database_id: PLAYERS_DB }, properties }),
    });
    if (!cres2.ok) {
      console.error(`[backfill] player create failed ${cres2.status}: ${await cres2.text().catch(() => "")}`);
      return;
    }
    console.error("[backfill] player CRM: created new player row");
  } catch (e) {
    console.error(`[backfill] player CRM sync errored: ${e?.message ?? e}`);
  }
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

// Mirror the webhook's after() side-effects so a backfilled registration is
// indistinguishable from a normal one (the row create above is the equivalent
// of the webhook's critical path; these are the best-effort follow-ons it runs
// post-ack). Each is isolated + non-throwing: a failure here must not undo the
// roster row that already landed. Without them, a backfill silently under-counts
// the session (wrong fill meter / a Full session reads Open) and skips the
// Player CRM mirror — exactly the drift hand-fixed after the 2026-06-13 incident.
await incrementSessionRegistered(metaString(m, "session_id"));
await syncPlayerFromDropIn(row);

console.log(created.url ?? created.id);
