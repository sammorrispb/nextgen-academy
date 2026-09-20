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
//
// BLOCK-WIDE, NOT PER LEVEL — no `Group` filter, deliberately. Beginner and
// Advanced Beginner share one 6:00–7:00 PM booking and therefore one seat cap
// (see MONDAY_GIRLS_BLOCK_SEATS), so a query narrowed to one level would let
// each level fill "its" half of a court that holds eight in total. It also
// makes the duplicate guard block-wide, which is what we want: a kid should
// not be registerable twice by switching level. Pinned by
// invariant-monday-girls-block-capacity.
export async function fetchMondayGirlsRegistrationKeys(): Promise<
  MondayGirlsRegistrationKey[]
> {
  const env = notionEnv();
  if (!env) return [];

  try {
    const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
      method: "POST",
      headers: headers(env.notionKey),
      body: JSON.stringify({
        filter: { property: "Status", select: { equals: "Confirmed" } },
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
 * Confirmed-seat count for the /monday-girls page's spots-left display.
 *
 * BLOCK-WIDE, matching the cap it is displayed against: one hour, one court,
 * one number. null = unknown (env unset or Notion unavailable) — the page hides
 * the count rather than showing a wrong one.
 */
export async function countMondayGirlsRegistrations(): Promise<number | null> {
  const env = notionEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
      method: "POST",
      headers: headers(env.notionKey),
      body: JSON.stringify({
        filter: { property: "Status", select: { equals: "Confirmed" } },
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

/**
 * The full roster, for the admin view at /admin/monday-girls.
 *
 * DELIBERATELY SEPARATE from fetchMondayGirlsRegistrationKeys, which fails OPEN
 * (returns []) on any Notion problem because it gates checkout and a blip must
 * not block a sale. An admin roster inherits the opposite duty: an empty table
 * that really means "Notion is unreachable" would tell Sam nobody registered.
 * So this read reports a discriminated status and the page renders the failure.
 *
 * Reads every row, Confirmed and Refunded alike — a refunded family is part of
 * what an operator needs to see. Narrowing for the page happens in
 * admin-monday-girls-roster.ts, not here.
 */
export interface MondayGirlsRosterRow {
  pageId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number | null;
  group: string;
  status: string;
  amountPaidUsd: number;
  allergies: string;
  emergencyName: string;
  emergencyPhone: string;
  smsConsent: boolean;
  stripeCheckoutSessionId: string;
  /** Notion `created_time` sliced to `YYYY-MM-DD` — the day they registered. */
  registeredOnIso: string;
}

export type MondayGirlsRosterResult =
  | { status: "ok"; rows: MondayGirlsRosterRow[] }
  | { status: "config_missing" }
  | { status: "query_failed"; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRosterRow(page: any): MondayGirlsRosterRow {
  const p = page.properties ?? {};
  return {
    pageId: page.id ?? "",
    parentName: p["Parent Name"]?.title?.[0]?.plain_text ?? "",
    parentEmail: p["Parent Email"]?.email ?? "",
    parentPhone: p["Parent Phone"]?.phone_number ?? "",
    childFirstName: p["Child First Name"]?.rich_text?.[0]?.plain_text ?? "",
    childBirthYear: p["Child Birth Year"]?.number ?? null,
    group: p["Group"]?.select?.name ?? "",
    status: p["Status"]?.select?.name ?? "",
    amountPaidUsd: p["Amount Paid"]?.number ?? 0,
    allergies: p["Allergies"]?.rich_text?.[0]?.plain_text ?? "",
    emergencyName: p["Emergency Name"]?.rich_text?.[0]?.plain_text ?? "",
    emergencyPhone: p["Emergency Phone"]?.phone_number ?? "",
    smsConsent: p["SMS Consent"]?.checkbox === true,
    stripeCheckoutSessionId:
      p["Stripe Checkout Session ID"]?.rich_text?.[0]?.plain_text ?? "",
    // Slice, never Date-parse — keeps this timezone-stable on a UTC server.
    registeredOnIso:
      typeof page.created_time === "string" ? page.created_time.slice(0, 10) : "",
  };
}

export async function fetchMondayGirlsRoster(): Promise<MondayGirlsRosterResult> {
  const env = notionEnv();
  if (!env) return { status: "config_missing" };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    let cursor: string | undefined;
    // Follow has_more: maybes and dismissed rows share this DB, so a read that
    // stopped at Notion's 100-row page would drop registrations silently.
    do {
      const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
        method: "POST",
        headers: headers(env.notionKey),
        // No server-side filter: Notion 400s a filter naming a property the DB
        // lacks, which would turn a missing column into a total read failure.
        body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
        cache: "no-store",
      });
      if (!res.ok) {
        const message = `Notion returned ${res.status}`;
        console.error(`[notion-monday-girls-registrations] roster query failed ${res.status}`);
        return { status: "query_failed", message };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await res.json()) as { results: any[]; has_more?: boolean; next_cursor?: string };
      results.push(...(data.results ?? []));
      cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
    } while (cursor);
    const rows = results.map(toRosterRow);
    rows.sort((a, b) => a.registeredOnIso.localeCompare(b.registeredOnIso));
    return { status: "ok", rows };
  } catch (err) {
    console.error("[notion-monday-girls-registrations] roster query threw", err);
    return {
      status: "query_failed",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ---------- admin writes (/admin/monday-girls) ------------------------------ */

/** Notion ids arrive dashed from the API and undashed from env — compare bare. */
function sameNotionId(a: string, b: string): boolean {
  const norm = (v: string) => v.replace(/-/g, "").toLowerCase();
  return norm(a) === norm(b);
}

export interface MondayGirlsAdminPage {
  pageId: string;
  parentName: string;
  parentEmail: string;
  childFirstName: string;
  group: string;
  status: string;
  amountPaidUsd: number;
  stripePaymentIntentId: string;
  registeredOnIso: string;
}

export type MondayGirlsPageResult =
  | { status: "ok"; page: MondayGirlsAdminPage }
  | { status: "config_missing" | "not_found" | "wrong_database" }
  | { status: "query_failed"; message: string };

/**
 * Read one page for an admin write, and PROVE it belongs to this database first.
 * The "Player DB" integration can see every NGA database, so a raw page id alone
 * could otherwise re-label a row in the drop-ins or Player CRM DB.
 *
 * Discriminated, never null: "not on file", "Notion is down" and "not
 * configured" are different things to tell an operator.
 */
export async function getMondayGirlsPage(pageId: string): Promise<MondayGirlsPageResult> {
  const env = notionEnv();
  if (!env) return { status: "config_missing" };
  try {
    const res = await fetch(`${NOTION_API}/pages/${encodeURIComponent(pageId)}`, {
      headers: headers(env.notionKey),
      cache: "no-store",
    });
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "query_failed", message: `Notion returned ${res.status}` };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = (await res.json()) as any;
    const parentDb: string = page?.parent?.database_id ?? "";
    if (!parentDb || !sameNotionId(parentDb, env.dbId)) return { status: "wrong_database" };
    const p = page.properties ?? {};
    return {
      status: "ok",
      page: {
        pageId: page.id ?? pageId,
        parentName: p["Parent Name"]?.title?.[0]?.plain_text ?? "",
        parentEmail: p["Parent Email"]?.email ?? "",
        childFirstName: p["Child First Name"]?.rich_text?.[0]?.plain_text ?? "",
        group: p["Group"]?.select?.name ?? "",
        status: p["Status"]?.select?.name ?? "",
        amountPaidUsd: p["Amount Paid"]?.number ?? 0,
        stripePaymentIntentId: p["Stripe Payment Intent ID"]?.rich_text?.[0]?.plain_text ?? "",
        registeredOnIso:
          typeof page.created_time === "string" ? page.created_time.slice(0, 10) : "",
      },
    };
  } catch (err) {
    return { status: "query_failed", message: err instanceof Error ? err.message : String(err) };
  }
}

/** Write a Status on a page already verified by getMondayGirlsPage. Never throws. */
export async function setMondayGirlsPageStatus(
  pageId: string,
  status: "Refunded" | "Cancelled" | "Dismissed",
): Promise<boolean> {
  const env = notionEnv();
  if (!env) return false;
  try {
    const res = await fetch(`${NOTION_API}/pages/${encodeURIComponent(pageId)}`, {
      method: "PATCH",
      headers: headers(env.notionKey),
      body: JSON.stringify({ properties: { Status: { select: { name: status } } } }),
    });
    if (!res.ok) {
      console.error(`[notion-monday-girls-registrations] admin status write failed ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notion-monday-girls-registrations] admin status write threw", err);
    return false;
  }
}

export interface MondayGirlsMaybeRow {
  parentName: string;
  childFirstName: string;
  parentEmail: string;
  group: string;
}

/**
 * A "maybe": a family Sam is talking to who hasn't registered. Deliberately the
 * minimum — parent name, child first name, optional email, group — with no
 * birth year, safety fields or Stripe ids, and Status "Maybe", which no
 * capacity, duplicate or webhook reader counts. Property keys are written from
 * an explicit list, so nothing a caller adds can reach Notion.
 */
export async function createMondayGirlsMaybe(
  row: MondayGirlsMaybeRow,
): Promise<{ ok: true; pageId: string } | { ok: false; message: string }> {
  const env = notionEnv();
  if (!env) return { ok: false, message: "Roster database isn't configured" };
  try {
    const res = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: headers(env.notionKey),
      body: JSON.stringify({
        parent: { database_id: env.dbId },
        properties: {
          "Parent Name": { title: [{ text: { content: row.parentName } }] },
          "Child First Name": { rich_text: [{ text: { content: row.childFirstName } }] },
          "Parent Email": { email: row.parentEmail || null },
          Group: { select: { name: row.group } },
          Status: { select: { name: "Maybe" } },
        },
      }),
    });
    if (!res.ok) return { ok: false, message: `Notion returned ${res.status}` };
    const data = (await res.json()) as { id?: string };
    return { ok: true, pageId: data.id ?? "" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
