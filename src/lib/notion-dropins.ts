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
  location: string;
  level: "Red" | "Orange" | "Green" | "Yellow" | null;
  amountPaidUsd: number;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  displayConsent: boolean;
  smsConsent: boolean;
  /** Verbatim disclosure shown at opt-in. Empty if smsConsent === false. */
  smsConsentText: string;
}

export async function createDropInRegistration(row: DropInRow): Promise<void> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_DROPINS_DB_ID;
  if (!notionKey || !dbId) {
    console.warn("[notion-dropins] missing NOTION_API_KEY or NOTION_DROPINS_DB_ID");
    return;
  }

  const title = `${row.childFirstName} — ${row.sessionTitle || row.sessionDate}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Registration: { title: [{ text: { content: title } }] },
    "Parent Name": { rich_text: [{ text: { content: row.parentName } }] },
    "Parent Email": { email: row.parentEmail },
    "Parent Phone": { phone_number: row.parentPhone },
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

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties,
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-dropins] create failed",
      res.status,
      await res.text().catch(() => ""),
    );
  }
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
  location: string;
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
    location: readTextProp(props["Location"]),
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
  | "Cancellation Notified";

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
