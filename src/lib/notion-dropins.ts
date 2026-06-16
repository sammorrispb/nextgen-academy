const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface DropInRow {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number;
  sessionTitle: string;
  sessionDate: string;
  sessionStartTime: string;
  /** Notion page ID of the session row this registration belongs to. Optional
   * so legacy/backfill callers can omit it; when present it makes the
   * registration↔session link exact instead of title-text matching. */
  sessionRowId?: string;
  /** Exact venue (private — admin/roster only). */
  location: string;
  /** Broad area for hidden-location sessions ("Olney, MD"). Empty if not hidden. */
  publicArea: string;
  /** True when the exact venue is withheld until the 24h reveal cron. */
  locationHidden: boolean;
  level: "Red" | "Orange" | "Green" | "Yellow" | null;
  amountPaidUsd: number;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  displayConsent: boolean;
  smsConsent: boolean;
  /** Verbatim disclosure shown at opt-in. Empty if smsConsent === false. */
  smsConsentText: string;
  /**
   * Human attribution label from the shared attributedSource() vocab
   * ("Website", "Facebook Ad", "Ad: nextdoor", ...). Optional so non-funnel
   * callers (crew auto-reserve, backfill) can omit it — no Source is written.
   * Notion auto-creates select options on first write.
   */
  source?: string;
}

/**
 * Outcome of a drop-in row create, so the caller can react correctly:
 *   "ok"        — row landed (or env unset → graceful skip).
 *   "transient" — Notion returned 429/5xx; a retry might succeed. The Stripe
 *                 webhook returns 500 on this so Stripe redelivers.
 *   "permanent" — Notion returned a deterministic 4xx (bad field, etc.); a
 *                 retry will fail identically forever. The webhook must NOT
 *                 500 on this (it would retry a doomed write for ~3 days and
 *                 inflate the endpoint's error rate) — it alerts + 200s instead.
 */
export type CreateDropInResult = "ok" | "transient" | "permanent";

// Map a failed Notion HTTP status to a retry policy. 429 (rate limit) and 5xx
// (server error) are worth retrying; every other 4xx is deterministic — the
// same request will fail identically, so retrying only wastes attempts.
export function classifyNotionFailure(status: number): "transient" | "permanent" {
  return status === 429 || status >= 500 ? "transient" : "permanent";
}

// Detailed variant. Callers that treat the row as the source of truth (the
// Stripe webhook) use the classification to decide whether to fail-and-retry
// (transient) or alert-and-ack (permanent).
export async function createDropInRegistrationResult(
  row: DropInRow,
): Promise<CreateDropInResult> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_DROPINS_DB_ID;
  if (!notionKey || !dbId) {
    console.warn("[notion-dropins] missing NOTION_API_KEY or NOTION_DROPINS_DB_ID");
    return "ok";
  }

  const title = `${row.childFirstName} — ${row.sessionTitle || row.sessionDate}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Registration: { title: [{ text: { content: title } }] },
    "Parent Name": { rich_text: [{ text: { content: row.parentName } }] },
    // Notion's email property rejects an empty string ("is expected to be
    // email") — send null to clear it. Phone is lenient but kept symmetric.
    "Parent Email": { email: row.parentEmail || null },
    "Parent Phone": { phone_number: row.parentPhone || null },
    "Child First Name": {
      rich_text: [{ text: { content: row.childFirstName } }],
    },
    "Child Birth Year": { number: row.childBirthYear },
    "Session Title": {
      rich_text: [{ text: { content: row.sessionTitle } }],
    },
    "Session Start Time": {
      rich_text: [{ text: { content: row.sessionStartTime } }],
    },
    Location: { rich_text: [{ text: { content: row.location } }] },
    "Public Area": {
      rich_text: row.publicArea ? [{ text: { content: row.publicArea } }] : [],
    },
    "Location Hidden": { checkbox: row.locationHidden },
    "Amount Paid": { number: row.amountPaidUsd },
    "Stripe Checkout Session ID": {
      rich_text: [{ text: { content: row.stripeCheckoutSessionId } }],
    },
    Status: { select: { name: "Confirmed" } },
    "Display Consent": { checkbox: row.displayConsent },
    "SMS Consent": { checkbox: row.smsConsent },
    "SMS Consent Text": {
      rich_text: row.smsConsentText
        ? [{ text: { content: row.smsConsentText } }]
        : [],
    },
  };
  if (row.sessionDate) {
    properties["Session Date"] = { date: { start: row.sessionDate } };
  }
  if (row.level) {
    properties.Level = { select: { name: row.level } };
  }
  if (row.stripePaymentIntentId) {
    properties["Stripe Payment Intent ID"] = {
      rich_text: [{ text: { content: row.stripePaymentIntentId } }],
    };
  }
  if (row.source) {
    properties.Source = { select: { name: row.source } };
  }
  if (row.sessionRowId) {
    properties["Session Row ID"] = {
      rich_text: [{ text: { content: row.sessionRowId } }],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postPage = (props: Record<string, any>) =>
    fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({ parent: { database_id: dbId }, properties: props }),
    });

  let res = await postPage(properties);

  // Fail-soft on the optional `Source` attribution column. A deterministic
  // rejection that names Source — e.g. the column doesn't exist (the 2026-06-13
  // Landon incident: #174 shipped a Source write before the Notion property was
  // created, so every drop-in 400'd and stranded paid parents unregistered) —
  // must not block the core roster row, which is the source of truth for
  // reminders, check-in, and cancel refunds. Drop Source and retry once:
  // attribution is best-effort, the registration is not.
  if (
    !res.ok &&
    "Source" in properties &&
    classifyNotionFailure(res.status) === "permanent"
  ) {
    const bodyText = await res.text().catch(() => "");
    if (bodyText.includes("Source")) {
      console.error(
        "[notion-dropins] create rejected on Source — retrying without attribution so the row still lands",
        res.status,
        bodyText,
      );
      const withoutSource = { ...properties };
      delete withoutSource.Source;
      res = await postPage(withoutSource);
    } else {
      console.error("[notion-dropins] create failed", res.status, bodyText);
      return classifyNotionFailure(res.status);
    }
  }

  if (!res.ok) {
    console.error(
      "[notion-dropins] create failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return classifyNotionFailure(res.status);
  }
  return "ok";
}

// Boolean wrapper preserving the original contract (true = landed/skipped).
// Used by the crew auto-reserve cron, whose retry/refund loop only needs the
// pass/fail signal.
export async function createDropInRegistration(row: DropInRow): Promise<boolean> {
  return (await createDropInRegistrationResult(row)) === "ok";
}

export interface DropInRegistration {
  id: string;
  url: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number;
  sessionTitle: string;
  sessionDate: string;
  sessionStartTime: string;
  /** Empty on rows written before 2026-06-12 (pre Session Row ID stamping). */
  sessionRowId: string;
  location: string;
  publicArea: string;
  locationHidden: boolean;
  amountPaidUsd: number;
  status: string;
  paidAt: string;
  displayConsent: boolean;
  smsConsent: boolean;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string;
  reminderSent: boolean;
  postSessionSent: boolean;
  cancellationNotified: boolean;
  rescheduleNotified: boolean;
  locationRevealed: boolean;
  /** "Present" | "No-show" | "" (not yet recorded). */
  attendance: AttendanceValue | "";
}

export type AttendanceValue = "Present" | "No-show";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readTextProp(prop: any): string {
  if (!prop) return "";
  const arr = prop.rich_text ?? prop.title ?? [];
  if (!Array.isArray(arr)) return "";
  return arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readNumberProp(prop: any): number {
  return typeof prop?.number === "number" ? prop.number : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readSelectProp(prop: any): string {
  return prop?.select?.name ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToDropIn(page: any): DropInRegistration {
  const props = page.properties ?? {};
  return {
    id: page.id,
    url: page.url ?? `https://www.notion.so/${String(page.id).replace(/-/g, "")}`,
    parentName: readTextProp(props["Parent Name"]),
    parentEmail: props["Parent Email"]?.email ?? "",
    parentPhone: props["Parent Phone"]?.phone_number ?? "",
    childFirstName: readTextProp(props["Child First Name"]),
    childBirthYear: readNumberProp(props["Child Birth Year"]),
    sessionTitle: readTextProp(props["Session Title"]),
    sessionDate: props["Session Date"]?.date?.start ?? "",
    sessionStartTime: readTextProp(props["Session Start Time"]),
    sessionRowId: readTextProp(props["Session Row ID"]),
    location: readTextProp(props["Location"]),
    publicArea: readTextProp(props["Public Area"]),
    locationHidden: props["Location Hidden"]?.checkbox === true,
    amountPaidUsd: readNumberProp(props["Amount Paid"]),
    status: readSelectProp(props["Status"]),
    paidAt: props["Paid At"]?.created_time ?? page.created_time ?? "",
    displayConsent: props["Display Consent"]?.checkbox === true,
    smsConsent: props["SMS Consent"]?.checkbox === true,
    stripeCheckoutSessionId: readTextProp(props["Stripe Checkout Session ID"]),
    stripePaymentIntentId: readTextProp(props["Stripe Payment Intent ID"]),
    reminderSent: props["Reminder Sent"]?.checkbox === true,
    postSessionSent: props["Post Session Sent"]?.checkbox === true,
    cancellationNotified: props["Cancellation Notified"]?.checkbox === true,
    rescheduleNotified: props["Reschedule Notified"]?.checkbox === true,
    locationRevealed: props["Location Revealed"]?.checkbox === true,
    attendance: (readSelectProp(props["Attendance"]) as AttendanceValue | "") || "",
  };
}

/**
 * Fetch all Confirmed drop-in registrations whose Session Date is between
 * fromIso (inclusive) and toIso (inclusive). Sorted by date ascending.
 */
export async function fetchUpcomingDropIns(
  fromIso: string,
  toIso: string,
  options: { revalidate?: number } = {},
): Promise<DropInRegistration[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_DROPINS_DB_ID;
  if (!notionKey || !dbId) return [];

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: "Session Date", date: { on_or_after: fromIso } },
          { property: "Session Date", date: { on_or_before: toIso } },
          { property: "Status", select: { equals: "Confirmed" } },
        ],
      },
      sorts: [{ property: "Session Date", direction: "ascending" }],
      page_size: 100,
    }),
    ...(typeof options.revalidate === "number"
      ? { next: { revalidate: options.revalidate } }
      : { cache: "no-store" as const }),
  });
  if (!res.ok) {
    console.error(
      "[notion-dropins] fetchUpcomingDropIns failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  return data.results.map(pageToDropIn);
}

/**
 * Every drop-in row for one family, keyed on parent email and/or phone, across
 * all dates and all statuses. Powers the player/family profile. Sorted newest
 * session first.
 */
export async function fetchDropInsByParent(
  parentEmail: string,
  parentPhone: string,
): Promise<DropInRegistration[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_DROPINS_DB_ID;
  if (!notionKey || !dbId) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const or: any[] = [];
  if (parentEmail) or.push({ property: "Parent Email", email: { equals: parentEmail } });
  if (parentPhone) or.push({ property: "Parent Phone", phone_number: { equals: parentPhone } });
  if (or.length === 0) return [];

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: or.length === 1 ? or[0] : { or },
      sorts: [{ property: "Session Date", direction: "descending" }],
      page_size: 100,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      "[notion-dropins] fetchDropInsByParent failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  return data.results.map(pageToDropIn);
}

/**
 * All drop-in rows in a date window regardless of status. Powers the family
 * directory index (which needs Cancelled/Refunded rows too, unlike the
 * roster-facing fetchUpcomingDropIns).
 */
export async function fetchAllDropInsInRange(
  fromIso: string,
  toIso: string,
): Promise<DropInRegistration[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_DROPINS_DB_ID;
  if (!notionKey || !dbId) return [];

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: "Session Date", date: { on_or_after: fromIso } },
          { property: "Session Date", date: { on_or_before: toIso } },
        ],
      },
      sorts: [{ property: "Session Date", direction: "descending" }],
      page_size: 100,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      "[notion-dropins] fetchAllDropInsInRange failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  return data.results.map(pageToDropIn);
}

export async function findDropInByCheckoutId(
  checkoutSessionId: string,
): Promise<boolean> {
  const found = await findDropInPageByCheckoutId(checkoutSessionId);
  return found !== null;
}

export async function findDropInPageByCheckoutId(
  checkoutSessionId: string,
): Promise<DropInRegistration | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_DROPINS_DB_ID;
  if (!notionKey || !dbId) return null;

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
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
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  if (data.results.length === 0) return null;
  return pageToDropIn(data.results[0]);
}

export async function updateDropInStatus(
  pageId: string,
  status: "Confirmed" | "Cancelled" | "Refunded",
): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      properties: { Status: { select: { name: status } } },
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-dropins] updateDropInStatus failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}

/**
 * Flip a boolean idempotency flag on a drop-in row to true. Used by comms
 * crons + cancel-confirmation to prevent re-sending the same notification.
 *
 * Column names match the Notion schema exactly:
 *   "Reminder Sent"          — 24h-out reminder cron
 *   "Post Session Sent"      — post-session re-book cron
 *   "Cancellation Notified"  — cancel-confirmation send (any cancel path)
 */
export type DropInFlag =
  | "Reminder Sent"
  | "Post Session Sent"
  | "Cancellation Notified"
  | "Reschedule Notified"
  | "Location Revealed";

export async function markDropInFlag(
  pageId: string,
  flag: DropInFlag,
): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      properties: { [flag]: { checkbox: true } },
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-dropins] markDropInFlag failed",
      flag,
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}

/**
 * Reschedule a drop-in row onto a new session date/time. Rewrites the
 * date-scoped join fields the crons + queries key on (Session Date, Session
 * Start Time) AND resets the date-scoped idempotency flags — `Reminder Sent`
 * and `Post Session Sent` were true for the OLD date, so the new date would
 * silently lose its 24h reminder + post-session recap if they weren't cleared.
 * `Reschedule Notified` is cleared too so the notify pass can fire for the new
 * move. Touches NO child-PII field. Session Row ID is the durable attachment
 * key and is intentionally left unchanged.
 */
export async function updateDropInSchedule(
  pageId: string,
  fields: { sessionDate: string; sessionStartTime: string },
): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.sessionDate)) {
    console.error("[notion-dropins] updateDropInSchedule bad date", fields.sessionDate);
    return false;
  }

  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      properties: {
        "Session Date": { date: { start: fields.sessionDate } },
        "Session Start Time": {
          rich_text: [{ text: { content: fields.sessionStartTime } }],
        },
        "Reminder Sent": { checkbox: false },
        "Post Session Sent": { checkbox: false },
        "Reschedule Notified": { checkbox: false },
      },
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-dropins] updateDropInSchedule failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}

/**
 * Record day-of attendance on a drop-in row. Passing null clears it back to
 * "not yet recorded" (lets a coach undo a mis-tap). The select option names
 * must match the Notion schema exactly ("Present" / "No-show").
 */
export async function setDropInAttendance(
  pageId: string,
  value: AttendanceValue | null,
): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      properties: { Attendance: { select: value ? { name: value } : null } },
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-dropins] setDropInAttendance failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}
