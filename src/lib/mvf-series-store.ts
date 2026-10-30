import { createHash, createHmac } from "node:crypto";
import { PAYMENT_OWNER } from "./payment-ownership";
import { MVF_SERIES_ACCOUNT, MVF_SERIES_KIND, type SeriesRegistration, type SeriesRelease } from "@/data/mvf-series-registration";

export const SERIES_DB_ENV = "NOTION_MVF_SERIES_REGS_DB_ID";
const NOTION = "https://api.notion.com/v1";
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
export class SeriesError extends Error {
  constructor(readonly code: string, readonly status = 503) { super(code); }
}
export function seriesSecret(): string {
  const secret = process.env.NGA_SYNC_SECRET;
  if (!secret) throw new SeriesError("not_configured");
  return secret;
}

export function seriesIdentity(event: string, data: SeriesRegistration, multipleBrackets: boolean) {
  const norm = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const hmac = (purpose: string, value: unknown) => createHmac("sha256", seriesSecret()).update(purpose + "\0" + JSON.stringify(value)).digest("hex");
  return {
    attendee_key: hmac("nga-series-attendee-v1", [event, multipleBrackets ? data.division : "one-entry", norm(data.email), norm(data.childFirstName), norm(data.childLastName), data.childDob]),
    request_key: hmac("nga-series-request-v1", [event, data]),
  };
}

export async function seriesCommand(eventKey: string, action: string, fields: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const secret = seriesSecret();
  const override = process.env.LINKDINK_BASE_URL;
  const origin = override || (process.env.VERCEL_ENV === "production" ? "https://www.linkanddink.com" : "");
  if (!origin || (process.env.VERCEL_ENV === "production" && override && override !== "https://www.linkanddink.com")) throw new SeriesError("not_configured");
  const url = new URL(origin);
  const local = ["127.0.0.1", "localhost"].includes(url.hostname) && process.env.VERCEL_ENV !== "production";
  if (url.username || url.password || (url.port && !local) || (url.protocol !== "https:" && !(url.protocol === "http:" && local))) throw new SeriesError("not_configured");
  try {
    const response = await fetch(new URL("/play/api/internal/nga-series-registration", url), {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json", "x-nga-sync-secret": secret },
      body: JSON.stringify({ event_key: eventKey, action, ...fields }),
    });
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      const conflict = ["full", "duplicate", "request_conflict", "closed", "paid"].includes(String(result.error));
      throw new SeriesError(conflict ? String(result.error) : "ledger_unavailable", conflict ? 409 : 503);
    }
    if (result.ok !== true || result.event_key !== eventKey || (fields.invoice_id && result.invoice_id !== fields.invoice_id)) throw new SeriesError("ledger_unavailable");
    return result;
  } catch (error) { if (error instanceof SeriesError) throw error; throw new SeriesError("ledger_unavailable"); }
}

function notionConfig() {
  const key = process.env.NOTION_API_KEY;
  const db = process.env[SERIES_DB_ENV];
  if (!key || !db || !UUID.test(db) || db.replaceAll("-", "") === process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID?.replaceAll("-", "")) throw new SeriesError("roster_not_configured");
  return { key, db };
}
async function notion(path: string, method = "GET", body?: unknown): Promise<Record<string, unknown>> {
  const { key } = notionConfig();
  try {
    const response = await fetch(`${NOTION}${path}`, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "Notion-Version": "2022-06-28" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new SeriesError("roster_unavailable");
    return await response.json();
  } catch { throw new SeriesError("roster_unavailable"); }
}

export async function checkSeriesRosterSchema(): Promise<void> {
  const { db } = notionConfig();
  const result = await notion(`/databases/${db}`);
  const props = result.properties as Record<string, { type?: string; select?: { options?: { name: string }[] } }> | undefined;
  const types = {
    "Parent Name": "title", "Parent Email": "email", "Parent Phone": "phone_number", "Child First Name": "rich_text", "Child Last Name": "rich_text", "Child DOB": "date",
    "Event Key": "rich_text", "Policy Revision": "rich_text", Division: "select", Resident: "checkbox", Status: "select", Paid: "checkbox",
    "Amount Due": "number", "Amount Paid": "number", "Stripe Invoice ID": "rich_text", "Emergency Name": "rich_text", "Emergency Phone": "phone_number", Allergies: "rich_text", "SMS Consent": "checkbox", "SMS Consent Text": "rich_text",
  };
  if (!props || Object.entries(types).some(([key, type]) => props[key]?.type !== type) ||
    ["12U", "16U"].some(label => !props.Division?.select?.options?.some(o => o.name === label)) ||
    ["Pending", "Confirmed", "Cancelled"].some(label => !props.Status?.select?.options?.some(o => o.name === label))) throw new SeriesError("roster_schema_unverified");
}

export async function strictSeriesWaiver(email: string): Promise<boolean> {
  const key = process.env.NOTION_API_KEY, db = process.env.NOTION_WAIVERS_DB_ID;
  if (!key || !db || !UUID.test(db)) throw new SeriesError("waiver_unavailable");
  try {
    const response = await fetch(`${NOTION}/databases/${db}/query`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "Notion-Version": "2022-06-28" },
      body: JSON.stringify({ filter: { property: "Parent Email", email: { equals: email } }, page_size: 1 }), cache: "no-store" });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (!Array.isArray(result.results)) throw new Error();
    return result.results.some((row: { archived?: boolean; in_trash?: boolean }) => !row.archived && !row.in_trash);
  } catch { throw new SeriesError("waiver_unavailable"); }
}

type Metadata = Record<string, string>;
type NotionProperty = { title?: { plain_text?: string }[]; rich_text?: { plain_text?: string }[]; email?: string; date?: { start?: string }; select?: { name?: string }; checkbox?: boolean };
type RosterPage = { id: string; archived?: boolean; in_trash?: boolean; parent?: { database_id?: string }; properties: Record<string, NotionProperty> };
const rich = (value: string) => ({ rich_text: [{ text: { content: value } }] });
const plain = (p: NotionProperty | undefined) => (p?.rich_text ?? p?.title ?? []).map(x => x.plain_text ?? "").join("");

async function findRow(invoiceId: string, metadata: Metadata): Promise<RosterPage | null> {
  const { db } = notionConfig();
  const result = await notion(`/databases/${db}/query`, "POST", { filter: { property: "Stripe Invoice ID", rich_text: { equals: invoiceId } }, page_size: 2 });
  const rows = result.results as RosterPage[];
  if (!Array.isArray(rows) || result.has_more !== false || rows.length > 1) throw new SeriesError("roster_ambiguous");
  if (!rows.length) return null;
  const row = rows[0], p = row.properties;
  if (!UUID.test(row.id) || row.archived || row.in_trash || row.parent?.database_id?.replaceAll("-", "") !== db.replaceAll("-", "") || !p ||
      plain(p["Stripe Invoice ID"]) !== invoiceId || plain(p["Event Key"]) !== metadata.event_key || plain(p["Policy Revision"]) !== metadata.policy_revision ||
      plain(p["Child First Name"]) !== metadata.child_first_name || plain(p["Child Last Name"]) !== metadata.child_last_name ||
      p["Child DOB"]?.date?.start !== metadata.child_dob || p["Parent Email"]?.email?.toLowerCase() !== metadata.parent_email ||
      p.Division?.select?.name !== metadata.division?.toUpperCase() || p.Resident?.checkbox !== (metadata.resident === "true")) throw new SeriesError("roster_mismatch");
  return row;
}

export async function ensureSeriesRoster(invoiceId: string, m: Metadata): Promise<void> {
  if (await findRow(invoiceId, m)) return;
  const claim = await seriesCommand(m.event_key, "roster_claim", { invoice_id: invoiceId });
  if (claim.claimed !== true) throw new SeriesError("roster_reconciliation_required");
  const { db } = notionConfig();
  await notion("/pages", "POST", { parent: { database_id: db }, properties: {
    "Parent Name": { title: [{ text: { content: m.parent_name } }] }, "Parent Email": { email: m.parent_email }, "Parent Phone": { phone_number: m.parent_phone },
    "Child First Name": rich(m.child_first_name), "Child Last Name": rich(m.child_last_name), "Child DOB": { date: { start: m.child_dob } },
    "Event Key": rich(m.event_key), "Policy Revision": rich(m.policy_revision), Division: { select: { name: m.division.toUpperCase() } }, Resident: { checkbox: m.resident === "true" },
    Status: { select: { name: "Pending" } }, Paid: { checkbox: false }, "Amount Due": { number: Number(m.amount_usd) }, "Amount Paid": { number: 0 },
    "Stripe Invoice ID": rich(invoiceId), "Emergency Name": rich(m.emergency_name), "Emergency Phone": { phone_number: m.emergency_phone }, Allergies: rich(m.allergies),
    "SMS Consent": { checkbox: m.sms_consent === "true" }, "SMS Consent Text": rich(m.sms_consent_text),
  } });
  // A successful create response alone must not authorize an unrelated row.
  if (!(await findRow(invoiceId, m))) throw new SeriesError("roster_reconciliation_required");
}

export async function updateSeriesRoster(invoiceId: string, m: Metadata, state: "paid" | "void"): Promise<void> {
  let row = await findRow(invoiceId, m);
  if (!row && state === "paid") { await ensureSeriesRoster(invoiceId, m); row = await findRow(invoiceId, m); }
  if (!row) throw new SeriesError("roster_reconciliation_required");
  const status = row.properties.Status?.select?.name;
  if (state === "paid" && status === "Cancelled") throw new SeriesError("roster_reconciliation_required");
  if ((state === "paid" && status === "Confirmed" && row.properties.Paid?.checkbox === true) || (state === "void" && status === "Cancelled")) return;
  await notion(`/pages/${row.id}`, "PATCH", { properties: { Status: { select: { name: state === "paid" ? "Confirmed" : "Cancelled" } }, Paid: { checkbox: state === "paid" }, "Amount Due": { number: 0 }, "Amount Paid": { number: state === "paid" ? Number(m.amount_usd) : 0 } } });
}

export async function sendSeriesNotice(eventKey: string, invoiceId: string, phase: "pending" | "paid" | "void", recipient: "parent" | "admin", payload: Record<string, unknown>): Promise<void> {
  const wire = JSON.stringify(payload);
  const claim = await seriesCommand(eventKey, "notify_claim", { invoice_id: invoiceId, phase, recipient, payload_sha256: createHash("sha256").update(wire).digest("hex") });
  if (claim.state === "accepted") return;
  if (claim.state !== "leased" || typeof claim.lease_token !== "string" || !UUID.test(claim.lease_token) || typeof claim.provider_key !== "string" || !/^nga-series-[0-9a-f-]{36}$/.test(claim.provider_key)) throw new SeriesError("notification_pending");
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new SeriesError("notification_pending");
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "idempotency-key": claim.provider_key }, body: wire });
    const result = await response.json();
    if (!response.ok || typeof result.id !== "string") throw new Error();
  } catch { throw new SeriesError("notification_pending"); }
  const done = await seriesCommand(eventKey, "notify_done", { invoice_id: invoiceId, phase, recipient, lease_token: claim.lease_token });
  if (done.recorded !== true) throw new SeriesError("notification_pending");
}

export function baseSeriesMetadata(release: SeriesRelease): Metadata {
  return { kind: MVF_SERIES_KIND, payment_owner: PAYMENT_OWNER, nga_account: MVF_SERIES_ACCOUNT, event_slug: release.event, policy_revision: release.revision, event_date: release.date, event_start: release.startTime, event_end: release.endTime };
}
