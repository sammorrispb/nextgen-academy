import type {
  FallAdultBracket,
  FallCommitment,
  FallDay,
  FallPriceBand,
  FallTrack,
  FallYouthLevel,
} from "@/data/fall-2026";

/**
 * Read/write helpers for the NGA Fall Interest Notion DB
 * (NOTION_FALL_INTEREST_DB_ID) — the response store behind the /fall season
 * feedback survey.
 *
 * Upsert keyed on lowercased email, mirroring upsertPollResponse: Sam's whole
 * reason for the survey is "who is actually available," so one respondent must
 * be one row. A second submission edits the first rather than splitting a
 * family across two rows with different answers.
 *
 * Child fields (first name, derived birth year, color group) are written ONLY
 * when the respondent picked the youth track — an adult answering about
 * themselves never produces a child field. Age is never stored; birth year is
 * derived at the route, per the minor-data governance rules.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface FallInterestRow {
  respondentName: string;
  email: string;
  phone: string;
  track: FallTrack[];
  childFirstName?: string;
  childBirthYear?: number;
  childLevel?: FallYouthLevel;
  adultBracket?: FallAdultBracket;
  days: FallDay[];
  commitment: FallCommitment;
  subListInterest: boolean;
  youthPriceBand?: FallPriceBand;
  adultPriceBand?: FallPriceBand;
  notes: string;
}

export async function findFallInterestByEmail(
  email: string,
): Promise<{ id: string } | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_FALL_INTEREST_DB_ID;
  if (!notionKey || !db) return null;

  const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: "Email", email: { equals: email } },
      page_size: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { results: { id: string }[] };
  if (!data.results?.length) return null;
  return { id: data.results[0].id };
}

export async function upsertFallInterest(
  row: FallInterestRow,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_FALL_INTEREST_DB_ID;
  if (!notionKey || !db) {
    return { ok: false, error: "NOTION_FALL_INTEREST_DB_ID not configured" };
  }

  const existing = await findFallInterestByEmail(row.email);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Name: { title: [{ text: { content: row.respondentName.slice(0, 200) } }] },
    Email: { email: row.email },
    Track: { multi_select: row.track.map((t) => ({ name: t })) },
    Days: { multi_select: row.days.map((d) => ({ name: d })) },
    Commitment: { select: { name: row.commitment } },
    "Sub List": { checkbox: row.subListInterest },
    Notes: { rich_text: row.notes ? [{ text: { content: row.notes } }] : [] },
  };

  if (row.phone) properties["Phone"] = { phone_number: row.phone };

  // Youth branch — only written when the youth track was picked.
  if (row.childFirstName) {
    properties["Child First Name"] = {
      rich_text: [{ text: { content: row.childFirstName } }],
    };
  }
  if (typeof row.childBirthYear === "number") {
    properties["Child Birth Year"] = { number: row.childBirthYear };
  }
  if (row.childLevel) {
    properties["Child Level"] = { select: { name: row.childLevel } };
  }
  if (row.youthPriceBand) {
    properties["Youth Price Band"] = { select: { name: row.youthPriceBand } };
  }

  // Adult branch.
  if (row.adultBracket) {
    properties["Adult Bracket"] = { select: { name: row.adultBracket } };
  }
  if (row.adultPriceBand) {
    properties["Adult Price Band"] = { select: { name: row.adultPriceBand } };
  }

  if (existing) {
    const res = await fetch(`${NOTION_API}/pages/${existing.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({ properties }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Notion update failed (${res.status}): ${text}`,
      };
    }
    return { ok: true, pageId: existing.id };
  }

  // Status only on create — a re-submission must not reset a row Sam has
  // already triaged out of "New".
  properties["Status"] = { select: { name: "New" } };

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({ parent: { database_id: db }, properties }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Notion create failed (${res.status}): ${text}` };
  }
  const data = await res.json();
  return { ok: true, pageId: data.id };
}

/**
 * A youth-track Fall Interest response, counts-only — the same narrow
 * projection rule as fetchCrewInterestDemand: no respondent name, no email,
 * no phone, no child first name. Notes are excluded too (free text is where a
 * parent volunteers a full name).
 *
 * `Days` on this DB is only "Sunday" / "Sunday doesn't work", so this feeds
 * the level + age histogram and a Sunday-fit tally — it must NOT be fanned
 * into the weekday grid as if it were a day-of-week preference.
 */
export interface FallInterestDemandRow {
  childLevel: FallYouthLevel | null;
  childBirthYear: number;
  days: FallDay[];
  subListInterest: boolean;
}

export interface FallInterestDemandResult {
  rows: FallInterestDemandRow[];
  /** false when the DB isn't configured or the query failed — NOT "zero demand". */
  ok: boolean;
  truncated: boolean;
}

const MAX_DEMAND_PAGES = 10;

export async function fetchFallInterestDemand(): Promise<FallInterestDemandResult> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_FALL_INTEREST_DB_ID;
  if (!notionKey || !db) return { rows: [], ok: false, truncated: false };

  const rows: FallInterestDemandRow[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_DEMAND_PAGES; page++) {
    const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        filter: { property: "Track", multi_select: { contains: "youth" } },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        "[notion-fall-interest] fetchDemand failed",
        res.status,
        await res.text().catch(() => ""),
      );
      return { rows, ok: false, truncated: false };
    }

    const data = (await res.json()) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: any[];
      has_more?: boolean;
      next_cursor?: string | null;
    };

    for (const notionPage of data.results) {
      const props = notionPage.properties ?? {};
      rows.push({
        childLevel: (props["Child Level"]?.select?.name ??
          null) as FallYouthLevel | null,
        childBirthYear:
          typeof props["Child Birth Year"]?.number === "number"
            ? props["Child Birth Year"].number
            : 0,
        days: (props["Days"]?.multi_select ?? []).map(
          (o: { name: string }) => o.name,
        ) as FallDay[],
        subListInterest: props["Sub List"]?.checkbox === true,
      });
    }

    if (!data.has_more || !data.next_cursor) {
      return { rows, ok: true, truncated: false };
    }
    cursor = data.next_cursor;
  }

  return { rows, ok: true, truncated: true };
}
