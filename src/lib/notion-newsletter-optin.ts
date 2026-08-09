import { signReferralToken } from "./referral-token";

/**
 * Write side of the lead-CRM permission pass: record a family's explicit "yes"
 * as a Newsletter Subscribers row.
 *
 * Deliberately separate from /api/newsletter's signup write. That path owns the
 * public form — validation, rate limit, welcome email, Open Brain ingest. This
 * one records a consent click from an email we already sent, where the parent
 * name and child age aren't in hand and no welcome email is wanted (they just
 * read one). Reusing the form path would have meant faking those fields.
 *
 * Reactivating an Unsubscribed row is intentional: clicking "yes, keep me
 * posted" in a later email is a newer, explicit choice than an older opt-out,
 * and it is the parent's own click that makes it.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface SubscribeResult {
  ok: boolean;
  /** True when the row already existed with Status = Active (no-op). */
  alreadyActive: boolean;
}

export async function subscribeLeadByEmail(
  email: string,
): Promise<SubscribeResult> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_NEWSLETTER_DB_ID;
  if (!notionKey || !db) {
    console.error("[newsletter-optin] NOTION_API_KEY or NOTION_NEWSLETTER_DB_ID missing");
    return { ok: false, alreadyActive: false };
  }

  const normalized = email.trim().toLowerCase();
  const headers = {
    Authorization: `Bearer ${notionKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };

  const queryRes = await fetch(`${NOTION_API}/databases/${db}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filter: { property: "Email", email: { equals: normalized } },
      page_size: 1,
    }),
  });
  if (!queryRes.ok) {
    const text = await queryRes.text().catch(() => "");
    console.error(`[newsletter-optin] query failed (${queryRes.status}): ${text}`);
    return { ok: false, alreadyActive: false };
  }
  const data = await queryRes.json();
  const existing = data.results?.[0];

  if (existing) {
    const status = existing.properties?.Status?.select?.name ?? "";
    if (status === "Active") return { ok: true, alreadyActive: true };

    const patchRes = await fetch(`${NOTION_API}/pages/${existing.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        properties: {
          Status: { select: { name: "Active" } },
          "Marketing Opt-In": { checkbox: true },
        },
      }),
    });
    if (!patchRes.ok) {
      const text = await patchRes.text().catch(() => "");
      console.error(`[newsletter-optin] patch failed (${patchRes.status}): ${text}`);
      return { ok: false, alreadyActive: false };
    }
    return { ok: true, alreadyActive: false };
  }

  // Parent Name is the title property and cannot be empty, so fall back to the
  // local part of the address rather than inventing a name.
  const fallbackName = normalized.split("@")[0] || "Friend";
  const referralToken = signReferralToken(normalized);

  const createRes = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      parent: { database_id: db },
      properties: {
        "Parent Name": { title: [{ text: { content: fallbackName } }] },
        Email: { email: normalized },
        Status: { select: { name: "Active" } },
        "Marketing Opt-In": { checkbox: true },
        // No welcome email is sent for a consent click — the parent is reading
        // one of ours right now — so the flag starts true to keep the weekly
        // cron from treating this row as owing a welcome.
        "Welcome Sent": { checkbox: true },
        "Referral Rewarded": { checkbox: false },
        "Coupons Issued": { number: 0 },
        ...(referralToken
          ? { "Referral Token": { rich_text: [{ text: { content: referralToken } }] } }
          : {}),
      },
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    console.error(`[newsletter-optin] create failed (${createRes.status}): ${text}`);
    return { ok: false, alreadyActive: false };
  }
  return { ok: true, alreadyActive: false };
}
