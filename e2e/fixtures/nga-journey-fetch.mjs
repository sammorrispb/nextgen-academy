// Explicit test-process preload only, never imported by production application.
// It replaces the Notion transport with synthetic fixtures and refuses every
// non-loopback external request. No real family data or credentials are used.
import { readFileSync, appendFileSync, writeFileSync } from "node:fs";
if (process.env.NGA_SYNTHETIC_JOURNEY_FIXTURES !== "1" || !process.env.NGA_SYNTHETIC_JOURNEY_STATE || !process.env.NGA_SYNTHETIC_JOURNEY_RECEIPTS) throw new Error("Synthetic journey fixture configuration required");
const playerId = "00000000-0000-4000-8000-000000000001";
const registrationId = "00000000-0000-4000-8000-000000000004";
const sessionId = "00000000-0000-4000-8000-000000000002";
const rt = (plain_text) => ({ rich_text: [{ plain_text }] });
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (input, options = {}) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return originalFetch(input, options);
  const method = options.method ?? "GET";
  appendFileSync(process.env.NGA_SYNTHETIC_JOURNEY_RECEIPTS, `${JSON.stringify({ url: url.href, method })}\n`);
  if (url.origin !== "https://api.notion.com") throw new Error("Non-fixture external fetch refused");
  const state = JSON.parse(readFileSync(process.env.NGA_SYNTHETIC_JOURNEY_STATE, "utf8"));
  let result;
  if (url.pathname === `/v1/pages/${playerId}` && method === "GET") {
    result = { id: playerId, parent: { database_id: "synthetic-player-db" }, last_edited_time: state.revision ?? "2026-10-23T12:00:00Z", archived: state.archived ?? false, properties: { Audience: { select: { name: "Youth" } }, Level: { select: { name: "Green" } }, Age: { number: 10 }, "Player Name": { title: [{ plain_text: state.childName ?? "SyntheticChild" }] }, "Parent Email": { email: "synthetic@example.invalid" }, "Parent Phone": { phone_number: "3015550100" } } };
  } else if (url.pathname === `/v1/pages/${registrationId}` && method === "GET") {
    result = { id: registrationId, parent: { database_id: "synthetic-dropin-db" }, last_edited_time: state.registrationRevision ?? "2026-10-23T12:00:00Z", archived: state.registrationArchived ?? false, properties: { "Parent Email": { email: "synthetic@example.invalid" }, "Parent Phone": { phone_number: "3015550100" }, "Child First Name": rt(state.registrationChildName ?? "SyntheticChild"), "Child Birth Year": { number: 2016 }, "Stripe Checkout Session ID": rt("cs_synthetic_registration"), "Session Date": { date: { start: "2026-10-20" } }, Status: { select: { name: state.registrationStatus ?? "Confirmed" } } } };
  } else if (url.pathname === "/v1/databases/synthetic-dropin-db/query" && method === "POST") {
    result = { results: [], has_more: false };
  } else if (url.pathname === "/v1/databases/synthetic-session-db/query" && method === "POST") {
    if (state.delayInventory) await new Promise((resolve) => setTimeout(resolve, 4000));
    if (state.cancelDuringInventory) writeFileSync(process.env.NGA_SYNTHETIC_JOURNEY_STATE, JSON.stringify({ ...state, registrationStatus: "Cancelled" }));
    if (state.inventoryFailure) return Response.json({}, { status: 503 });
    const day = new Date(); day.setUTCDate(day.getUTCDate() + 2);
    result = { results: [{ id: sessionId, parent: { database_id: "synthetic-session-db" }, last_edited_time: "2026-10-23T12:00:00Z", properties: { Session: rt("Synthetic Green session"), Date: { date: { start: day.toISOString().slice(0, 10) } }, "Start time": rt("1:00 PM"), "End time": rt("2:00 PM"), Level: { select: { name: "Green" } }, Location: rt("Synthetic court"), Capacity: { formula: { number: 8 } }, "Registered count": { number: state.full ? 8 : 2 }, Status: { select: { name: "Open" } } } }], has_more: false };
  } else throw new Error(`Unexpected fixture request ${method} ${url.pathname}`);
  return Response.json(result);
};
