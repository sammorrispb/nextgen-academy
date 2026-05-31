#!/usr/bin/env node
// Backfill the NGA Player CRM (Player Database) from existing paid Drop-in
// Registration rows. Historically only the lead form wrote to the Player DB, so
// every parent who registered + paid on the website is missing a player row (or
// has a stale Last Attended). This sweeps the Drop-ins DB and upserts each one,
// mirroring src/lib/notion-player-sync.ts exactly.
//
// Dedup: matches an existing player row by Parent Email (or Parent Phone) AND
// Player Name contains the child's first name, so re-running is safe and
// siblings don't collapse into one row. Coach-owned fields (Site on update,
// Level, Skill Rating) are never touched.
//
// Env required (NGA secrets):
//   NOTION_API_KEY
//   NOTION_DROPINS_DB_ID   — NGA Drop-in Registrations DB (557f01d8-...)
//
// Usage (dry run is the default — prints the plan, writes nothing):
//   node --env-file=.env.local scripts/backfill-players-from-dropins.mjs
//   node --env-file=.env.local scripts/backfill-players-from-dropins.mjs --live

import process from "node:process";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const PLAYER_DB_ID = "1e5e34c258384c6cb5f3e846543ecfc7";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SITE_OPTIONS = [
  "Redland MS",
  "Shannon MS",
  "Frost MS",
  "Gaithersburg HS",
  "Sherwood HS",
  "Westland MS",
  "Cabin John MS",
  "Olney area",
  "Camp",
  "Other / TBD",
];

const LIVE = process.argv.slice(2).includes("--live");

// Test registrations Sam ran through Stripe — never mirror these into the CRM.
const TEST_EMAILS = new Set(["sam.morris2131@gmail.com"]);
const isTestRow = (d) =>
  TEST_EMAILS.has((d.parentEmail || "").toLowerCase()) ||
  d.childFirstName.trim().toLowerCase() === "test";
const NOTION_KEY = process.env.NOTION_API_KEY;
const DROPINS_DB_ID = process.env.NOTION_DROPINS_DB_ID;

if (!NOTION_KEY || !DROPINS_DB_ID) {
  console.error("Missing NOTION_API_KEY or NOTION_DROPINS_DB_ID in env.");
  process.exit(1);
}

function headers() {
  return {
    Authorization: `Bearer ${NOTION_KEY}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

function currentSeasonLabel(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (m >= 0 && m <= 1) return `Winter ${y}`;
  if (m === 11) return `Winter ${y + 1}`;
  if (m >= 2 && m <= 4) return `Spring ${y}`;
  if (m >= 5 && m <= 7) return `Summer ${y}`;
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

const plain = (rich) => (rich ?? []).map((r) => r.plain_text ?? r.text?.content ?? "").join("");

// Reads every drop-in row, projecting only the fields the player sync needs.
async function fetchAllDropIns() {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`${NOTION_API}/databases/${DROPINS_DB_ID}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!res.ok) throw new Error(`drop-ins query failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    for (const page of data.results ?? []) {
      const p = page.properties ?? {};
      rows.push({
        parentName: plain(p["Parent Name"]?.rich_text) || plain(p["Parent Name"]?.title),
        parentEmail: p["Parent Email"]?.email ?? null,
        parentPhone: p["Parent Phone"]?.phone_number ?? "",
        childFirstName:
          plain(p["Child First Name"]?.rich_text) || plain(p["Child First Name"]?.title) || "",
        childBirthYear: p["Child Birth Year"]?.number ?? 0,
        sessionDate: p["Session Date"]?.date?.start ?? "",
        location: plain(p["Location"]?.rich_text) || p["Location"]?.select?.name || "",
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}

async function findPlayerRow(email, phone, childFirstName) {
  const contactFilter =
    email && EMAIL_RE.test(email)
      ? { property: "Parent Email", email: { equals: email } }
      : phone
        ? { property: "Parent Phone", phone_number: { equals: phone } }
        : null;
  if (!contactFilter) return "no-contact";
  const child = childFirstName?.trim();
  const filter = child
    ? { and: [contactFilter, { property: "Player Name", title: { contains: child } }] }
    : contactFilter;
  const res = await fetch(`${NOTION_API}/databases/${PLAYER_DB_ID}/query`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ filter, page_size: 1 }),
  });
  if (!res.ok) throw new Error(`player query failed (${res.status})`);
  const data = await res.json();
  return data.results?.length ? data.results[0].id : null;
}

async function updatePlayer(id, sessionDate) {
  const res = await fetch(`${NOTION_API}/pages/${id}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({
      properties: {
        "Last Attended": { date: { start: sessionDate } },
        Status: { select: { name: "Active" } },
      },
    }),
  });
  if (!res.ok) throw new Error(`player update failed (${res.status}): ${await res.text()}`);
}

async function createPlayer(d) {
  const titleText = d.childFirstName.trim() || `Child of ${d.parentName}`;
  const age = ageFromBirthYear(d.childBirthYear);
  const site = matchSite(d.location);
  const properties = {
    "Player Name": { title: [{ text: { content: titleText } }] },
    "Parent Name": { rich_text: [{ text: { content: d.parentName } }] },
    Status: { select: { name: "Active" } },
    Source: { select: { name: "Website" } },
    Audience: { select: { name: "Youth" } },
    Season: { select: { name: currentSeasonLabel() } },
    "Last Attended": { date: { start: d.sessionDate } },
    Notes: {
      rich_text: [
        { text: { content: "Backfilled from a paid website drop-in registration." } },
      ],
    },
  };
  if (d.parentEmail) properties["Parent Email"] = { email: d.parentEmail };
  if (d.parentPhone) properties["Parent Phone"] = { phone_number: d.parentPhone };
  if (age !== undefined) properties.Age = { number: age };
  if (site) properties.Site = { select: { name: site } };
  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ parent: { database_id: PLAYER_DB_ID }, properties }),
  });
  if (!res.ok) throw new Error(`player create failed (${res.status}): ${await res.text()}`);
}

// Most-recent session per (parent, child) wins so Last Attended is correct and
// we don't fire one update per historical row.
function dedupeLatest(rows) {
  const byKey = new Map();
  for (const r of rows) {
    if (!r.sessionDate) continue;
    if (!r.parentEmail && !r.parentPhone) continue;
    if (isTestRow(r)) continue;
    const key = `${(r.parentEmail || r.parentPhone).toLowerCase()}::${r.childFirstName.trim().toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev || r.sessionDate > prev.sessionDate) byKey.set(key, r);
  }
  return [...byKey.values()];
}

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE (writing to Player DB)" : "DRY RUN (no writes)"}\n`);
  const all = await fetchAllDropIns();
  const targets = dedupeLatest(all);
  console.log(`Drop-in rows: ${all.length} → ${targets.length} unique (parent, child) to reconcile.\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errored = 0;

  for (const d of targets) {
    const label = `${d.childFirstName || "(no child)"} / ${d.parentEmail || d.parentPhone}`;
    try {
      const existing = await findPlayerRow(d.parentEmail, d.parentPhone, d.childFirstName);
      if (existing === "no-contact") {
        skipped++;
        console.log(`SKIP  ${label} — no parent contact`);
        continue;
      }
      if (existing) {
        if (LIVE) await updatePlayer(existing, d.sessionDate);
        updated++;
        console.log(`UPDATE ${label} — Last Attended ${d.sessionDate}`);
      } else {
        if (LIVE) await createPlayer(d);
        created++;
        console.log(`CREATE ${label} — Last Attended ${d.sessionDate}`);
      }
    } catch (err) {
      errored++;
      console.error(`ERROR ${label} —`, err.message);
    }
  }

  console.log(
    `\nDone. created=${created} updated=${updated} skipped=${skipped} errored=${errored}${
      LIVE ? "" : "  (dry run — re-run with --live to apply)"
    }`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
