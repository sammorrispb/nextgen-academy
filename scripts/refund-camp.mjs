#!/usr/bin/env node
// Refund + deregister a Summer Camp registration. Camps are a separate product
// from the $20 drop-in: they write NO Notion roster row, so the drop-in cancel
// tooling (/api/cancel-registration, cancelDropIn, the charge.refunded webhook)
// is a no-op for them. This is the runnable camp equivalent — it finds the camp
// Checkout Session in Stripe, issues the refund, and deregisters the camper in
// the Player CRM (Status -> Inactive + dated note) + (optionally) Open Brain.
//
// Mirrors the logic in src/lib/cancel-camp.ts, kept as a creds-gated CLI because
// the API route needs the app deployed + NGA_ADMIN_SECRET. ALWAYS --dry-run
// first to confirm the right session + amount before a live refund.
//
// Env required:
//   STRIPE_SECRET_KEY, NOTION_API_KEY          (refund + Player CRM)
//   RESEND_API_KEY                             (parent confirmation email; optional)
//   OPEN_BRAIN_INGEST_URL, LEAD_INGEST_TOKEN   (OB withdrawal activity; optional)
//
// Examples:
//   node scripts/refund-camp.mjs --email=parent@example.com --dry-run
//   node scripts/refund-camp.mjs --email=parent@example.com           # full refund
//   node scripts/refund-camp.mjs --checkout-session-id=cs_live_... --amount-cents=14750

import process from "node:process";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const PLAYER_DB_ID = "1e5e34c258384c6cb5f3e846543ecfc7";
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

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
const dryRun = args["dry-run"] === "true";
const email = args.email;
const csId = args["checkout-session-id"];
const amountCents = args["amount-cents"] ? Number(args["amount-cents"]) : undefined;

if (!email && !csId) {
  console.error("Missing --email=<parent email> or --checkout-session-id=<cs_...>");
  process.exit(1);
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const NOTION_KEY = process.env.NOTION_API_KEY;
if (!STRIPE_KEY || !NOTION_KEY) {
  console.error("Missing env: need STRIPE_SECRET_KEY and NOTION_API_KEY");
  process.exit(1);
}

const stripeHeaders = { Authorization: `Bearer ${STRIPE_KEY}` };
const notionHeaders = {
  Authorization: `Bearer ${NOTION_KEY}`,
  "Content-Type": "application/json",
  "Notion-Version": NOTION_VERSION,
};

function metaString(meta, key) {
  return typeof meta?.[key] === "string" ? meta[key] : "";
}

function sessionEmail(s) {
  return (
    s.customer_details?.email ||
    s.customer_email ||
    metaString(s.metadata, "parent_email") ||
    ""
  ).toLowerCase();
}

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: stripeHeaders });
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${body?.error?.message ?? res.statusText}`);
  return body;
}

// 1) Resolve the camp Checkout Session.
let session;
if (csId) {
  session = await stripeGet(`checkout/sessions/${csId}`);
} else {
  const target = email.toLowerCase();
  const matches = [];
  let startingAfter = null;
  let scanned = 0;
  paging: while (scanned < 1000) {
    const q = new URLSearchParams({ limit: "100" });
    if (startingAfter) q.set("starting_after", startingAfter);
    const page = await stripeGet(`checkout/sessions?${q.toString()}`);
    for (const s of page.data) {
      scanned += 1;
      if (sessionEmail(s) === target && s.metadata?.kind === "camp") {
        matches.push(s);
        if (matches.length >= 5) break paging;
      }
    }
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  const paid = matches
    .filter((s) => s.payment_status === "paid")
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  session = paid[0];
  if (!session) {
    console.error(`No paid camp checkout found for ${email} (scanned ${scanned} sessions).`);
    process.exit(1);
  }
}

if (session.metadata?.kind !== "camp") {
  console.error(`Session ${session.id} is not a camp registration (kind=${session.metadata?.kind}).`);
  process.exit(1);
}
if (session.payment_status !== "paid") {
  console.error(`Session ${session.id} is ${session.payment_status}, not paid.`);
  process.exit(1);
}

const m = session.metadata ?? {};
const amountPaidUsd = (session.amount_total ?? 0) / 100;
const piId =
  typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
const parentName = metaString(m, "parent_name");
const parentEmail = sessionEmail(session);
const parentPhone = metaString(m, "parent_phone");
const childFirst = metaString(m, "child_first_name");
const campTitle = metaString(m, "camp_title");
const campWeek = metaString(m, "camp_week");
const optionLabel = metaString(m, "option_label");
const refundUsd = amountCents != null ? amountCents / 100 : amountPaidUsd;

console.error("── Camp registration ──────────────────────────────");
console.error(JSON.stringify({
  checkoutSession: session.id,
  paymentIntent: piId,
  parentName, parentEmail, parentPhone,
  child: childFirst,
  camp: `${campTitle} (${campWeek})`,
  option: optionLabel,
  amountPaidUsd,
  willRefundUsd: refundUsd,
}, null, 2));

if (dryRun) {
  console.error("\n[dry-run] No refund issued, no records changed. Re-run without --dry-run to execute.");
  process.exit(0);
}

if (!piId) {
  console.error("No payment intent on the session — cannot refund.");
  process.exit(1);
}

// 2) Refund in Stripe (idempotent on already-refunded).
const refundForm = new URLSearchParams({ payment_intent: piId });
if (amountCents != null) refundForm.set("amount", String(amountCents));
const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
  method: "POST",
  headers: { ...stripeHeaders, "Content-Type": "application/x-www-form-urlencoded" },
  body: refundForm,
});
const refundBody = await refundRes.json();
if (!refundRes.ok) {
  const msg = refundBody?.error?.message ?? refundRes.statusText;
  if (/already.*refund/i.test(msg)) {
    console.error("Already refunded in Stripe — continuing to deregister.");
  } else {
    console.error(`Stripe refund FAILED: ${msg}`);
    process.exit(1);
  }
} else {
  console.error(`Refund issued: ${refundBody.id} ($${(refundBody.amount / 100).toFixed(2)}, status ${refundBody.status})`);
}

const today = new Date().toISOString().slice(0, 10);
const note = `Withdrawn from ${campTitle} (${campWeek}) — $${refundUsd.toFixed(2)} refunded ${today}.`;

// 3) Deregister in the Player CRM (Status -> Inactive + append note).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const contactFilter = EMAIL_RE.test(parentEmail)
  ? { property: "Parent Email", email: { equals: parentEmail } }
  : parentPhone
    ? { property: "Parent Phone", phone_number: { equals: parentPhone } }
    : null;
if (contactFilter) {
  const filter = childFirst
    ? { and: [contactFilter, { property: "Player Name", title: { contains: childFirst } }] }
    : contactFilter;
  const qres = await fetch(`${NOTION_API}/databases/${PLAYER_DB_ID}/query`, {
    method: "POST", headers: notionHeaders, body: JSON.stringify({ filter, page_size: 1 }),
  });
  const qdata = await qres.json();
  const pageId = qres.ok && qdata.results?.length ? qdata.results[0].id : null;
  if (pageId) {
    const existingNotes =
      qdata.results[0].properties?.Notes?.rich_text?.map((r) => r.plain_text ?? "").join("") ?? "";
    const combined = existingNotes ? `${existingNotes}\n${note}` : note;
    const pres = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH", headers: notionHeaders,
      body: JSON.stringify({
        properties: {
          Status: { select: { name: "Inactive" } },
          Notes: { rich_text: [{ text: { content: combined.slice(0, 1900) } }] },
        },
      }),
    });
    console.error(pres.ok ? `Player CRM row ${pageId} -> Inactive + note.` : `Player CRM update FAILED (${pres.status}).`);
  } else {
    console.error("No Player CRM row matched — skipped (nothing to deregister there).");
  }
} else {
  console.error("No email/phone to match a Player CRM row — skipped.");
}

// 4) Open Brain withdrawal activity (optional — only if ingest env is set).
if (process.env.OPEN_BRAIN_INGEST_URL && process.env.LEAD_INGEST_TOKEN) {
  try {
    const obres = await fetch(process.env.OPEN_BRAIN_INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-lead-ingest-token": process.env.LEAD_INGEST_TOKEN },
      body: JSON.stringify({
        business: "nga", source: "nga_camp_refund", name: parentName,
        email: parentEmail || undefined, phone: parentPhone || undefined,
        interest: `${campTitle} (${optionLabel}) — withdrawn`,
        metadata: { camp_title: campTitle, camp_week: campWeek, option: optionLabel, child_first_name: childFirst, refunded_usd: refundUsd.toFixed(2), stripe_session: session.id },
      }),
    });
    console.error(obres.ok ? "Open Brain withdrawal activity logged." : `Open Brain ingest non-OK (${obres.status}).`);
  } catch (err) {
    console.error("Open Brain ingest threw:", err.message);
  }
} else {
  console.error("Open Brain ingest env not set — skipped (log the withdrawal via OB MCP separately).");
}

// 5) Parent confirmation email (optional — only if RESEND is set).
if (process.env.RESEND_API_KEY && EMAIL_RE.test(parentEmail)) {
  const parentFirst = (parentName || "").split(/\s+/)[0] || "there";
  const text = [
    `Hi ${parentFirst},`, "",
    `${childFirst || "your camper"}'s camp spot is cancelled.`, "",
    `We've taken ${childFirst || "them"} off the ${campTitle} roster and your $${refundUsd.toFixed(2)} is on the way back. Issued to the card on file — Stripe usually has it on your statement in 5–10 business days.`, "",
    `Was: ${campTitle}`, `${campWeek} · ${optionLabel}`, "",
    `When the timing's better, we'd love to have ${childFirst || "them"} on the court. See what's coming up: ${SITE_ORIGIN}/schedule`, "",
    `Thanks for letting us know early — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
  ].join("\n");
  const eres = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL, to: parentEmail, bcc: ADMIN_EMAIL, reply_to: ADMIN_EMAIL,
      subject: `Cancellation confirmed — ${campTitle}`, text,
    }),
  });
  console.error(eres.ok ? `Confirmation email sent to ${parentEmail} (BCC admin).` : `Confirmation email FAILED (${eres.status}).`);
} else {
  console.error("RESEND_API_KEY not set or bad email — confirmation email skipped.");
}

console.error("\nDone.");
console.log(session.id);
