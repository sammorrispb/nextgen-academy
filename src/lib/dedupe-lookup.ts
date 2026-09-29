import { NOTION_API, NOTION_VERSION, classifyNotionFailure } from "@/lib/notion-utils";

/**
 * A Stripe-webhook duplicate check that could not answer.
 *
 * The five `find*ByCheckoutId` guards used to return "not recorded" on ANY
 * Notion failure, so a 429 on a Stripe redelivery created a second roster row
 * (a doubled seat, a doubled count, a second parent email + SMS). They now
 * throw this instead, classified the same way the row CREATE is:
 *   - transient (429 / 5xx / network) → the webhook returns 500 and Stripe
 *     redelivers, re-running the check once Notion is back;
 *   - permanent (any other 4xx — DB unshared, property renamed) → retrying is
 *     pointless, so the webhook alerts once and still records the family.
 * Pinned by e2e/invariant-webhook-dedupe-fail-closed.spec.ts.
 */
export class DedupeLookupError extends Error {
  constructor(
    readonly kind: "transient" | "permanent",
    readonly status: number | null,
  ) {
    super(`dedupe lookup failed (${kind}${status ? ` ${status}` : ""})`);
    this.name = "DedupeLookupError";
  }
}

/** True when a row with this Stripe Checkout Session ID exists. Throws
 * DedupeLookupError when Notion can't say. */
export async function checkoutRowExists(
  notionKey: string,
  dbId: string,
  checkoutSessionId: string,
): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        filter: {
          property: "Stripe Checkout Session ID",
          rich_text: { equals: checkoutSessionId },
        },
        page_size: 1,
      }),
      cache: "no-store",
    });
  } catch {
    throw new DedupeLookupError("transient", null);
  }
  if (!res.ok) {
    throw new DedupeLookupError(classifyNotionFailure(res.status), res.status);
  }
  const data = (await res.json()) as { results?: unknown[] };
  return (data.results?.length ?? 0) > 0;
}
