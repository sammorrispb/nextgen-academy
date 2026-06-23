import type Stripe from "stripe";

/**
 * Camp roster store — the durable list of who's registered for a camp week,
 * built as a READ-MODEL from Stripe (the system of record for camp payments;
 * camp checkouts write no roster row at payment time — see cancel-camp.ts).
 * `syncCampRoster` pages paid camp Checkout Sessions for a slug and upserts one
 * Notion row each, keyed by Stripe Session ID (idempotent — re-runs never
 * duplicate). The Friday-before-camp reminder cron reads this roster and uses
 * the per-row `Reminder Sent` checkbox for send-once idempotency, mirroring the
 * drop-in reminder pattern (notion-dropins.ts markDropInFlag).
 *
 * Minor-PII: a roster row holds the child's FIRST NAME + BIRTH YEAR only (never
 * DOB, never more — same inventory as the drop-in roster) alongside the parent
 * contact. It carries NO exact venue (resolved from camps.ts at send time).
 * Child fields egress only to Notion here; pinned by
 * e2e/invariant-camp-reminder-egress.spec.ts.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface CampRosterEntry {
  stripeSessionId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number | null;
  campSlug: string;
  campTitle: string;
  campWeek: string;
  optionLabel: string;
  /** ISO date-only, from the Stripe session's created timestamp. */
  registeredAt: string;
}

/** A reminder-ready recipient read back from the roster DB. */
export interface CampRosterRecipient {
  pageId: string;
  parentEmail: string;
  parentFirst: string;
  childFirst: string;
  optionLabel: string;
}

export interface SyncCampRosterResult {
  scanned: number;
  paidForSlug: number;
  created: number;
  existing: number;
  failed: number;
}

/**
 * Structural subset of the Stripe client we use — lets tests inject a stub
 * session source without the real SDK (which rides its own HTTP transport, not
 * globalThis.fetch). The real Stripe instance satisfies this.
 */
export interface CampSessionSource {
  checkout: {
    sessions: {
      list(params: {
        limit: number;
        expand?: string[];
      }): AsyncIterable<Stripe.Checkout.Session>;
    };
  };
}

function metaString(
  meta: Stripe.Metadata | null | undefined,
  key: string,
): string {
  const v = meta?.[key];
  return typeof v === "string" ? v : "";
}

function notionHeaders(notionKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${notionKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

/**
 * A camp registration drops off the roster once its charge is fully refunded —
 * a refunded Checkout Session still reports payment_status:"paid" (the refund
 * lands on the charge, not the session), so without this the read-model would
 * re-add a cancelled camper on the next sync. We expand
 * payment_intent.latest_charge in the list call; if it isn't expanded (e.g. a
 * test stub omits it) default to "not refunded" so a real paid registration is
 * never dropped on missing data.
 */
function isFullyRefunded(session: Stripe.Checkout.Session): boolean {
  const pi = session.payment_intent;
  if (!pi || typeof pi === "string") return false;
  const charge = pi.latest_charge;
  if (!charge || typeof charge === "string") return false;
  return charge.refunded === true;
}

/**
 * Page paid camp Checkout Sessions for a slug into roster entries. Checkout
 * Sessions can't be server-filtered by metadata, so page newest-first and match
 * client-side; cap the scan so a never-matching slug can't run away on a large
 * account (same discipline as cancel-camp.ts findCampSessionByEmail).
 */
export async function collectPaidCampSessions(
  slug: string,
  stripe: CampSessionSource,
): Promise<{ entries: CampRosterEntry[]; scanned: number }> {
  const entries: CampRosterEntry[] = [];
  let scanned = 0;
  for await (const session of stripe.checkout.sessions.list({
    limit: 100,
    expand: ["data.payment_intent.latest_charge"],
  })) {
    scanned += 1;
    const m = session.metadata;
    if (
      session.payment_status === "paid" &&
      m?.kind === "camp" &&
      m?.camp_slug === slug &&
      !isFullyRefunded(session)
    ) {
      const parentEmail = (
        session.customer_details?.email ??
        session.customer_email ??
        metaString(m, "parent_email") ??
        ""
      ).trim();
      const birthYearRaw = metaString(m, "child_birth_year");
      const birthYear = /^\d{4}$/.test(birthYearRaw)
        ? Number(birthYearRaw)
        : null;
      const registeredAt = session.created
        ? new Date(session.created * 1000).toISOString().slice(0, 10)
        : "";
      // Trim free-text parent/child fields — Stripe carries them verbatim from
      // the checkout form, so a stray leading/trailing space ("Krishav ") would
      // otherwise land in the roster + render in the greeting.
      entries.push({
        stripeSessionId: session.id,
        parentName: metaString(m, "parent_name").trim(),
        parentEmail,
        parentPhone: metaString(m, "parent_phone").trim(),
        childFirstName: metaString(m, "child_first_name").trim(),
        childBirthYear: birthYear,
        campSlug: slug,
        campTitle: metaString(m, "camp_title"),
        campWeek: metaString(m, "camp_week"),
        optionLabel: metaString(m, "option_label"),
        registeredAt,
      });
    }
    if (scanned >= 1000) break;
  }
  return { entries, scanned };
}

/** True if a roster row already exists for this Stripe session id. */
async function rosterRowExists(
  notionKey: string,
  dbId: string,
  stripeSessionId: string,
): Promise<boolean> {
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      filter: {
        property: "Stripe Session ID",
        rich_text: { equals: stripeSessionId },
      },
      page_size: 1,
    }),
  });
  if (!res.ok) {
    // Treat an unreadable query as "exists" so we never double-create on a
    // transient Notion blip; the row simply won't be added this run.
    console.error(
      "[notion-camp-roster] query failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return true;
  }
  const data = (await res.json()) as { results?: unknown[] };
  return (data.results?.length ?? 0) > 0;
}

async function createRosterRow(
  notionKey: string,
  dbId: string,
  entry: CampRosterEntry,
): Promise<boolean> {
  const title = `${entry.childFirstName || "Camper"} — ${entry.campWeek || entry.campSlug}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Name: { title: [{ text: { content: title } }] },
    "Parent Name": { rich_text: [{ text: { content: entry.parentName } }] },
    "Parent Email": { email: entry.parentEmail || null },
    "Parent Phone": { phone_number: entry.parentPhone || null },
    "Child First Name": {
      rich_text: [{ text: { content: entry.childFirstName } }],
    },
    "Camp Slug": { rich_text: [{ text: { content: entry.campSlug } }] },
    "Camp Title": { rich_text: [{ text: { content: entry.campTitle } }] },
    "Camp Week": { rich_text: [{ text: { content: entry.campWeek } }] },
    "Option Label": { rich_text: [{ text: { content: entry.optionLabel } }] },
    "Stripe Session ID": {
      rich_text: [{ text: { content: entry.stripeSessionId } }],
    },
    "Reminder Sent": { checkbox: false },
  };
  if (entry.childBirthYear !== null) {
    properties["Child Birth Year"] = { number: entry.childBirthYear };
  }
  if (entry.registeredAt) {
    properties["Registered At"] = { date: { start: entry.registeredAt } };
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: notionHeaders(notionKey),
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  if (!res.ok) {
    console.error(
      "[notion-camp-roster] create failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}

/**
 * Upsert the roster for a camp slug from Stripe. Idempotent: a row already
 * keyed by its Stripe Session ID is left untouched. Gracefully no-ops if the
 * Notion env is unset.
 */
export async function syncCampRoster(
  slug: string,
  stripe: CampSessionSource,
): Promise<SyncCampRosterResult> {
  const result: SyncCampRosterResult = {
    scanned: 0,
    paidForSlug: 0,
    created: 0,
    existing: 0,
    failed: 0,
  };
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_CAMP_ROSTER_DB_ID;
  if (!notionKey || !dbId) {
    console.warn(
      "[notion-camp-roster] missing NOTION_API_KEY or NOTION_CAMP_ROSTER_DB_ID",
    );
    return result;
  }

  const { entries, scanned } = await collectPaidCampSessions(slug, stripe);
  result.scanned = scanned;
  result.paidForSlug = entries.length;

  for (const entry of entries) {
    if (await rosterRowExists(notionKey, dbId, entry.stripeSessionId)) {
      result.existing += 1;
      continue;
    }
    if (await createRosterRow(notionKey, dbId, entry)) {
      result.created += 1;
    } else {
      result.failed += 1;
    }
  }
  return result;
}

function plainRichText(prop: unknown): string {
  const rt = (prop as { rich_text?: { plain_text?: string }[] })?.rich_text;
  return rt?.map((t) => t.plain_text ?? "").join("") ?? "";
}

/**
 * Read back the camp roster rows that still need a reminder (Reminder Sent
 * false) for a slug. Paginates the Notion query. Returns parent-addressed
 * recipients only.
 */
export async function fetchCampRosterForReminder(
  slug: string,
): Promise<CampRosterRecipient[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_CAMP_ROSTER_DB_ID;
  if (!notionKey || !dbId) return [];

  const recipients: CampRosterRecipient[] = [];
  let cursor: string | undefined;
  do {
    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: "POST",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Camp Slug", rich_text: { equals: slug } },
            { property: "Reminder Sent", checkbox: { equals: false } },
          ],
        },
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    if (!res.ok) {
      console.error(
        "[notion-camp-roster] reminder query failed",
        res.status,
        await res.text().catch(() => ""),
      );
      break;
    }
    const data = (await res.json()) as {
      results?: { id: string; properties?: Record<string, unknown> }[];
      has_more?: boolean;
      next_cursor?: string | null;
    };
    for (const row of data.results ?? []) {
      const props = row.properties ?? {};
      const parentEmail =
        (props["Parent Email"] as { email?: string | null })?.email ?? "";
      const parentName = plainRichText(props["Parent Name"]);
      const childFirst = plainRichText(props["Child First Name"]);
      const optionLabel = plainRichText(props["Option Label"]);
      if (!parentEmail) continue;
      recipients.push({
        pageId: row.id,
        parentEmail,
        parentFirst: parentName.split(/\s+/)[0] || "there",
        childFirst: childFirst || "your camper",
        optionLabel,
      });
    }
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return recipients;
}

/** Flip a roster row's Reminder Sent checkbox to true after a successful send. */
export async function markCampReminderSent(pageId: string): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      properties: { "Reminder Sent": { checkbox: true } },
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-camp-roster] markCampReminderSent failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}
