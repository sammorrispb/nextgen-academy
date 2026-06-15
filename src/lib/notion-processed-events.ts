import { classifyNotionFailure, type CreateDropInResult } from "./notion-dropins";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// NGA Processed Stripe Events Notion DB — a shared webhook-idempotency ledger,
// one row per handled checkout-session id. Camp and league (unlike drop-in and
// cluster) have no roster row of their own, so a Stripe redelivery of a 200'd
// `checkout.session.completed` would re-fire the parent + admin emails. This DB
// is their dedupe key: the handler records the session id BEFORE its best-effort
// comms, and a redelivered event no-ops on the find. One DB serves both kinds
// (and any future one) via the `Kind` column.
//
// Env: NOTION_PROCESSED_EVENTS_DB_ID. Until it is set every helper fail-softs to
// "ok"/false — camp/league behave exactly as they do today (emails fire, no
// dedupe), so this is inert until the DB exists. Required fields:
//   Stripe Session ID (title), Kind (select: camp/league), Processed At (date).

export type ProcessedEventKind = "camp" | "league";

function notionEnv(): { notionKey: string; dbId: string } | null {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_PROCESSED_EVENTS_DB_ID;
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

/** True when this checkout-session id has already been recorded (a no-op
 *  redelivery). Fail-OPEN (false) on any Notion problem or missing env: a
 *  missed dedupe at worst resends one email, but a Notion blip must never block
 *  a paid family's confirmation. */
export async function findProcessedEvent(
  stripeSessionId: string,
): Promise<boolean> {
  const env = notionEnv();
  if (!env || !stripeSessionId) return false;

  const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
    method: "POST",
    headers: headers(env.notionKey),
    body: JSON.stringify({
      filter: {
        property: "Stripe Session ID",
        title: { equals: stripeSessionId },
      },
      page_size: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[notion-processed-events] find failed ${res.status}`);
    return false;
  }
  const data = (await res.json()) as { results: unknown[] };
  return data.results.length > 0;
}

/** Records the dedupe row. Returns "ok" (recorded, or env unset → fail-soft),
 *  "transient" (caller should 500 so Stripe redelivers), or "permanent" (the
 *  caller proceeds with comms anyway — a paid family's confirmation must not be
 *  stranded by a broken ledger; logged here). */
export async function recordProcessedEvent(
  stripeSessionId: string,
  kind: ProcessedEventKind,
  processedAt: string,
): Promise<CreateDropInResult> {
  const env = notionEnv();
  if (!env) {
    console.warn(
      "[notion-processed-events] missing NOTION_API_KEY or NOTION_PROCESSED_EVENTS_DB_ID",
    );
    return "ok";
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: headers(env.notionKey),
    body: JSON.stringify({
      parent: { database_id: env.dbId },
      properties: {
        "Stripe Session ID": {
          title: [{ text: { content: stripeSessionId } }],
        },
        Kind: { select: { name: kind } },
        "Processed At": { date: { start: processedAt } },
      },
    }),
  });

  if (!res.ok) {
    console.error(
      `[notion-processed-events] record failed ${res.status}: ${await res.text()}`,
    );
    return classifyNotionFailure(res.status);
  }
  return "ok";
}
