// Coach-assignable skill "bracket" = the Red/Orange/Green/Yellow Level that
// lives on the NGA Player CRM row (the persistent, coach-owned per-child record;
// see notion-player-sync.ts — "Site, Level, and Skill Rating are coach-owned").
// The drop-in registration rows carry a per-registration level, but the DURABLE
// assigned bracket is the Player CRM Level, which is what this module reads and
// writes. Minor-PII: writes touch ONLY the Level select on an existing row (never
// a child field), and only ever egress to Notion.

import { findPlayerRow } from "./notion-player-sync";
import { playerCrmDbId } from "./notion-utils";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// A full scan of the Player CRM would be unbounded; cap it so one heavy DB can't
// hang the coach directory. Truncation is logged (never silent) per the
// "no silent caps" rule — a bracket beyond the cap just shows as unassigned.
const MAX_PLAYER_PAGES = 12; // 12 × 100 = up to 1200 player rows

export const PLAYER_LEVELS = ["Red", "Orange", "Green", "Yellow"] as const;
export type PlayerLevel = (typeof PLAYER_LEVELS)[number];

export function isPlayerLevel(v: unknown): v is PlayerLevel {
  return typeof v === "string" && (PLAYER_LEVELS as readonly string[]).includes(v);
}

export interface PlayerLevelRow {
  parentEmail: string;
  parentPhone: string;
  /** Player CRM title = the child's first name. */
  playerName: string;
  level: PlayerLevel | "";
}

function notionHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readTitle(prop: any): string {
  const arr = prop?.title ?? [];
  return Array.isArray(arr)
    ? arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("")
    : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readLevel(prop: any): PlayerLevel | "" {
  const name = prop?.select?.name;
  return isPlayerLevel(name) ? name : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToLevelRow(page: any): PlayerLevelRow {
  const props = page?.properties ?? {};
  return {
    parentEmail: props["Parent Email"]?.email ?? "",
    parentPhone: props["Parent Phone"]?.phone_number ?? "",
    playerName: readTitle(props["Player Name"]),
    level: readLevel(props["Level"]),
  };
}

/**
 * Build the directory bracket index keyed on `${familyKey}::${childNameLower}`
 * → assigned Level. Pure so the join is unit-testable without Notion. The
 * caller supplies the same family-key encoder the directory uses so the keys
 * line up exactly.
 */
export function buildLevelIndex(
  rows: PlayerLevelRow[],
  encodeKey: (email: string, phone: string) => string,
): Map<string, PlayerLevel> {
  const index = new Map<string, PlayerLevel>();
  for (const r of rows) {
    if (!r.level) continue;
    const key = encodeKey(r.parentEmail, r.parentPhone);
    const child = r.playerName.trim().toLowerCase();
    if (!key || !child) continue;
    index.set(`${key}::${child}`, r.level);
  }
  return index;
}

/**
 * One family's assigned brackets, keyed on child first name (lowercased) →
 * { pageId, level }. Powers the per-child bracket control on the family profile.
 * A child with a drop-in row but no Player CRM row yet is simply absent from the
 * map (shows as unassigned until first assigned or synced).
 */
export async function fetchPlayerLevelsByParent(
  parentEmail: string,
  parentPhone: string,
): Promise<Map<string, { pageId: string; level: PlayerLevel | "" }>> {
  const out = new Map<string, { pageId: string; level: PlayerLevel | "" }>();
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return out;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const or: any[] = [];
  if (parentEmail) or.push({ property: "Parent Email", email: { equals: parentEmail } });
  if (parentPhone) or.push({ property: "Parent Phone", phone_number: { equals: parentPhone } });
  if (or.length === 0) return out;

  const res = await fetch(`${NOTION_API}/databases/${playerCrmDbId()}/query`, {
    method: "POST",
    headers: notionHeaders(notionKey),
    body: JSON.stringify({
      filter: or.length === 1 ? or[0] : { or },
      page_size: 100,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      "[notion-player-bracket] fetchPlayerLevelsByParent failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return out;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  for (const page of data.results) {
    const row = pageToLevelRow(page);
    const child = row.playerName.trim().toLowerCase();
    if (!child) continue;
    // First writer wins if a family somehow has two rows for the same name.
    if (!out.has(child)) out.set(child, { pageId: page.id, level: row.level });
  }
  return out;
}

/**
 * Every Player CRM row's (parent contact + child name + Level), paged up to the
 * cap. Powers the directory bracket filter. Fail-soft: any Notion error returns
 * what was gathered so far so the directory still renders (brackets just show as
 * unassigned).
 */
export async function fetchAllPlayerLevels(): Promise<PlayerLevelRow[]> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return [];

  const rows: PlayerLevelRow[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PLAYER_PAGES; page++) {
    const res = await fetch(`${NOTION_API}/databases/${playerCrmDbId()}/query`, {
      method: "POST",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        "[notion-player-bracket] fetchAllPlayerLevels failed",
        res.status,
        await res.text().catch(() => ""),
      );
      break;
    }
    const data = (await res.json()) as {
      results: unknown[];
      has_more?: boolean;
      next_cursor?: string | null;
    };
    for (const p of data.results) rows.push(pageToLevelRow(p));
    if (!data.has_more || !data.next_cursor) return rows;
    cursor = data.next_cursor;
  }
  console.warn(
    `[notion-player-bracket] fetchAllPlayerLevels hit the ${MAX_PLAYER_PAGES}-page cap — some brackets may show unassigned in the directory`,
  );
  return rows;
}

export interface SetLevelResult {
  ok: boolean;
  message: string;
  level?: PlayerLevel | "";
}

/**
 * Assign (or clear) a child's bracket on their Player CRM row. Finds the child's
 * row by parent contact + first name (via the shared findPlayerRow), then PATCHes
 * ONLY the Level select — nothing else on the row is touched, so coach-owned Site
 * / Skill Rating / Notes are never clobbered. Passing null clears the bracket.
 * If no player row exists yet, a minimal one is created so a brand-new
 * registrant can still be bracketed. Auth is the CALLER's responsibility.
 */
export async function setPlayerLevel(input: {
  parentEmail: string | null;
  parentPhone: string;
  childFirstName: string;
  parentName?: string;
  level: PlayerLevel | null;
}): Promise<SetLevelResult> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { ok: false, message: "Notion not configured" };

  if (input.level !== null && !isPlayerLevel(input.level)) {
    return { ok: false, message: "Invalid bracket" };
  }

  const email = input.parentEmail?.trim() || null;
  const phone = input.parentPhone?.trim() || "";
  const child = input.childFirstName?.trim() || "";
  if ((!email && !phone) || !child) {
    return { ok: false, message: "Missing player identity" };
  }

  const levelProp = input.level ? { select: { name: input.level } } : { select: null };

  try {
    const existingId = await findPlayerRow(notionKey, email, phone, child);

    if (existingId) {
      const res = await fetch(`${NOTION_API}/pages/${existingId}`, {
        method: "PATCH",
        headers: notionHeaders(notionKey),
        body: JSON.stringify({ properties: { Level: levelProp } }),
      });
      if (!res.ok) {
        console.error(
          "[notion-player-bracket] setPlayerLevel patch failed",
          res.status,
          await res.text().catch(() => ""),
        );
        return { ok: false, message: "Failed to update bracket" };
      }
      return { ok: true, message: "Bracket saved", level: input.level ?? "" };
    }

    // No player row yet — create a minimal one so the bracket sticks. Mirrors
    // the shape syncPlayerFromDropIn creates, minus the transactional fields.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      "Player Name": { title: [{ text: { content: child } }] },
      Status: { select: { name: "Active" } },
      Source: { select: { name: "Website" } },
      Audience: { select: { name: "Youth" } },
      Level: levelProp,
    };
    if (input.parentName?.trim()) {
      properties["Parent Name"] = { rich_text: [{ text: { content: input.parentName.trim() } }] };
    }
    if (email) properties["Parent Email"] = { email };
    if (phone) properties["Parent Phone"] = { phone_number: phone };

    const res = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({ parent: { database_id: playerCrmDbId() }, properties }),
    });
    if (!res.ok) {
      console.error(
        "[notion-player-bracket] setPlayerLevel create failed",
        res.status,
        await res.text().catch(() => ""),
      );
      return { ok: false, message: "Failed to save bracket" };
    }
    return { ok: true, message: "Bracket saved", level: input.level ?? "" };
  } catch (err) {
    console.error("[notion-player-bracket] setPlayerLevel error", err);
    return { ok: false, message: "Failed to save bracket" };
  }
}
