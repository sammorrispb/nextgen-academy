// The roster a rotation-league season sends to Link & Dink, read from the
// season's NGA registration DB.
//
// A separate reader from fetchFallRosterForLeague on purpose: that one is
// pinned to id + first name + group + status for the Notion season play, and
// this one also needs the last name. Like the admin rosters it fails LOUD
// (ok | config_missing | query_failed): an empty sync that really means
// "Notion is unreachable" would mark nobody withdrawn but also add nobody, and
// the coach must see that rather than an empty check-in list.
//
// The projection is the whole contract: page id, first name, last name, status.
// Birth year, allergies, emergency contact, parent fields and SMS consent are
// never read off the row. Pinned by e2e/invariant-rotation-league-egress.spec.ts.

import { CHILD_LAST_NAME_RE, cleanChildLastName } from "@/lib/child-last-name";
import type { RotationLeagueSeason } from "@/data/rotation-league-seasons";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const MAX_PAGES = 10;

/** Link & Dink's roster name rule (community-os rotation-league command.ts NAME),
 * the same one checkout enforces. Applied to the trimmed value as typed, never
 * to a "cleaned" one: cleaning turns an email into words that pass. */
const LD_NAME = CHILD_LAST_NAME_RE;
/** Link & Dink's registration-ref rule (command.ts REF). A Notion page id fits. */
const LD_REF = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;

export interface RegistrationRow {
  pageId: string;
  firstName: string;
  lastName: string;
  status: string;
}

export type RegistrationRead =
  | { status: "ok"; rows: RegistrationRow[] }
  | { status: "config_missing" | "query_failed"; rows: [] };

export interface RosterPlayer {
  external_ref: string;
  first_name: string;
  last_name: string | null;
  status: "active" | "withdrawn";
}

function dbIdFor(season: RotationLeagueSeason): string | undefined {
  switch (season.rosterSource) {
    case "fall":
      return process.env.NOTION_FALL_REGS_DB_ID;
  }
}

function text(prop: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = (prop as any)?.rich_text;
  if (!Array.isArray(parts)) return "";
  return parts.map((p: { plain_text?: unknown }) => (typeof p?.plain_text === "string" ? p.plain_text : "")).join("");
}

export async function readSeasonRegistrations(season: RotationLeagueSeason): Promise<RegistrationRead> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = dbIdFor(season);
  if (!notionKey || !dbId) return { status: "config_missing", rows: [] };

  const rows: RegistrationRow[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionKey}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION,
        },
        body: JSON.stringify({
          filter: { property: "Group", select: { equals: season.rosterGroup } },
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
        cache: "no-store",
      });
      if (!res.ok) {
        console.error(`[rotation-league-roster] query failed ${res.status}`);
        return { status: "query_failed", rows: [] };
      }
      const data = (await res.json()) as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results?: any[];
        has_more?: boolean;
        next_cursor?: string | null;
      };
      for (const row of data.results ?? []) {
        const p = row?.properties ?? {};
        const pageId = typeof row?.id === "string" ? row.id : "";
        if (!pageId) continue;
        rows.push({
          pageId,
          firstName: text(p["Child First Name"]),
          lastName: text(p["Child Last Name"]),
          status: typeof p["Status"]?.select?.name === "string" ? p["Status"].select.name : "",
        });
      }
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }
  } catch (err) {
    console.error("[rotation-league-roster] query threw", err instanceof Error ? err.name : "error");
    return { status: "query_failed", rows: [] };
  }
  return { status: "ok", rows };
}

/**
 * The roster_upsert players for these rows. Confirmed is active; any other
 * status (Refunded, Cancelled, Maybe, blank) is withdrawn, so a refunded kid's
 * played games still count for the kids who played them. A first name that is
 * not a name skips the row (and is counted, never named); a last
 * name that is not one is sent as none.
 */
export function buildRosterPlayers(rows: readonly RegistrationRow[]): {
  players: RosterPlayer[];
  skipped: number;
} {
  const players: RosterPlayer[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const first = cleanChildLastName(row.firstName);
    const last = cleanChildLastName(row.lastName);
    if (!LD_REF.test(row.pageId) || seen.has(row.pageId) || !LD_NAME.test(first)) {
      skipped += 1;
      continue;
    }
    seen.add(row.pageId);
    players.push({
      external_ref: row.pageId,
      first_name: first,
      last_name: LD_NAME.test(last) ? last : null,
      status: row.status === "Confirmed" ? "active" : "withdrawn",
    });
  }
  return { players, skipped };
}
