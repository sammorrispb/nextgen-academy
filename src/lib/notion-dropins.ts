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
}

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
  };
}

/**
 * Fetch all Confirmed drop-in registrations whose Session Date is between
 * fromIso (inclusive) and toIso (inclusive). Sorted by date ascending.
 */
export async function fetchUpcomingDropIns(
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
          { property: "Status", select: { equals: "Confirmed" } },
        ],
      },
      sorts: [{ property: "Session Date", direction: "ascending" }],
      page_size: 100,
    }),
    cache: "no-store",
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
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_DROPINS_DB_ID;
  if (!notionKey || !dbId) return false;

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
  if (!res.ok) return false;
  const data = (await res.json()) as { results: unknown[] };
  return data.results.length > 0;
}
