import { classifyNotionFailure, type CreateDropInResult } from "./notion-dropins";
import type { FallRegistrationKey } from "./validate-fall-registration";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Fall 2026 Registrations Notion DB — the season roster AND the webhook's
// idempotency key (row keyed on Stripe checkout-session id), mirroring the
// cluster roster pattern. The Confirmed row count per Group is also what the
// checkout's 8-seat capacity guard reads.
// Env: NOTION_FALL_REGS_DB_ID (create the DB before flipping the season live;
// until then every helper fail-softs).

export interface FallRegistrationRow {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number;
  group: string;
  amountPaidUsd: number;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  smsConsent: boolean;
  smsConsentText: string;
  emergencyName: string;
  emergencyPhone: string;
  allergies: string;
}

function notionEnv(): { notionKey: string; dbId: string } | null {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_FALL_REGS_DB_ID;
  if (!notionKey || !dbId) return null;
  return { notionKey, dbId };
}

function headers(notionKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${notionKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

export async function createFallRegistrationResult(
  row: FallRegistrationRow,
): Promise<CreateDropInResult> {
  const env = notionEnv();
  if (!env) {
    console.warn(
      "[notion-fall-registrations] missing NOTION_API_KEY or NOTION_FALL_REGS_DB_ID",
    );
    return "ok";
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: headers(env.notionKey),
    body: JSON.stringify({
      parent: { database_id: env.dbId },
      properties: {
        "Parent Name": { title: [{ text: { content: row.parentName } }] },
        "Parent Email": { email: row.parentEmail || null },
        "Parent Phone": { phone_number: row.parentPhone || null },
        "Child First Name": {
          rich_text: [{ text: { content: row.childFirstName } }],
        },
        "Child Birth Year": { number: row.childBirthYear || null },
        Group: { select: { name: row.group } },
        Status: { select: { name: "Confirmed" } },
        "Amount Paid": { number: row.amountPaidUsd },
        "Stripe Checkout Session ID": {
          rich_text: [{ text: { content: row.stripeCheckoutSessionId } }],
        },
        "Stripe Payment Intent ID": {
          rich_text: [{ text: { content: row.stripePaymentIntentId ?? "" } }],
        },
        "SMS Consent": { checkbox: row.smsConsent },
        "SMS Consent Text": {
          rich_text: [{ text: { content: row.smsConsentText.slice(0, 1900) } }],
        },
        "Emergency Name": {
          rich_text: [{ text: { content: row.emergencyName } }],
        },
        "Emergency Phone": { phone_number: row.emergencyPhone || null },
        Allergies: {
          rich_text: [{ text: { content: row.allergies.slice(0, 1900) } }],
        },
      },
    }),
  });

  if (!res.ok) {
    console.error(
      `[notion-fall-registrations] create failed ${res.status}: ${await res.text()}`,
    );
    return classifyNotionFailure(res.status);
  }
  return "ok";
}

export async function findFallRegByCheckoutId(
  checkoutSessionId: string,
): Promise<boolean> {
  const env = notionEnv();
  if (!env) return false;

  const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
    method: "POST",
    headers: headers(env.notionKey),
    body: JSON.stringify({
      filter: {
        property: "Stripe Checkout Session ID",
        rich_text: { equals: checkoutSessionId },
      },
      page_size: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { results: unknown[] };
  return data.results.length > 0;
}

/** A roster row, resolved far enough to cancel it and email the parent. */
export interface FallRegistrationLookup {
  pageId: string;
  parentName: string;
  parentEmail: string;
  childFirstName: string;
  group: string;
  status: string;
  amountPaidUsd: number;
  stripeCheckoutSessionId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLookup(page: any): FallRegistrationLookup {
  const p = page.properties ?? {};
  return {
    pageId: page.id,
    parentName: p["Parent Name"]?.title?.[0]?.plain_text ?? "",
    parentEmail: p["Parent Email"]?.email ?? "",
    childFirstName: p["Child First Name"]?.rich_text?.[0]?.plain_text ?? "",
    group: p["Group"]?.select?.name ?? "",
    status: p["Status"]?.select?.name ?? "",
    amountPaidUsd: p["Amount Paid"]?.number ?? 0,
    stripeCheckoutSessionId:
      p["Stripe Checkout Session ID"]?.rich_text?.[0]?.plain_text ?? "",
  };
}

async function findFallRegBy(
  property: "Stripe Payment Intent ID" | "Stripe Checkout Session ID",
  value: string,
): Promise<FallRegistrationLookup | null> {
  const env = notionEnv();
  if (!env || !value) return null;

  try {
    const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
      method: "POST",
      headers: headers(env.notionKey),
      body: JSON.stringify({
        filter: { property, rich_text: { equals: value } },
        page_size: 1,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        `[notion-fall-registrations] lookup by ${property} failed ${res.status}`,
      );
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as { results: any[] };
    return data.results[0] ? toLookup(data.results[0]) : null;
  } catch (err) {
    console.error("[notion-fall-registrations] lookup threw", err);
    return null;
  }
}

/**
 * Resolve a roster row from the Payment Intent. The PI is the durable key on a
 * refund — the same lesson cancelDropInByPaymentIntent was rewritten for, where
 * a Checkout-Session re-lookup could come back empty and silently skip the flip.
 */
export async function findFallRegByPaymentIntent(
  paymentIntentId: string,
): Promise<FallRegistrationLookup | null> {
  return findFallRegBy("Stripe Payment Intent ID", paymentIntentId);
}

/** Resolve a roster row from the Checkout Session id (admin path). */
export async function findFallRegByCheckoutSessionId(
  checkoutSessionId: string,
): Promise<FallRegistrationLookup | null> {
  return findFallRegBy("Stripe Checkout Session ID", checkoutSessionId);
}

/**
 * Flip a roster row's Status. Only "Confirmed" rows occupy a seat (the capacity
 * guard filters on it), so moving a row to Refunded/Cancelled frees the seat
 * with no separate decrement — unlike the drop-in roster, which keeps its own
 * Registered count.
 */
export async function updateFallRegStatus(
  pageId: string,
  status: "Confirmed" | "Refunded" | "Cancelled",
): Promise<boolean> {
  const env = notionEnv();
  if (!env) return false;

  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(env.notionKey),
    body: JSON.stringify({ properties: { Status: { select: { name: status } } } }),
  });
  if (!res.ok) {
    console.error(
      `[notion-fall-registrations] status update failed ${res.status}: ${await res.text()}`,
    );
    return false;
  }
  return true;
}

// Capacity + duplicate guard input for /api/checkout-fall. Fail-OPEN (empty
// list) on any Notion problem — same posture as the cluster roster: an
// oversold seat or duplicate registration is a refundable mistake, but a
// Notion blip blocking every checkout is a launch-day outage.
export async function fetchFallRegistrationKeys(
  group: string,
): Promise<FallRegistrationKey[]> {
  const env = notionEnv();
  if (!env) return [];

  try {
    const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
      method: "POST",
      headers: headers(env.notionKey),
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Group", select: { equals: group } },
            { property: "Status", select: { equals: "Confirmed" } },
          ],
        },
        page_size: 100,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[notion-fall-registrations] keys query failed ${res.status}`);
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as { results: any[] };
    return data.results.map((page) => ({
      childFirstName:
        page.properties?.["Child First Name"]?.rich_text?.[0]?.plain_text ?? "",
      parentEmail: page.properties?.["Parent Email"]?.email ?? "",
    }));
  } catch (err) {
    console.error("[notion-fall-registrations] keys query threw", err);
    return [];
  }
}

/**
 * Confirmed-seat count per group for the /fall page's spots-left display.
 * null = unknown (env unset or Notion unavailable) — the page hides the count
 * rather than showing a wrong number.
 */
export async function countFallRegistrations(
  group: string,
): Promise<number | null> {
  const env = notionEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
      method: "POST",
      headers: headers(env.notionKey),
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Group", select: { equals: group } },
            { property: "Status", select: { equals: "Confirmed" } },
          ],
        },
        page_size: 100,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results: unknown[] };
    return data.results.length;
  } catch {
    return null;
  }
}
