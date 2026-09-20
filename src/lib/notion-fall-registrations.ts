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
  /**
   * Notion `created_time` as an ISO date (`YYYY-MM-DD`). The refund policy keys
   * the no-refund cutoff off WHEN the family registered, so this has to travel
   * with the row — see fall-refund-policy.ts.
   */
  registeredOnIso: string;
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
    // Slice, never Date-parse: `YYYY-MM-DD` off the front of Notion's ISO
    // timestamp keeps this timezone-stable on a UTC build server.
    registeredOnIso:
      typeof page.created_time === "string" ? page.created_time.slice(0, 10) : "",
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

function sameNotionId(a: string, b: string): boolean {
  const norm = (v: string) => v.replace(/-/g, "").toLowerCase();
  return norm(a) === norm(b);
}

/** The narrow view of one registration row the trial-profile link needs. */
export interface FallRegistrationPage {
  pageId: string;
  childFirstName: string;
  group: string;
  status: string;
}

export type FallRegistrationPageResult =
  | { status: "ok"; page: FallRegistrationPage }
  | { status: "config_missing" }
  | { status: "not_found" }
  | { status: "wrong_database" }
  | { status: "query_failed"; message: string };

/**
 * Read ONE registration row, proving first that it belongs to THIS database.
 * The "Player DB" integration can see every NGA database, so a page id alone
 * proves nothing — the same guard `getMondayGirlsPage` applies before any write.
 *
 * Narrowed on purpose: the link action needs a name to compare, a group to
 * match and a status to check. It has no business reading allergies or an
 * emergency contact, so it cannot.
 */
export async function getFallRegistrationPage(
  pageId: string,
): Promise<FallRegistrationPageResult> {
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
        childFirstName: p["Child First Name"]?.rich_text?.[0]?.plain_text ?? "",
        group: p["Group"]?.select?.name ?? "",
        status: p["Status"]?.select?.name ?? "",
      },
    };
  } catch (err) {
    return { status: "query_failed", message: err instanceof Error ? err.message : String(err) };
  }
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

// ---------------------------------------------------------------------------
// Season-league roster read (2026-09-13)
// ---------------------------------------------------------------------------

/** The little the league needs of a roster row: an id to key games on and a
 * first name to render. No parent contact, birth year, emergency contact or
 * allergy ever leaves this reader — pinned by
 * e2e/invariant-season-league-egress.spec.ts. */
export interface FallRosterPlayer {
  pageId: string;
  childFirstName: string;
  group: string;
  status: string;
}

export type FallRosterStatus = "ok" | "config_missing" | "query_failed";

export interface FallRosterResult {
  players: FallRosterPlayer[];
  status: FallRosterStatus;
}

const ROSTER_MAX_PAGES = 5;

/**
 * Every registration row in a group, ALL statuses, paginated. The league
 * schedules Confirmed kids only, but a refunded kid's played games still
 * reference their id, so display needs the whole set. Never throws: env unset
 * → config_missing with zero calls; a failed query → query_failed.
 */
export async function fetchFallRosterForLeague(group: string): Promise<FallRosterResult> {
  const env = notionEnv();
  if (!env) return { players: [], status: "config_missing" };

  const players: FallRosterPlayer[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < ROSTER_MAX_PAGES; page += 1) {
      const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
        method: "POST",
        headers: headers(env.notionKey),
        body: JSON.stringify({
          filter: { property: "Group", select: { equals: group } },
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
        cache: "no-store",
      });
      if (!res.ok) {
        console.error(`[notion-fall-registrations] roster query failed ${res.status}`);
        return { players: [], status: "query_failed" };
      }
      const data = (await res.json()) as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results?: any[];
        has_more?: boolean;
        next_cursor?: string | null;
      };
      for (const pageRow of data.results ?? []) {
        const p = pageRow?.properties ?? {};
        players.push({
          pageId: String(pageRow?.id ?? ""),
          childFirstName: p["Child First Name"]?.rich_text?.[0]?.plain_text ?? "",
          group: p["Group"]?.select?.name ?? "",
          status: p["Status"]?.select?.name ?? "",
        });
      }
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }
  } catch (err) {
    console.error("[notion-fall-registrations] roster query threw", err);
    return { players: [], status: "query_failed" };
  }
  return { players: players.filter((p) => p.pageId), status: "ok" };
}

// ---------------------------------------------------------------------------
// Admin roster read (2026-09-15)
// ---------------------------------------------------------------------------

/**
 * A full roster row for /admin/fall.
 *
 * This is the WIDE read — it carries the safety fields the Notion row holds so
 * the parse stays faithful to the schema; `admin-fall-roster.ts` is what
 * narrows them away before anything reaches the page.
 */
export interface FallRosterRow {
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
  smsConsentText: string;
  stripeCheckoutSessionId: string;
  /** Notion `created_time` sliced to `YYYY-MM-DD` — the day they registered. */
  registeredOnIso: string;
}

export type FallRosterReadResult =
  | { status: "ok"; rows: FallRosterRow[] }
  | { status: "config_missing" }
  | { status: "query_failed"; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRosterRow(page: any): FallRosterRow {
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
    smsConsentText: p["SMS Consent Text"]?.rich_text?.[0]?.plain_text ?? "",
    stripeCheckoutSessionId:
      p["Stripe Checkout Session ID"]?.rich_text?.[0]?.plain_text ?? "",
    // Slice, never Date-parse — keeps this timezone-stable on a UTC server.
    registeredOnIso:
      typeof page.created_time === "string" ? page.created_time.slice(0, 10) : "",
  };
}

/**
 * The whole season roster, both groups, every status — for /admin/fall.
 *
 * THREE readers now touch this DB and they must stay apart:
 *  - `fetchFallRegistrationKeys` fails OPEN (`[]`) because it gates checkout;
 *    a Notion blip must never block a sale.
 *  - `fetchFallRosterForLeague` is narrowed to an id + a first name, because
 *    the league renders names and nothing else.
 *  - this one fails LOUD, because an empty table that really means "Notion is
 *    unreachable" would tell an operator nobody registered.
 * Collapsing any pair of them re-introduces one of those bugs.
 *
 * No server-side filter on purpose: Notion 400s a filter naming a property the
 * DB lacks, which would turn one missing column into a total read failure.
 * Grouping happens in the projection instead.
 */
export async function fetchFallRoster(): Promise<FallRosterReadResult> {
  const env = notionEnv();
  if (!env) return { status: "config_missing" };

  const rows: FallRosterRow[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < ROSTER_MAX_PAGES; page += 1) {
      const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
        method: "POST",
        headers: headers(env.notionKey),
        body: JSON.stringify({
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
        cache: "no-store",
      });
      if (!res.ok) {
        const message = `Notion returned ${res.status}`;
        console.error(`[notion-fall-registrations] admin roster query failed ${res.status}`);
        return { status: "query_failed", message };
      }
      const data = (await res.json()) as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results?: any[];
        has_more?: boolean;
        next_cursor?: string | null;
      };
      for (const pageRow of data.results ?? []) rows.push(toRosterRow(pageRow));
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }
  } catch (err) {
    console.error("[notion-fall-registrations] admin roster query threw", err);
    return {
      status: "query_failed",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  rows.sort((a, b) => a.registeredOnIso.localeCompare(b.registeredOnIso));
  return { status: "ok", rows };
}
