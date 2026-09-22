import { classifyNotionFailure, type CreateDropInResult } from "./notion-dropins";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// NGA MVF Junior Tournament Registrations Notion DB — the tournament's roster.
// Deliberately its OWN database + module (same posture as Monday Girls):
// capacity is counted per division on THIS db, so sharing a roster would
// cross-count tournament seats against league/drop-in seats.
//
// Schema mirrors the Monday Girls regs DB (Parent Name / Email / Phone, Child
// First Name, Emergency Name / Phone, Allergies, SMS Consent, Amount Paid,
// Status, Stripe ids) plus: Child Last Name, Child DOB (date), Division
// select (10U / 14U), Resident checkbox, and a Paid checkbox.
//
// The DB is written at invoice time with Paid=false; the Stripe webhook flips
// Paid=true on invoice.payment_succeeded. The per-division cap counts Paid
// rows, so split accounting and capacity both run off paid rows.
//
// Env: NOTION_MVF_TOURNAMENT_REGS_DB_ID. Until it is set every helper
// fail-softs, so the page can ship before the DB exists. A new DB is also
// invisible to the site's Notion integration until it is shared with the
// "Player DB" integration — nothing in code can detect that omission.

export type MvfTournamentDivisionSlug = "10u" | "14u";

const DIVISION_LABEL: Record<MvfTournamentDivisionSlug, string> = {
  "10u": "10U",
  "14u": "14U",
};

export interface MvfTournamentRegistrationRow {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childLastName: string;
  /** ISO date "YYYY-MM-DD". */
  childDob: string;
  division: MvfTournamentDivisionSlug;
  /** Self-attested Montgomery Village residency. */
  resident: boolean;
  amountUsd: number;
  stripeInvoiceId: string;
  smsConsent: boolean;
  smsConsentText: string;
  emergencyName: string;
  emergencyPhone: string;
  allergies: string;
}

function notionEnv(): { notionKey: string; dbId: string } | null {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID;
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

/**
 * Write the roster row when the invoice goes out. Paid=false until the
 * webhook flips it — an unpaid invoice never occupies one of the 12 seats.
 */
export async function createMvfTournamentRegistration(
  row: MvfTournamentRegistrationRow,
): Promise<CreateDropInResult> {
  const env = notionEnv();
  if (!env) {
    console.warn(
      "[notion-mvf-tournament-registrations] missing NOTION_API_KEY or NOTION_MVF_TOURNAMENT_REGS_DB_ID",
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
        "Child Last Name": {
          rich_text: [{ text: { content: row.childLastName } }],
        },
        "Child DOB": { date: { start: row.childDob } },
        Division: { select: { name: DIVISION_LABEL[row.division] } },
        Resident: { checkbox: row.resident },
        Status: { select: { name: "Pending" } },
        Paid: { checkbox: false },
        "Amount Paid": { number: row.amountUsd },
        "Stripe Invoice ID": {
          rich_text: [{ text: { content: row.stripeInvoiceId } }],
        },
        "SMS Consent": { checkbox: row.smsConsent },
        "SMS Consent Text": {
          rich_text: [{ text: { content: row.smsConsentText.slice(0, 1900) } }],
        },
        "Emergency Name": {
          rich_text: [{ text: { content: row.emergencyName } }],
        },
        "Emergency Phone": { phone_number: row.emergencyPhone || null },
        Allergies: {
          rich_text: [{ text: { content: row.allergies.slice(0, 1900) } }],
        },
      },
    }),
  });

  if (!res.ok) {
    console.error(
      `[notion-mvf-tournament-registrations] create failed ${res.status}: ${await res.text()}`,
    );
    return classifyNotionFailure(res.status);
  }
  return "ok";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findRegByInvoiceId(notionKey: string, dbId: string, invoiceId: string): Promise<any | null> {
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: headers(notionKey),
    body: JSON.stringify({
      filter: {
        property: "Stripe Invoice ID",
        rich_text: { equals: invoiceId },
      },
      page_size: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  return data.results[0] ?? null;
}

export type MarkPaidResult =
  | "ok"
  | "already_paid"
  | "not_found"
  | "transient"
  | "permanent";

/**
 * Flip a roster row to Paid on invoice.payment_succeeded. Idempotent: a
 * redelivered event finds Paid already true and no-ops.
 */
export async function markMvfTournamentRegPaid(
  stripeInvoiceId: string,
  amountPaidUsd: number,
  stripePaymentIntentId: string | null,
): Promise<MarkPaidResult> {
  const env = notionEnv();
  if (!env) return "not_found";

  try {
    const page = await findRegByInvoiceId(env.notionKey, env.dbId, stripeInvoiceId);
    if (!page) return "not_found";
    const props = page.properties ?? {};
    if (props["Paid"]?.checkbox === true) return "already_paid";

    const res = await fetch(`${NOTION_API}/pages/${page.id}`, {
      method: "PATCH",
      headers: headers(env.notionKey),
      body: JSON.stringify({
        properties: {
          Paid: { checkbox: true },
          Status: { select: { name: "Confirmed" } },
          "Amount Paid": { number: amountPaidUsd },
          "Stripe Payment Intent ID": {
            rich_text: [{ text: { content: stripePaymentIntentId ?? "" } }],
          },
        },
      }),
    });
    if (!res.ok) {
      console.error(
        `[notion-mvf-tournament-registrations] mark-paid failed ${res.status}: ${await res.text()}`,
      );
      return classifyNotionFailure(res.status) as "transient" | "permanent";
    }
    return "ok";
  } catch (err) {
    console.error("[notion-mvf-tournament-registrations] mark-paid threw", err);
    return "transient";
  }
}

/**
 * Fetch tournament registrations, optionally filtered by paid status.
 * Returns each row's page id, created time, and the fields the reminder
 * crons need (parent contact, child name, division, invoice id).
 */
export interface MvfTournamentCronRow {
  pageId: string;
  createdAt: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childLastName: string;
  division: MvfTournamentDivisionSlug;
  resident: boolean;
  amountUsd: number;
  stripeInvoiceId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cronRowFromPage(page: any): MvfTournamentCronRow | null {
  const props = page.properties ?? {};
  const text = (p: string): string =>
    props[p]?.title?.[0]?.plain_text ??
    props[p]?.rich_text?.[0]?.plain_text ??
    "";
  const divisionLabel = props["Division"]?.select?.name ?? "10U";
  return {
    pageId: page.id,
    createdAt: page.created_time ?? "",
    parentName: text("Parent Name"),
    parentEmail: props["Parent Email"]?.email ?? "",
    parentPhone: props["Parent Phone"]?.phone_number ?? "",
    childFirstName: text("Child First Name"),
    childLastName: text("Child Last Name"),
    division: divisionLabel === "14U" ? "14u" : "10u",
    resident: props["Resident"]?.checkbox === true,
    amountUsd: props["Amount Paid"]?.number ?? 0,
    stripeInvoiceId: text("Stripe Invoice ID"),
  };
}

export async function fetchMvfTournamentRegistrations(
  paid: boolean,
): Promise<MvfTournamentCronRow[] | null> {
  const env = notionEnv();
  if (!env) return null;
  try {
    const rows: MvfTournamentCronRow[] = [];
    let cursor: string | undefined;
    for (;;) {
      const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
        method: "POST",
        headers: headers(env.notionKey),
        body: JSON.stringify({
          filter: { property: "Paid", checkbox: { equals: paid } },
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
        cache: "no-store",
      });
      if (!res.ok) {
        console.error(
          `[notion-mvf-tournament-registrations] fetch query failed ${res.status}`,
        );
        return null;
      }
      const data = (await res.json()) as {
        results: unknown[];
        has_more: boolean;
        next_cursor: string | null;
      };
      for (const page of data.results) {
        const row = cronRowFromPage(page);
        if (row) rows.push(row);
      }
      if (!data.has_more) break;
      cursor = data.next_cursor ?? undefined;
      if (!cursor) break;
    }
    return rows;
  } catch (err) {
    console.error("[notion-mvf-tournament-registrations] fetch query threw", err);
    return null;
  }
}

/**
 * Paid-seat count for one division — the number the /mvf-junior-tournament
 * cap is enforced against.
 *
 * Fail-OPEN (null) on any Notion problem — same posture as the Monday Girls
 * roster: an oversold seat is a refundable mistake, but a Notion blip
 * blocking every checkout is a launch-day outage. null = unknown; the route
 * only 409s on a known count at the cap.
 */
export async function countPaidMvfTournamentRegistrations(
  division: MvfTournamentDivisionSlug,
): Promise<number | null> {
  const env = notionEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
      method: "POST",
      headers: headers(env.notionKey),
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Division", select: { equals: DIVISION_LABEL[division] } },
            { property: "Paid", checkbox: { equals: true } },
          ],
        },
        page_size: 100,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        `[notion-mvf-tournament-registrations] count query failed ${res.status}`,
      );
      return null;
    }
    const data = (await res.json()) as { results: unknown[] };
    return data.results.length;
  } catch (err) {
    console.error("[notion-mvf-tournament-registrations] count query threw", err);
    return null;
  }
}
