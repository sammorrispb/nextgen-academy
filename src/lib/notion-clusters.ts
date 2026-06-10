import { classifyNotionFailure, type CreateDropInResult } from "./notion-dropins";
import type { ClusterRegistrationKey } from "./validate-cluster";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Cluster Registrations Notion DB — the season roster AND the webhook's
// idempotency key (row keyed on Stripe checkout-session id), closing the
// documented league/camp gap where redelivered events could resend emails.
// The DUPR ID column exists from day one so "stamped %" is countable, but
// stamping is opt-in per family (U14+ in v1) — empty is a valid state.
// Env: NOTION_CLUSTER_REGS_DB_ID (create the DB before flipping any launch
// gate; until then every helper fail-softs).

export interface ClusterRegistrationRow {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthDate: string;
  band: "U12" | "U14";
  ballLevel: string;
  clusterSlug: string;
  amountPaidUsd: number;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  displayConsent: boolean;
  smsConsent: boolean;
  smsConsentText: string;
  emergencyName: string;
  emergencyPhone: string;
  allergies: string;
}

function notionEnv(): { notionKey: string; dbId: string } | null {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_CLUSTER_REGS_DB_ID;
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

export async function createClusterRegistrationResult(
  row: ClusterRegistrationRow,
): Promise<CreateDropInResult> {
  const env = notionEnv();
  if (!env) {
    console.warn(
      "[notion-clusters] missing NOTION_API_KEY or NOTION_CLUSTER_REGS_DB_ID",
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
        "Child Birth Date": { date: { start: row.childBirthDate } },
        Band: { select: { name: row.band } },
        "Ball Level": { select: { name: row.ballLevel } },
        Cluster: { select: { name: row.clusterSlug } },
        Status: { select: { name: "Confirmed" } },
        "Amount Paid": { number: row.amountPaidUsd },
        "Stripe Checkout Session ID": {
          rich_text: [{ text: { content: row.stripeCheckoutSessionId } }],
        },
        "Stripe Payment Intent ID": {
          rich_text: [{ text: { content: row.stripePaymentIntentId ?? "" } }],
        },
        "Display Consent": { checkbox: row.displayConsent },
        "SMS Consent": { checkbox: row.smsConsent },
        "SMS Consent Text": {
          rich_text: [{ text: { content: row.smsConsentText.slice(0, 1900) } }],
        },
        "Emergency Name": {
          rich_text: [{ text: { content: row.emergencyName } }],
        },
        "Emergency Phone": { phone_number: row.emergencyPhone || null },
        Allergies: { rich_text: [{ text: { content: row.allergies.slice(0, 1900) } }] },
        "DUPR ID": { rich_text: [] },
      },
    }),
  });

  if (!res.ok) {
    console.error(
      `[notion-clusters] create failed ${res.status}: ${await res.text()}`,
    );
    return classifyNotionFailure(res.status);
  }
  return "ok";
}

export async function findClusterRegByCheckoutId(
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

// Duplicate guard input for /api/checkout-cluster. Fail-OPEN (empty list) on
// any Notion problem: a duplicate registration is a refundable mistake, but a
// Notion blip blocking every checkout is a launch-day outage.
export async function fetchClusterRegistrationKeys(
  clusterSlug: string,
): Promise<ClusterRegistrationKey[]> {
  const env = notionEnv();
  if (!env) return [];

  try {
    const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
      method: "POST",
      headers: headers(env.notionKey),
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Cluster", select: { equals: clusterSlug } },
            { property: "Status", select: { equals: "Confirmed" } },
          ],
        },
        page_size: 100,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[notion-clusters] keys query failed ${res.status}`);
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as { results: any[] };
    return data.results.map((page) => ({
      childFirstName:
        page.properties?.["Child First Name"]?.rich_text?.[0]?.plain_text ?? "",
      parentEmail: page.properties?.["Parent Email"]?.email ?? "",
      clusterSlug:
        page.properties?.Cluster?.select?.name ?? clusterSlug,
    }));
  } catch (err) {
    console.error("[notion-clusters] keys query threw", err);
    return [];
  }
}
