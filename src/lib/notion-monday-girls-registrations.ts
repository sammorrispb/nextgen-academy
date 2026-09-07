import { classifyNotionFailure, type CreateDropInResult } from "./notion-dropins";
import type { MondayGirlsRegistrationKey } from "./validate-monday-girls-registration";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// NGA Monday Girls Beginner Group Registrations Notion DB — the block's roster
// AND the webhook's idempotency key (row keyed on Stripe checkout-session id).
//
// Deliberately its OWN database + module rather than a season column on the
// Fall or Pickl Park Regs DB: those modules scope capacity by `Group` alone, so
// sharing a DB would count Monday girls against Sunday Green/Yellow seats and
// vice versa — the exact cross-count CLAUDE.md warns about for Pickl Park.
//
// Same property schema as the Fall / Pickl Park Regs DBs — create it as a
// duplicate of either, then share it with the "Player DB" Notion integration
// (a new DB is invisible to the site until that share happens, and nothing in
// code can detect the omission).
//
// Env: NOTION_MONDAY_GIRLS_REGS_DB_ID. Until it is set every helper fail-softs,
// so the season can ship before the DB exists.

export interface MondayGirlsRegistrationRow {
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
  const dbId = process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID;
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

export async function createMondayGirlsRegistrationResult(
  row: MondayGirlsRegistrationRow,
): Promise<CreateDropInResult> {
  const env = notionEnv();
  if (!env) {
    console.warn(
      "[notion-monday-girls-registrations] missing NOTION_API_KEY or NOTION_MONDAY_GIRLS_REGS_DB_ID",
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
      `[notion-monday-girls-registrations] create failed ${res.status}: ${await res.text()}`,
    );
    return classifyNotionFailure(res.status);
  }
  return "ok";
}

export async function findMondayGirlsRegByCheckoutId(
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
export interface MondayGirlsRegistrationLookup {
  pageId: string;
  parentName: string;
  parentEmail: string;
  childFirstName: string;
  group: string;
  status: string;
  amountPaidUsd: number;
  stripeCheckoutSessionId: string;
  /**
   * Notion `created_time` as an ISO date (`YYYY-MM-DD`). Kept for parity with
   * the fall roster shape; this block states its terms at the point of sale
   * from the first row, so there is no grandfathered population to date-check.
   */
  registeredOnIso: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLookup(page: any): MondayGirlsRegistrationLookup {
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
    // Slice, never Date-parse: `YYYY-MM-DD` off the front of Notion's ISO
    // timestamp keeps this timezone-stable on a UTC build server.
    registeredOnIso:
      typeof page.created_time === "string" ? page.created_time.slice(0, 10) : "",
  };
}

async function findMondayGirlsRegBy(
  property: "Stripe Payment Intent ID" | "Stripe Checkout Session ID",
  value: string,
): Promise<MondayGirlsRegistrationLookup | null> {
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
        `[notion-monday-girls-registrations] lookup by ${property} failed ${res.status}`,
      );
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as { results: any[] };
    return data.results[0] ? toLookup(data.results[0]) : null;
  } catch (err) {
    console.error("[notion-monday-girls-registrations] lookup threw", err);
    return null;
  }
}

/**
 * Resolve a roster row from the Payment Intent. The PI is the durable key on a
 * refund — same lesson as cancelDropInByPaymentIntent, where a Checkout-Session
 * re-lookup could come back empty and silently skip the flip.
 */
export async function findMondayGirlsRegByPaymentIntent(
  paymentIntentId: string,
): Promise<MondayGirlsRegistrationLookup | null> {
  return findMondayGirlsRegBy("Stripe Payment Intent ID", paymentIntentId);
}

/** Resolve a roster row from the Checkout Session id (admin path). */
export async function findMondayGirlsRegByCheckoutSessionId(
  checkoutSessionId: string,
): Promise<MondayGirlsRegistrationLookup | null> {
  return findMondayGirlsRegBy("Stripe Checkout Session ID", checkoutSessionId);
}

/**
 * Flip a roster row's Status. Only "Confirmed" rows occupy a seat (the capacity
 * guard filters on it), so moving a row to Refunded/Cancelled frees the seat
 * with no separate decrement.
 */
export async function updateMondayGirlsRegStatus(
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
      `[notion-monday-girls-registrations] status update failed ${res.status}: ${await res.text()}`,
    );
    return false;
  }
  return true;
}

// Capacity + duplicate guard input for /api/checkout-monday-girls. Fail-OPEN
// (empty list) on any Notion problem — same posture as the fall roster: an
// oversold seat or duplicate registration is a refundable mistake, but a
// Notion blip blocking every checkout is a launch-day outage.
export async function fetchMondayGirlsRegistrationKeys(
  group: string,
): Promise<MondayGirlsRegistrationKey[]> {
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
      console.error(
        `[notion-monday-girls-registrations] keys query failed ${res.status}`,
      );
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
    console.error("[notion-monday-girls-registrations] keys query threw", err);
    return [];
  }
}

/**
 * Confirmed-seat count per group for the /monday-girls page's spots-left display.
 * null = unknown (env unset or Notion unavailable) — the page hides the count
 * rather than showing a wrong number.
 */
export async function countMondayGirlsRegistrations(
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
