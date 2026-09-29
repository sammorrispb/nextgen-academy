import { resolveFamilyBucket } from "./lead-family-bucket";
import { isMailable, isTestOrInternal, type LeadRow } from "./lead-segmentation";
import { NOTION_API, NOTION_VERSION, playerCrmDbId, readPlainText } from "./notion-utils";
import type { NewsletterSubscriber } from "./notion-newsletter";

export interface CrmParent extends LeadRow { parentName: string }
export interface SubscriberRow extends NewsletterSubscriber { status: string }
type NewSubscriber = Pick<NewsletterSubscriber, "email" | "parentName">;

// These direct acquisition sources postdate the older outreach classifier.
// Historical provenance and opt-outs still win across every family row.
const DIRECT_SOURCES = new Set(["Website Contact Form", "MVF", "Instagram Ad", "Ad: chatgpt.com"]);

export function planNewsletterAudience(parents: CrmParent[], existing: SubscriberRow[]) {
  const normalized = (email: string) => email.trim().toLowerCase();
  const unsubscribed = new Set(existing.filter(s => s.status === "Unsubscribed").map(s => normalized(s.email)));
  const families = new Map<string, CrmParent[]>();
  const testEmails = new Set<string>();
  const invalidEmails = new Set<string>();
  for (const parent of parents) {
    const email = normalized(parent.parentEmail);
    if (!isMailable(email)) {
      if (email) invalidEmails.add(email);
      continue;
    }
    if (isTestOrInternal(parent.parentName, email)) testEmails.add(email);
    const rows = families.get(email) ?? [];
    rows.push(DIRECT_SOURCES.has(parent.source) ? { ...parent, source: "Website" } : parent);
    families.set(email, rows);
  }
  const buckets = new Map([...families].map(([email, rows]) => [email, resolveFamilyBucket(email, rows, unsubscribed)]));
  const blocked = (email: string) => unsubscribed.has(email) || testEmails.has(email)
    || buckets.get(email) === "suppressed" || buckets.get(email) === "dd_derived";
  const subscribers = new Map<string, NewsletterSubscriber>();
  const known = new Set(existing.map(s => normalized(s.email)));
  for (const subscriber of existing) {
    const email = normalized(subscriber.email);
    if (subscriber.status !== "Active" || !isMailable(email) || blocked(email)
      || isTestOrInternal(subscriber.parentName, email)) continue;
    if (!subscribers.has(email)) subscribers.set(email, { ...subscriber, email });
  }
  const missing: NewSubscriber[] = [];
  for (const [email, rows] of families) {
    if (known.has(email) || blocked(email) || buckets.get(email) !== "eligible") continue;
    missing.push({ email, parentName: rows.find(r => r.parentName.trim())?.parentName.trim() || "Parent" });
  }
  const classified = [...buckets].filter(([email]) => !testEmails.has(email)).map(([, bucket]) => bucket);
  return {
    subscribers: [...subscribers.values()], missing,
    counts: {
      crmFamilies: families.size + invalidEmails.size,
      eligible: classified.filter(b => b === "eligible").length,
      suppressed: classified.filter(b => b === "suppressed").length,
      ddDerived: classified.filter(b => b === "dd_derived").length,
      ambiguous: classified.filter(b => b === "ambiguous").length,
      test: testEmails.size,
      invalid: invalidEmails.size,
    },
  };
}

// Only parent contact and provenance fields are consumed. No child fields
// are written to the newsletter DB or included in summaries.
interface Page {
  id: string;
  // Notion's heterogeneous property union is narrowed by each named reader.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;
}

export async function syncNewsletterAudience(options: { pause?: () => Promise<void> } = {}) {
  const key = process.env.NOTION_API_KEY;
  const newsletterDb = process.env.NOTION_NEWSLETTER_DB_ID;
  if (!key || !newsletterDb) throw new Error("Newsletter sync configuration missing");
  const pause = options.pause ?? (() => new Promise<void>(resolve => setTimeout(resolve, 350)));
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Notion-Version": NOTION_VERSION };
  const query = async (db: string, filter?: unknown): Promise<Page[]> => {
    const pages: Page[] = [];
    const cursors = new Set<string>();
    let cursor: string | undefined;
    do {
      await pause();
      const response = await fetch(`${NOTION_API}/databases/${db}/query`, {
        method: "POST", headers, cache: "no-store",
        body: JSON.stringify({ page_size: 100, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) }),
      });
      if (!response.ok) throw new Error(`Newsletter sync read failed (${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data.results) || typeof data.has_more !== "boolean"
        || data.results.some((p: Page) => !p.id || !p.properties)) throw new Error("Newsletter sync malformed read");
      pages.push(...data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
      if (data.has_more && (typeof cursor !== "string" || !cursor || cursors.has(cursor))) {
        throw new Error("Newsletter sync incomplete pagination");
      }
      if (cursor) cursors.add(cursor);
    } while (cursor);
    return pages;
  };
  const loadParents = async (): Promise<CrmParent[]> => (await query(playerCrmDbId())).map(page => {
    const p = page.properties;
    return {
      parentEmail: p["Parent Email"]?.email ?? "", parentName: readPlainText(p["Parent Name"]),
      source: p.Source?.select?.name ?? "", crEventsAttended: p["CR Events Attended"]?.number ?? null,
      crEventHistory: readPlainText(p["CR Event History"]), lastCrEvent: readPlainText(p["Last CR Event"]),
      season: p.Season?.select?.name ?? "", notes: readPlainText(p.Notes), quarantine: p.Quarantine?.checkbox === true,
    };
  });
  const loadSubscribers = async (): Promise<SubscriberRow[]> => (await query(newsletterDb)).map(page => ({
    pageId: page.id, email: page.properties.Email?.email ?? "",
    parentName: readPlainText(page.properties["Parent Name"]), status: page.properties.Status?.select?.name ?? "",
    referralToken: readPlainText(page.properties["Referral Token"]) || null,
  }));
  const parents = await loadParents();
  const plan = planNewsletterAudience(parents, await loadSubscribers());
  let created = 0;
  for (const parent of plan.missing) {
    // A self-signup/opt-out may have landed since the scan. Never PATCH an
    // existing row or reactivate it from a CRM touchpoint.
    if ((await query(newsletterDb, { property: "Email", email: { equals: parent.email } })).length) continue;
    await pause();
    const response = await fetch(`${NOTION_API}/pages`, {
      method: "POST", headers,
      body: JSON.stringify({
        parent: { database_id: newsletterDb },
        properties: {
          "Parent Name": { title: [{ text: { content: parent.parentName } }] },
          Email: { email: parent.email }, Status: { select: { name: "Active" } },
          "Marketing Opt-In": { checkbox: false },
        },
        children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: {
          content: "Added by NGA CRM newsletter reconciliation under Sam's 2026-09-28 inclusion policy. This is an operator enrollment, not a recorded self-signup. Existing opt-outs are preserved.",
        } }] } }],
      }),
    });
    if (!response.ok) throw new Error(`Newsletter sync create failed (${response.status})`);
    created++;
  }
  // Re-read both suppression sources before handing any recipient to Resend.
  // A partial backfill is safe to rerun; a partial audience must never send.
  const refreshed = planNewsletterAudience(await loadParents(), await loadSubscribers());
  if (refreshed.missing.length) throw new Error("Newsletter sync did not converge");
  return { subscribers: refreshed.subscribers, created, ...refreshed.counts };
}
