import type { FallDay, FallYouthLevel } from "@/data/fall-2026";

/**
 * Read-only helper for the NGA Fall Interest Notion DB
 * (NOTION_FALL_INTEREST_DB_ID), the response store behind the retired /fall
 * season survey. The survey's route (/api/fall-interest) now answers 410 and
 * this module has no writer: the old upsert-by-email let anyone who knew a
 * family's address overwrite that family's child fields. Re-opening a survey
 * needs a new, verified write path, not the old one restored.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

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
