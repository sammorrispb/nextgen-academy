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
