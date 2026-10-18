import { createHmac } from "node:crypto";
import { mvfTournamentLdEventKey } from "./linkdink-roster-sync";

export class MvfCapacityError extends Error {
  constructor(readonly code: "full" | "unavailable" | "conflict" | "duplicate") {
    super("Tournament capacity " + code);
  }
}

type Command = { action: "reserve" | "bind" | "paid" | "notified" | "roster_claim"; division: string; submissionId?: string; invoiceId?: string; recipient?: "admin" | "parent"; attendeeKey?: string; requestKey?: string };
const INVOICE = /^in_[A-Za-z0-9]{1,250}$/;

async function command(input: Command): Promise<Record<string, unknown>> {
  const key = mvfTournamentLdEventKey(input.division);
  const secret = process.env.NGA_SYNC_SECRET;
  const override = process.env.LINKDINK_BASE_URL;
  if (!key || !secret || (!override && process.env.VERCEL_ENV !== "production")) throw new MvfCapacityError("unavailable");
  const url = new URL(override || "https://www.linkanddink.com");
  if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) throw new MvfCapacityError("unavailable");
  try {
    const response = await fetch(new URL("/play/api/internal/nga-tournament-capacity", url), {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json", "x-nga-sync-secret": secret },
      body: JSON.stringify({ action: input.action, event_key: key,
        ...(input.submissionId ? { submission_id: input.submissionId } : {}),
        ...(input.invoiceId ? { invoice_id: input.invoiceId } : {}),
        ...(input.recipient ? { recipient: input.recipient } : {}),
        ...(input.attendeeKey ? { attendee_key: input.attendeeKey } : {}),
        ...(input.requestKey ? { request_key: input.requestKey } : {}),
      }),
    });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok || body.ok !== true) throw new MvfCapacityError(body.error === "registration_exists" ? "duplicate" : body.error === "capacity_full" ? "full" : body.error === "reservation_conflict" ? "conflict" : "unavailable");
    return body;
  } catch (error) {
    if (error instanceof MvfCapacityError) throw error;
    throw new MvfCapacityError("unavailable");
  }
}

export async function reserveMvfSeat(division: string, submissionId: string, attendeeKey: string, requestKey: string): Promise<{ invoiceId: string | null }> {
  const result = await command({ action: "reserve", division, submissionId, attendeeKey, requestKey });
  if (!["held", "payable", "paid"].includes(String(result.state)) || (result.invoice_id !== null && (typeof result.invoice_id !== "string" || !INVOICE.test(result.invoice_id)))) throw new MvfCapacityError("unavailable");
  return { invoiceId: result.invoice_id as string | null };
}
export async function bindMvfSeat(division: string, submissionId: string, invoiceId: string): Promise<void> {
  const result = await command({ action: "bind", division, submissionId, invoiceId });
  if (result.invoice_id !== invoiceId) throw new MvfCapacityError("unavailable");
}
export async function markMvfSeatPaid(division: string, invoiceId: string): Promise<{ adminNotified: boolean; parentNotified: boolean; retryAllowed: boolean; legacyCallbackDeferred: boolean }> {
  const result = await command({ action: "paid", division, invoiceId });
  if (typeof result.already_paid !== "boolean" || typeof result.admin_notified !== "boolean" || typeof result.parent_notified !== "boolean" || typeof result.notification_retry_allowed !== "boolean" || typeof result.legacy_callback_deferred !== "boolean" || (result.legacy_callback_deferred && result.notification_retry_allowed)) throw new MvfCapacityError("unavailable");
  return { adminNotified: result.admin_notified, parentNotified: result.parent_notified, retryAllowed: result.notification_retry_allowed, legacyCallbackDeferred: result.legacy_callback_deferred };
}

export async function markMvfNotification(division: string, invoiceId: string, recipient: "admin" | "parent"): Promise<void> {
  const result = await command({ action: "notified", division, invoiceId, recipient });
  if (result.recorded !== true) throw new MvfCapacityError("unavailable");
}

/** At most one Notion create attempt across checkout, callbacks and servers.
 * No lease: an uncertain provider write must be reconciled, never recreated. */
export async function claimMvfRosterCreation(division: string, invoiceId: string): Promise<boolean> {
  const result = await command({ action: "roster_claim", division, invoiceId });
  if (typeof result.claimed !== "boolean") throw new MvfCapacityError("unavailable");
  return result.claimed;
}

/** Secret-keyed identity protects cross-tab/reload retries without exporting PII. */
export function mvfAttendeeKey(input: { division: string; email: string; childFirstName: string; childLastName: string; childDob: string }): string {
  const secret = process.env.NGA_SYNC_SECRET;
  const event = mvfTournamentLdEventKey(input.division);
  if (!secret || !event) throw new MvfCapacityError("unavailable");
  const normalize = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  return createHmac("sha256", secret).update("nga-mvf-attendee-v1\0" + JSON.stringify([event, normalize(input.email), normalize(input.childFirstName), normalize(input.childLastName), input.childDob.trim()])).digest("hex");
}

/** Bind every validated invoice/roster input immutably to its random attempt. */
export function mvfRequestKey(input: import("./validate-mvf-junior-tournament").MvfJuniorTournamentData): string {
  const secret=process.env.NGA_SYNC_SECRET;
  if(!secret) throw new MvfCapacityError("unavailable");
  return createHmac("sha256",secret).update("nga-mvf-request-v1\0"+JSON.stringify([input.division,input.resident,input.parentName,input.email,input.phone,input.childFirstName,input.childLastName,input.childDob,input.emergencyName,input.emergencyPhone,input.allergies ?? "",input.smsConsent === true])).digest("hex");
}
