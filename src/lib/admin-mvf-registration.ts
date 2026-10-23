import { createHmac } from "node:crypto";
import {
  findMvfTournamentDivision, isCalendarDob, isDobEligibleForDivision,
  MVF_JUNIOR_TOURNAMENT_DATE_ISO, MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_KIND, MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_TITLE, MVF_JUNIOR_TOURNAMENT_VENUE,
  NGA_REVENUE_SHARE, NO_REFUNDS_TEXT, RAIN_OR_SHINE_TEXT,
  resolveTournamentPriceUsd, splitTournamentRevenueUsd,
} from "@/data/mvf-junior-tournament-2026";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import { WAIVER_VERSION } from "@/data/waiver";
import { validateMvfJuniorTournament, type MvfJuniorTournamentData } from "./validate-mvf-junior-tournament";
import { normalizeEmailTypos } from "./email-typo";
import { buildWaiverSignUrl } from "./waiver-gate";
import { buildMvfRosterSyncBody, syncMvfRegistrationToLinkDink } from "./linkdink-roster-sync";
import { bindMvfSeat, reserveMvfSeat, mvfAttendeeKey, mvfRequestKey, MvfCapacityError } from "./mvf-capacity";
import { getStripe } from "./stripe";
import { createAndSendSignupInvoice } from "./stripe-invoices";
import { createMvfTournamentRegistration } from "./notion-mvf-tournament-registrations";
import { invoiceSafeName } from "./invoice-text";
import { NOTION_API, NOTION_VERSION, readPlainText } from "./notion-utils";
import { parseSubmissionId } from "./submission-key";
import { secretEquals } from "./secret-compare";
import { notifyInvoiceSent } from "./signup-admin-notify";

const STRIPE_ACCOUNT = "acct_1TU4iSBpXOfTC961";
const PREVIEW_TTL_SECONDS = 600;
const FIELDS = ["division", "resident", "parentName", "email", "phone", "childFirstName", "childLastName",
  "childDob", "emergencyName", "emergencyPhone", "allergies", "smsConsent"] as const;

export class AdminMvfRegistrationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly errors?: Record<string, string>,
    public readonly waiverUrl?: string,
  ) { super(code); }
}

export interface AdminMvfRegistrationInput {
  action: "preview" | "register";
  submissionId: string;
  registration: MvfJuniorTournamentData;
  ageExceptionApproved: boolean;
  ageExceptionReason: string;
  previewToken?: string;
}

interface Page {
  id?: string;
  archived?: boolean;
  in_trash?: boolean;
  properties?: Record<string, {
    title?: { plain_text?: string }[];
    rich_text?: { plain_text?: string }[];
    email?: string | null;
    date?: { start?: string } | null;
    select?: { name?: string } | null;
    checkbox?: boolean;
  }>;
}
interface Waiver { id: string; signedAt: string; version: string; signature: string }
interface Validated { input: AdminMvfRegistrationInput; age: number; ageException: boolean }

function configured() {
  const keys = ["STRIPE_SECRET_KEY", "NOTION_API_KEY", "NOTION_WAIVERS_DB_ID", "NOTION_MVF_TOURNAMENT_REGS_DB_ID",
    "NGA_SYNC_SECRET", "COACH_SIGNING_SECRET"] as const;
  if (process.env.VERCEL_ENV !== "production" || keys.some(key => !process.env[key]?.trim()) ||
    !/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY?.trim() ?? "") ||
    (process.env.LINKDINK_BASE_URL && process.env.LINKDINK_BASE_URL !== "https://www.linkanddink.com")) {
    throw new AdminMvfRegistrationError("not_configured", 503);
  }
  // Check presence and live mode here; leave credential bytes untouched so
  // native clients authenticate them and the exact-account check still gates writes.
}

function validate(raw: unknown): Validated {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AdminMvfRegistrationError("bad_input", 400);
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some(key => !["action", "submissionId", "registration", "ageExceptionApproved", "ageExceptionReason", "previewToken"].includes(key)) ||
    (body.action !== "preview" && body.action !== "register") || !parseSubmissionId(body.submissionId) ||
    typeof body.ageExceptionApproved !== "boolean" || typeof body.ageExceptionReason !== "string" ||
    body.ageExceptionReason.length > 240 || !body.registration || typeof body.registration !== "object" || Array.isArray(body.registration) ||
    (body.action === "preview" && body.previewToken !== undefined) ||
    (body.action === "register" && (typeof body.previewToken !== "string" || body.previewToken.length > 100))) {
    throw new AdminMvfRegistrationError("bad_input", 400);
  }
  const supplied = body.registration as Record<string, unknown>;
  if (Object.keys(supplied).some(key => !(FIELDS as readonly string[]).includes(key))) throw new AdminMvfRegistrationError("bad_input", 400);
  const data = Object.fromEntries(FIELDS.map(key => [key, typeof supplied[key] === "string" ? supplied[key].trim() : supplied[key]])) as unknown as MvfJuniorTournamentData;
  const errors: Record<string, string> = { ...validateMvfJuniorTournament(data) };
  if (typeof data.email === "string") data.email = normalizeEmailTypos(data.email).toLowerCase();
  data.allergies ??= "";
  data.smsConsent ??= false;
  if (data.division !== "14u") errors.division = "Use the active 14U tournament. The separate 10U event is canceled.";
  const dobValid = typeof data.childDob === "string" && isCalendarDob(data.childDob);
  const age = dobValid ? Number(MVF_JUNIOR_TOURNAMENT_DATE_ISO.slice(0, 4)) - Number(data.childDob.slice(0, 4)) -
    (data.childDob.slice(5) > MVF_JUNIOR_TOURNAMENT_DATE_ISO.slice(5) ? 1 : 0) : -1;
  const ageException = data.division === "14u" && dobValid && age >= 15 && age <= 16;
  const reason = body.ageExceptionReason.trim();
  if (ageException && body.ageExceptionApproved && reason.length >= 3) delete errors.childDob;
  else if (ageException) errors.childDob = "An organizer must explicitly approve the age exception and give a reason.";
  if (!ageException && data.division === "14u" && dobValid && !isDobEligibleForDivision("14u", data.childDob)) {
    errors.childDob = "14U allows ages 11–14, with an approved exception for ages 15–16.";
  }
  for (const key of FIELDS) {
    const value = data[key];
    const limit = key === "allergies" ? 480 : key === "email" ? 254 : 120;
    if (typeof value === "string" && value.length > limit) errors[key] = "This value is too long.";
  }
  if (typeof data.childFirstName === "string" && typeof data.childLastName === "string") {
    const sync = buildMvfRosterSyncBody({ division: "14u", childFirstName: data.childFirstName, childLastName: data.childLastName, parentEmail: data.email });
    if (!sync?.first_name || !sync.last_name) errors.childFirstName = "Use the player's name spelled with Latin letters for the tournament roster.";
  }
  if (Object.keys(errors).length) throw new AdminMvfRegistrationError("registration_ineligible", 400, errors);
  return { input: { action: body.action, submissionId: body.submissionId as string, registration: data,
    ageExceptionApproved: body.ageExceptionApproved, ageExceptionReason: reason, previewToken: body.previewToken as string | undefined }, age, ageException };
}

async function notionQuery(db: string, filter: unknown): Promise<Page[]> {
  let response: Response;
  try {
    response = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST", headers: { Authorization: `Bearer ${process.env.NOTION_API_KEY}`, "Content-Type": "application/json", "Notion-Version": NOTION_VERSION },
      body: JSON.stringify({ filter, page_size: 2 }), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
    });
  } catch { throw new AdminMvfRegistrationError("request_failed", 502); }
  if (!response.ok) throw new AdminMvfRegistrationError("request_failed", 502);
  const result = await response.json().catch(() => null) as { results?: Page[]; has_more?: boolean } | null;
  if (!Array.isArray(result?.results) || result.has_more !== false) throw new AdminMvfRegistrationError("request_failed", 502);
  return result.results;
}

async function signedWaiver(data: MvfJuniorTournamentData): Promise<Waiver> {
  let pages: Page[];
  try { pages = await notionQuery(process.env.NOTION_WAIVERS_DB_ID!, { property: "Parent Email", email: { equals: data.email } }); }
  catch { throw new AdminMvfRegistrationError("waiver_unavailable", 502); }
  const valid = pages.filter(page => {
    const props = page.properties;
    const signature = readPlainText(props?.["Signature Name"]) || readPlainText(props?.Signature);
    const signed = props?.["Signed At"]?.date?.start;
    return page.id && !page.archived && !page.in_trash && props?.["Parent Email"]?.email?.trim().toLowerCase() === data.email &&
      signature.trim() && readPlainText(props?.["Waiver Version"]).trim() === WAIVER_VERSION && signed &&
      Number.isFinite(Date.parse(signed)) && Date.parse(signed) <= Date.now();
  });
  if (valid.length !== 1) throw new AdminMvfRegistrationError("waiver_required", 409, undefined,
    buildWaiverSignUrl({ email: data.email, parentName: data.parentName, next: "/admin/mvf-registration" }));
  const page = valid[0];
  return { id: page.id!, signedAt: page.properties!["Signed At"].date!.start!,
    version: readPlainText(page.properties!["Waiver Version"]),
    signature: readPlainText(page.properties!["Signature Name"]) || readPlainText(page.properties!.Signature) };
}

function previewSignature(validated: Validated, waiver: Waiver, session: string, actor: string, expiry: string) {
  const { input } = validated;
  return createHmac("sha256", process.env.COACH_SIGNING_SECRET!)
    .update(JSON.stringify(["mvf-admin-registration-v1", input.submissionId, input.registration, input.ageExceptionApproved,
      input.ageExceptionReason, waiver, session, actor, expiry])).digest("base64url");
}

async function verifyAccount() {
  let account;
  try { account = await getStripe().accounts.retrieve(null); }
  catch { throw new AdminMvfRegistrationError("stripe_unavailable", 502); }
  if (account.id !== STRIPE_ACCOUNT) throw new AdminMvfRegistrationError("wrong_stripe_account", 409);
}

async function registrationPages(data: MvfJuniorTournamentData) {
  return notionQuery(process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID!, { and: [
    { property: "Parent Email", email: { equals: data.email } },
    { property: "Child First Name", rich_text: { equals: data.childFirstName } },
    { property: "Child Last Name", rich_text: { equals: data.childLastName } },
    { property: "Child DOB", date: { equals: data.childDob } },
  ] });
}

function matchingRegistration(page: Page, data: MvfJuniorTournamentData, invoiceId: string) {
  const p = page.properties;
  return !!page.id && !page.archived && !page.in_trash && readPlainText(p?.["Stripe Invoice ID"]) === invoiceId &&
    p?.["Parent Email"]?.email?.trim().toLowerCase() === data.email &&
    readPlainText(p?.["Child First Name"]) === data.childFirstName && readPlainText(p?.["Child Last Name"]) === data.childLastName &&
    p?.["Child DOB"]?.date?.start === data.childDob && p?.Division?.select?.name === "14U" &&
    ["Pending", "Confirmed"].includes(p?.Status?.select?.name ?? "");
}

/** The admin exception changes admission, never the public validator or native payment/roster engines. */
export async function adminMvfRegistration(raw: unknown, session: string, actorEmail: string) {
  configured();
  const validated = validate(raw);
  const { input, age, ageException } = validated;
  const data = input.registration;
  const waiver = await signedWaiver(data);
  if (input.action === "register") {
    const [expiry, signature, extra] = input.previewToken!.split(".");
    const now = Math.floor(Date.now() / 1000);
    if (extra !== undefined || !/^\d{10}$/.test(expiry ?? "") || Number(expiry) <= now || Number(expiry) > now + PREVIEW_TTL_SECONDS ||
      !secretEquals(signature, previewSignature(validated, waiver, session, actorEmail, expiry))) {
      throw new AdminMvfRegistrationError("preview_expired_or_changed", 409);
    }
  }
  await verifyAccount();
  const price = resolveTournamentPriceUsd(data.resident);
  if (input.action === "preview") {
    const expiry = String(Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS);
    return { ok: true as const, previewToken: `${expiry}.${previewSignature(validated, waiver, session, actorEmail, expiry)}`,
      summary: { amountUsd: price, divisionLabel: "14U", childName: `${data.childFirstName} ${data.childLastName}`,
        childDob: data.childDob, age, ageException, parentEmail: data.email } };
  }

  // A pre-ledger/manual registration must never gain another invoice through this new entry point.
  const prior = (await registrationPages(data)).filter(page => !page.archived && !page.in_trash);
  if (prior.length > 1) throw new AdminMvfRegistrationError("registration_exists", 409);
  if (prior.length) {
    if (!["Pending", "Confirmed"].includes(prior[0].properties?.Status?.select?.name ?? "")) {
      throw new AdminMvfRegistrationError("registration_exists", 409);
    }
    const invoiceId = readPlainText(prior[0].properties?.["Stripe Invoice ID"]);
    const existing = await getStripe().invoices.retrieve(invoiceId).catch(() => null);
    if (!existing || existing.metadata?.nga_capacity_submission_id !== input.submissionId) throw new AdminMvfRegistrationError("registration_exists", 409);
  }
  let existingInvoiceId: string | null;
  try {
    ({ invoiceId: existingInvoiceId } = await reserveMvfSeat("14u", input.submissionId, mvfAttendeeKey(data), mvfRequestKey(data)));
  } catch (error) {
    const codes = { full: "sold_out", duplicate: "registration_exists", conflict: "registration_changed", unavailable: "capacity_unavailable" };
    throw new AdminMvfRegistrationError(error instanceof MvfCapacityError ? codes[error.code] : "capacity_unavailable", 409);
  }
  const shares = splitTournamentRevenueUsd(price);
  const division = findMvfTournamentDivision("14u")!;
  const metadata = {
    kind: MVF_JUNIOR_TOURNAMENT_KIND, event_label: MVF_JUNIOR_TOURNAMENT_TITLE,
    event_date: MVF_JUNIOR_TOURNAMENT_DATE_ISO, event_time: MVF_JUNIOR_TOURNAMENT_TIME_LABEL, venue: MVF_JUNIOR_TOURNAMENT_VENUE,
    division: "14u", division_label: division.label, nga_capacity_submission_id: input.submissionId,
    resident: String(data.resident), amount_usd: price.toFixed(2), nga_revenue_share: String(NGA_REVENUE_SHARE),
    nga_share_usd: shares.ngaShareUsd, mvf_share_usd: shares.mvfShareUsd,
    parent_name: data.parentName, parent_email: data.email, parent_phone: data.phone,
    child_first_name: data.childFirstName, child_last_name: data.childLastName, child_dob: data.childDob,
    emergency_name: data.emergencyName, emergency_phone: data.emergencyPhone, allergies: data.allergies,
    waiver_accepted: "true", sms_consent: String(data.smsConsent), sms_consent_text: data.smsConsent ? SMS_CONSENT_TEXT : "",
    registration_source: "nga-admin", age_exception_approved: String(ageException),
    age_exception_approved_by: ageException ? actorEmail : "", age_exception_reason: ageException ? input.ageExceptionReason : "",
  };
  let result;
  try {
    if (existingInvoiceId) {
      const existing = await getStripe().invoices.retrieve(existingInvoiceId);
      if (existing.total !== price * 100 || existing.currency !== "usd") throw new Error("invoice_amount_mismatch");
      if (Object.entries(metadata).some(([key, value]) => existing.metadata?.[key] !== value)) throw new Error("invoice_mismatch");
    }
    result = await createAndSendSignupInvoice({
      existingInvoiceId: existingInvoiceId ?? undefined, customerEmail: data.email, customerName: invoiceSafeName(data.parentName, ""),
      items: [{ description: `${MVF_JUNIOR_TOURNAMENT_TITLE} — 14U — ${invoiceSafeName(`${data.childFirstName} ${data.childLastName}`)} (${data.resident ? "Resident" : "Non-resident"})`, amountCents: price * 100, quantity: 1 }],
      metadata, memo: `${MVF_JUNIOR_TOURNAMENT_TITLE} — 14U — ${invoiceSafeName(`${data.childFirstName} ${data.childLastName}`)}`,
      footer: `${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT} Bring a refillable water bottle and court shoes — we have loaner paddles.`,
      daysUntilDue: 7, idempotencyKey: `mvf-junior-tournament-${input.submissionId}`,
      beforeFinalize: async invoiceId => {
        const payable = await getStripe().invoices.retrieve(invoiceId);
        if (payable.total !== price * 100 || payable.currency !== "usd") throw new Error("invoice_amount_mismatch");
        await bindMvfSeat("14u", input.submissionId, invoiceId);
      },
    });
  } catch { throw new AdminMvfRegistrationError("invoice_unavailable", 502); }
  const { invoice, alreadySent } = result;
  let registrationSaved = false;
  try {
    await createMvfTournamentRegistration({ parentName: data.parentName, parentEmail: data.email, parentPhone: data.phone,
      childFirstName: data.childFirstName, childLastName: data.childLastName, childDob: data.childDob, division: "14u",
      resident: data.resident, amountUsd: price, stripeInvoiceId: invoice.id, smsConsent: data.smsConsent,
      smsConsentText: data.smsConsent ? SMS_CONSENT_TEXT : "", emergencyName: data.emergencyName, emergencyPhone: data.emergencyPhone, allergies: data.allergies });
    const rows = await registrationPages(data);
    registrationSaved = rows.length === 1 && matchingRegistration(rows[0], data, invoice.id);
  } catch { /* The invoice already exists: return its receipt and retain the operation for reconciliation. */ }
  const rosterSynced = registrationSaved && await syncMvfRegistrationToLinkDink({ division: "14u", childFirstName: data.childFirstName,
    childLastName: data.childLastName, parentEmail: data.email });
  if (!alreadySent) {
    try {
      await notifyInvoiceSent({ kind: "mvf-junior-tournament", headline: "MVF Junior Tournament invoice sent",
        parentName: data.parentName, parentEmail: data.email, parentPhone: data.phone,
        childFirstName: `${data.childFirstName} ${data.childLastName}`, amountUsd: price.toFixed(2), invoiceId: invoice.id,
        hostedUrl: invoice.hosted_invoice_url ?? null, dueDate: "7 days",
        details: [`Division: 14U`, `Event: ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL} — ${MVF_JUNIOR_TOURNAMENT_VENUE}`,
          `Entry: $${price.toFixed(2)} (${data.resident ? "MV resident" : "non-resident"}) — NGA $${shares.ngaShareUsd} / MVF $${shares.mvfShareUsd}`] });
    } catch { /* A failed admin notice cannot turn an emailed parent invoice into a retryable failure. */ }
  }
  return { ok: true as const, completed: registrationSaved && rosterSynced, invoiceId: invoice.id,
    invoiceUrl: invoice.hosted_invoice_url ?? null, invoiceStatus: invoice.status ?? "unknown",
    registrationSaved, rosterSynced, alreadySent };
}
