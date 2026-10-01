import { createHmac } from "node:crypto";
import { buildMvfRosterSyncBody, LD_TIMEOUT_MS, type MvfRosterSyncBody } from "@/lib/linkdink-roster-sync";
import { EMAIL_RE, NOTION_API, NOTION_VERSION, readPlainText } from "@/lib/notion-utils";
import { secretEquals } from "@/lib/secret-compare";

// Reuse the existing server credentials, never a client-provided credential,
// destination or child identity. Preview/local deployments cannot use this tool.
const LD_ENDPOINT = "https://www.linkanddink.com/play/api/internal/nga-roster-add";
const PREVIEW_TTL_SECONDS = 600;
export class ResendRefusal extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
interface Registration {
  id: string;
  edited: string;
  body: MvfRosterSyncBody;
}
interface RegistrationPage {
  id?: string;
  archived?: boolean;
  in_trash?: boolean;
  last_edited_time?: string;
  parent?: { database_id?: string };
  properties?: Record<string, {
    rich_text?: { plain_text?: string }[];
    email?: string | null;
    select?: { name?: string } | null;
    date?: { start?: string } | null;
  }>;
}
function configured() {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID;
  const syncSecret = process.env.NGA_SYNC_SECRET;
  const signingSecret = process.env.COACH_SIGNING_SECRET;
  if (process.env.VERCEL_ENV !== "production" || !notionKey || !dbId || !syncSecret || !signingSecret) {
    throw new ResendRefusal("not_configured", 503);
  }
  return { notionKey, dbId, syncSecret, signingSecret };
}
function validAge(dob: string, division: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const date = new Date(`${dob}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dob) return false;
  // The live L&D youth bands are 8–10 and 11–14 on October 24, 2026.
  const age = 2026 - date.getUTCFullYear() - (dob.slice(5) > "10-24" ? 1 : 0);
  return division === "10u" ? age >= 8 && age <= 10 : age >= 11 && age <= 14;
}
async function readRegistration(invoiceId: string): Promise<Registration> {
  const { notionKey, dbId } = configured();
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST", headers: { Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json", "Notion-Version": NOTION_VERSION },
    body: JSON.stringify({ filter: { property: "Stripe Invoice ID", rich_text: { equals: invoiceId } }, page_size: 2 }),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(LD_TIMEOUT_MS),
  });
  if (!res.ok) throw new ResendRefusal("registration_lookup_failed", 502);
  const data = await res.json() as { results?: RegistrationPage[]; has_more?: boolean };
  if (!Array.isArray(data.results) || typeof data.has_more !== "boolean") throw new ResendRefusal("registration_lookup_failed", 502);
  if (data.results.length === 0) throw new ResendRefusal("registration_not_found", 404);
  if (data.results.length !== 1 || data.has_more) throw new ResendRefusal("registration_ambiguous", 409);
  const row = data.results[0]; const p = row.properties;
  const division = p?.Division?.select?.name;
  const slug = division === "10U" ? "10u" : division === "14U" ? "14u" : null;
  const status = p?.Status?.select?.name;
  const email = p?.["Parent Email"]?.email;
  const body = slug && typeof email === "string" && EMAIL_RE.test(email)
    ? buildMvfRosterSyncBody({ division: slug, childFirstName: readPlainText(p?.["Child First Name"]),
      childLastName: readPlainText(p?.["Child Last Name"]), parentEmail: email }) : null;
  if (!row.id || !row.last_edited_time || row.archived || row.in_trash ||
    row.parent?.database_id?.replaceAll("-", "") !== dbId.replaceAll("-", "") ||
    readPlainText(p?.["Stripe Invoice ID"]) !== invoiceId ||
    (status !== "Pending" && status !== "Confirmed") || !body?.first_name ||
    !slug || !validAge(p?.["Child DOB"]?.date?.start ?? "", slug)) {
    throw new ResendRefusal("registration_ineligible", 409);
  }
  return { id: row.id, edited: row.last_edited_time, body };
}
function receiptSignature(reg: Registration, invoiceId: string, session: string, expiry: string): string {
  // Domain separated from admin-session signing. Only a digest travels to the
  // browser, bound to one row, exact cleaned identity, source revision and session.
  return createHmac("sha256", configured().signingSecret)
    .update(JSON.stringify(["mvf-roster-replay-v1", invoiceId, reg.id, reg.edited, reg.body, session, expiry]))
    .digest("base64url");
}
async function send(reg: Registration, dryRun: boolean) {
  const res = await fetch(LD_ENDPOINT, {
    method: "POST", headers: { "content-type": "application/json", "x-nga-sync-secret": configured().syncSecret },
    body: JSON.stringify(dryRun ? { ...reg.body, dry_run: true } : reg.body),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(LD_TIMEOUT_MS),
  });
  const result = await res.json().catch(() => null) as {
    ok?: boolean; dryRun?: boolean; action?: string; alreadyOnRoster?: boolean; rsvpId?: string; eventSlug?: string;
  } | null;
  if (!res.ok || result?.ok !== true || typeof result.eventSlug !== "string" ||
    !new RegExp(`^${reg.body.event_key}(?:-[0-9]+)?$`).test(result.eventSlug)) {
    throw new ResendRefusal("sync_failed", 502);
  }
  if (dryRun) {
    if (result.dryRun !== true || (result.action !== "would_add" && result.action !== "already_on_roster")) {
      throw new ResendRefusal("sync_failed", 502);
    }
    return result.action;
  }
  if (typeof result.alreadyOnRoster !== "boolean" || typeof result.rsvpId !== "string" || !result.rsvpId) {
    throw new ResendRefusal("sync_failed", 502);
  }
  return result.alreadyOnRoster ? "already_on_roster" : "added";
}
export async function resendMvfRoster(input: { invoiceId: string; action: "preview" | "replay"; previewToken?: string }, session: string) {
  const reg = await readRegistration(input.invoiceId);
  if (input.action === "replay") {
    const [expiry, signature, extra] = (input.previewToken ?? "").split(".");
    const now = Math.floor(Date.now() / 1000);
    if (extra !== undefined || !/^\d{10}$/.test(expiry ?? "") || Number(expiry) <= now ||
      Number(expiry) > now + PREVIEW_TTL_SECONDS ||
      !secretEquals(signature, receiptSignature(reg, input.invoiceId, session, expiry))) {
      throw new ResendRefusal("preview_expired_or_changed", 409);
    }
    return { ok: true, outcome: await send(reg, false), eventKey: reg.body.event_key };
  }
  const outcome = await send(reg, true);
  // An existing RSVP needs no replay, so issue no write capability for it.
  const expiry = String(Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS);
  return { ok: true, outcome, eventKey: reg.body.event_key,
    ...(outcome === "would_add" ? { previewToken: `${expiry}.${receiptSignature(reg, input.invoiceId, session, expiry)}` } : {}) };
}
