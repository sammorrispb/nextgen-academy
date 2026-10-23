import { createHash } from "node:crypto";
import { isCalendarDob, MVF_JUNIOR_TOURNAMENT_DATE_ISO } from "@/data/mvf-junior-tournament-2026";
import { mvfAttendeeKey, mvfRequestKey } from "./mvf-capacity";
import { mvfTournamentLdEventKey } from "./linkdink-roster-sync";
import { EMAIL_RE, NOTION_API, NOTION_VERSION, readPlainText } from "./notion-utils";
import type { MvfJuniorTournamentData } from "./validate-mvf-junior-tournament";

const INVOICE = /^in_[A-Za-z0-9]{1,250}$/;
const PAGE_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
const MAX_INVOICES = 24;
type Division = "10u" | "14u";
type ReviewedInvoice = { invoiceId: string; originalDivision: Division };
type ObjectValue = Record<string, unknown>;

export class AdminMvfCapacityExportError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}

function object(value: unknown): value is ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function invalidSource(): never { throw new AdminMvfCapacityExportError("source_identity_invalid", 409); }
function validatedInput(raw: unknown): ReviewedInvoice[] {
  if (!object(raw) || Object.keys(raw).some(key => key !== "invoices") || !Array.isArray(raw.invoices) ||
    raw.invoices.length < 1 || raw.invoices.length > MAX_INVOICES) {
    throw new AdminMvfCapacityExportError("bad_input", 400);
  }
  const invoices: ReviewedInvoice[] = [];
  const ids = new Set<string>();
  for (const item of raw.invoices) {
    if (!object(item) || Object.keys(item).some(key => !["invoiceId", "originalDivision"].includes(key)) ||
      typeof item.invoiceId !== "string" || !INVOICE.test(item.invoiceId) || ids.has(item.invoiceId) ||
      (item.originalDivision !== "10u" && item.originalDivision !== "14u")) {
      throw new AdminMvfCapacityExportError("bad_input", 400);
    }
    ids.add(item.invoiceId);
    invoices.push({ invoiceId: item.invoiceId, originalDivision: item.originalDivision });
  }
  return invoices;
}

function property(props: ObjectValue, name: string): ObjectValue {
  const prop = props[name];
  if (!object(prop)) return invalidSource();
  return prop;
}
function text(props: ObjectValue, name: string, kind: "title" | "rich_text" = "rich_text", optional = false): string {
  const prop = property(props, name);
  const parts = prop[kind];
  if (!Array.isArray(parts) || parts.some(part => !object(part) || typeof part.plain_text !== "string")) return invalidSource();
  const value = readPlainText({ [kind]: parts });
  if ((!optional && !value.trim()) || value.length > (name === "Allergies" ? 1900 : 253) || /\0/.test(value)) return invalidSource();
  return value;
}
function scalarText(props: ObjectValue, name: string, kind: "email" | "phone_number"): string {
  const value = property(props, name)[kind];
  if (typeof value !== "string" || value.length > 254 || !value.trim() || /\0/.test(value)) return invalidSource();
  if (kind === "email" ? !EMAIL_RE.test(value) : value.replace(/\D/g, "").length < 10) return invalidSource();
  return value;
}
function checkbox(props: ObjectValue, name: string): boolean {
  const value = property(props, name).checkbox;
  if (typeof value !== "boolean") return invalidSource();
  return value;
}

function sourceIdentity(page: ObjectValue, division: Division): MvfJuniorTournamentData {
  if (!object(page.properties)) return invalidSource();
  const props = page.properties;
  const status = property(props, "Status").select;
  if (!object(status) || !["Pending", "Confirmed", "Refunded", "Cancelled"].includes(String(status.name))) return invalidSource();
  const date = property(props, "Child DOB").date;
  if (!object(date) || typeof date.start !== "string" || !isCalendarDob(date.start) || date.start >= MVF_JUNIOR_TOURNAMENT_DATE_ISO) return invalidSource();
  // Preserve the exact stored native values for the request digest. In
  // particular, never re-case email, format phones, trim names or invent consent.
  // The attendee helper applies the same normalization as the registration flow.
  return { division, resident: checkbox(props, "Resident"),
    parentName: text(props, "Parent Name", "title"), email: scalarText(props, "Parent Email", "email"),
    phone: scalarText(props, "Parent Phone", "phone_number"), childFirstName: text(props, "Child First Name"),
    childLastName: text(props, "Child Last Name"), childDob: date.start,
    emergencyName: text(props, "Emergency Name"), emergencyPhone: scalarText(props, "Emergency Phone", "phone_number"),
    allergies: text(props, "Allergies", "rich_text", true), smsConsent: checkbox(props, "SMS Consent") };
}

/** Read-only opaque reconciliation evidence; never proof of provider payment.
 * A reviewed original division is mandatory because roster division is mutable.
 * Compare source fields privately with original invoice metadata before release.
 */
export async function adminMvfCapacityExport(raw: unknown) {
  const invoices = validatedInput(raw);
  const database = process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID;
  if (process.env.VERCEL_ENV !== "production" || !process.env.NOTION_API_KEY?.trim() ||
    !process.env.NGA_SYNC_SECRET?.trim() || !database || !PAGE_ID.test(database)) {
    throw new AdminMvfCapacityExportError("not_configured", 503);
  }
  let response: Response;
  try {
    response = await fetch(`${NOTION_API}/databases/${database}/query`, {
      method: "POST", headers: { Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        "Content-Type": "application/json", "Notion-Version": NOTION_VERSION },
      body: JSON.stringify({ filter: { or: invoices.map(invoice => ({
        property: "Stripe Invoice ID", rich_text: { equals: invoice.invoiceId },
      })) }, page_size: 100 }),
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
    });
  } catch { throw new AdminMvfCapacityExportError("source_unavailable", 502); }
  if (!response.ok) throw new AdminMvfCapacityExportError("source_unavailable", 502);
  const result: unknown = await response.json().catch(() => null);
  if (!object(result) || !Array.isArray(result.results) || result.results.length > 100 || result.has_more !== false) {
    throw new AdminMvfCapacityExportError("source_unavailable", 502);
  }
  const byInvoice = new Map<string, ObjectValue>();
  const requested = new Set(invoices.map(invoice => invoice.invoiceId));
  for (const page of result.results) {
    if (!object(page) || !object(page.parent) || typeof page.parent.database_id !== "string" ||
      page.parent.database_id.replace(/-/g, "").toLowerCase() !== database.replace(/-/g, "").toLowerCase() ||
      typeof page.id !== "string" || !PAGE_ID.test(page.id) || page.archived !== false || page.in_trash !== false ||
      typeof page.last_edited_time !== "string" || !Number.isFinite(Date.parse(page.last_edited_time)) || !object(page.properties)) {
      return invalidSource();
    }
    const invoiceId = text(page.properties, "Stripe Invoice ID");
    if (!requested.has(invoiceId) || byInvoice.has(invoiceId)) return invalidSource();
    byInvoice.set(invoiceId, page);
  }
  if (byInvoice.size !== invoices.length) throw new AdminMvfCapacityExportError("source_registration_missing", 409);
  const exported = invoices.map(invoice => {
    const data = sourceIdentity(byInvoice.get(invoice.invoiceId)!, invoice.originalDivision);
    return { invoiceId: invoice.invoiceId, eventKey: mvfTournamentLdEventKey(invoice.originalDivision)!,
      attendeeKey: mvfAttendeeKey(data), requestKey: mvfRequestKey(data),
      // The surviving 14U event is one occupancy pool after the division merge.
      // This prevents an original 10U child taking a second seat through 14U.
      poolAttendeeKey: mvfAttendeeKey({ ...data, division: "14u" }) };
  });
  const sourceRevision = createHash("sha256").update(JSON.stringify(exported.map(row => {
    const page = byInvoice.get(row.invoiceId)!;
    return [page.id, page.last_edited_time, row];
  }))).digest("hex");
  return { ok: true as const, sourceRevision, count: exported.length, invoices: exported };
}
