import { NOTION_API, NOTION_VERSION, readPlainText } from "@/lib/notion-utils";
import {
  SEASON_LEAGUE_KEY_PREFIX,
  type SeasonLeagueGroup,
} from "@/data/season-league-2026";
import type { GameFormat, PlayerId } from "@/lib/season-league/types";

/**
 * Store for the NGA Season League Games Notion DB (`NOTION_SEASON_LEAGUE_DB_ID`)
 * — one DB for both leagues, one row per game, day, team or playoff game,
 * discriminated by `Phase`.
 *
 * Design rules (see CLAUDE.md "Fall season play"):
 *   - The DB holds NO names. Kids are `relation` links to their Fall
 *     Registrations row; the site joins first names at render. So this is not
 *     a new child-PII destination — pinned by invariant-season-league-egress.
 *   - The title is an idempotency KEY (`G-W2-R1-C1`, `Y-W6-DAY`, `Y-W6-T1`,
 *     `Y-W6-gf`). Every write is find-or-create on it, so a double tap, a
 *     second tab or a retry after a 429 cannot double-create a game.
 *   - A Played row is never overwritten by a save or a regenerate — only
 *     Scheduled rows are re-planned or voided. Scores are corrected through
 *     recordScore alone.
 *   - Reads ship dark: env unset → config_missing with zero calls; a failed
 *     query → query_failed, never a throw. A Sunday page must render.
 */

export type SeasonLeaguePhase = "League" | "Day" | "Team" | "Playoff";
export type SeasonLeagueRowStatus = "Scheduled" | "Played" | "Void";

/** Every property name in one place — the schema probe compares against it. */
export const SEASON_LEAGUE_PROPS = {
  key: "Game",
  league: "League",
  week: "Week",
  sessionDate: "Session Date",
  phase: "Phase",
  format: "Format",
  round: "Round",
  court: "Court",
  seed: "Seed",
  attempt: "Attempt",
  rounds: "Rounds",
  slot: "Slot",
  sideA: "Side A",
  sideB: "Side B",
  present: "Present",
  scoreA: "Score A",
  scoreB: "Score B",
  status: "Status",
  timed: "Timed",
} as const;

export const SEASON_LEAGUE_SCHEMA: Readonly<Record<string, string>> = {
  [SEASON_LEAGUE_PROPS.key]: "title",
  [SEASON_LEAGUE_PROPS.league]: "select",
  [SEASON_LEAGUE_PROPS.week]: "number",
  [SEASON_LEAGUE_PROPS.sessionDate]: "date",
  [SEASON_LEAGUE_PROPS.phase]: "select",
  [SEASON_LEAGUE_PROPS.format]: "select",
  [SEASON_LEAGUE_PROPS.round]: "number",
  [SEASON_LEAGUE_PROPS.court]: "number",
  [SEASON_LEAGUE_PROPS.seed]: "number",
  [SEASON_LEAGUE_PROPS.attempt]: "number",
  [SEASON_LEAGUE_PROPS.rounds]: "number",
  [SEASON_LEAGUE_PROPS.slot]: "rich_text",
  [SEASON_LEAGUE_PROPS.sideA]: "relation",
  [SEASON_LEAGUE_PROPS.sideB]: "relation",
  [SEASON_LEAGUE_PROPS.present]: "relation",
  [SEASON_LEAGUE_PROPS.scoreA]: "number",
  [SEASON_LEAGUE_PROPS.scoreB]: "number",
  [SEASON_LEAGUE_PROPS.status]: "select",
  [SEASON_LEAGUE_PROPS.timed]: "checkbox",
};

export interface SeasonLeagueRow {
  pageId: string;
  key: string;
  league: string;
  week: number;
  sessionDate: string;
  phase: SeasonLeaguePhase | "";
  format: GameFormat | "";
  round: number;
  court: number;
  seed: number;
  attempt: number;
  rounds: number;
  slot: string;
  sideA: PlayerId[];
  sideB: PlayerId[];
  present: PlayerId[];
  scoreA: number | null;
  scoreB: number | null;
  status: SeasonLeagueRowStatus | "";
  timed: boolean;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

function prefix(group: SeasonLeagueGroup): string {
  return SEASON_LEAGUE_KEY_PREFIX[group];
}

export function gameKey(group: SeasonLeagueGroup, week: number, round: number, court: number): string {
  return `${prefix(group)}-W${week}-R${round}-C${court}`;
}

export function dayKey(group: SeasonLeagueGroup, week: number): string {
  return `${prefix(group)}-W${week}-DAY`;
}

export function teamKey(group: SeasonLeagueGroup, week: number, seed: number): string {
  return `${prefix(group)}-W${week}-T${seed}`;
}

export function playoffKey(group: SeasonLeagueGroup, week: number, slot: string): string {
  return `${prefix(group)}-W${week}-${slot}`;
}

// ---------------------------------------------------------------------------
// Pure builders + parser (exported for the notion spec)
// ---------------------------------------------------------------------------

type Props = Record<string, unknown>;

const title = (text: string) => ({ title: [{ text: { content: text.slice(0, 1900) } }] });
const richText = (text: string) => ({ rich_text: [{ text: { content: text.slice(0, 1900) } }] });
const select = (name: string) => ({ select: { name } });
const number = (n: number | null) => ({ number: n });
const date = (iso: string) => ({ date: iso ? { start: iso.slice(0, 10) } : null });
const relation = (ids: readonly PlayerId[]) => ({ relation: ids.map((id) => ({ id })) });
const checkbox = (on: boolean) => ({ checkbox: on });

export interface GameRowInput {
  group: SeasonLeagueGroup;
  week: number;
  sessionDate: string;
  round: number;
  court: number;
  format: GameFormat;
  sideA: PlayerId[];
  sideB: PlayerId[];
}

export function buildGameRowProps(input: GameRowInput): Props {
  const P = SEASON_LEAGUE_PROPS;
  return {
    [P.key]: title(gameKey(input.group, input.week, input.round, input.court)),
    [P.league]: select(input.group),
    [P.week]: number(input.week),
    [P.sessionDate]: date(input.sessionDate),
    [P.phase]: select("League"),
    [P.format]: select(input.format === "singles" ? "Singles" : "Doubles"),
    [P.round]: number(input.round),
    [P.court]: number(input.court),
    [P.sideA]: relation(input.sideA),
    [P.sideB]: relation(input.sideB),
    [P.scoreA]: number(null),
    [P.scoreB]: number(null),
    [P.status]: select("Scheduled"),
    [P.timed]: checkbox(false),
  };
}

export interface DayRowInput {
  group: SeasonLeagueGroup;
  week: number;
  sessionDate: string;
  present: PlayerId[];
  attempt: number;
  rounds: number;
}

export function buildDayRowProps(input: DayRowInput): Props {
  const P = SEASON_LEAGUE_PROPS;
  return {
    [P.key]: title(dayKey(input.group, input.week)),
    [P.league]: select(input.group),
    [P.week]: number(input.week),
    [P.sessionDate]: date(input.sessionDate),
    [P.phase]: select("Day"),
    [P.present]: relation(input.present),
    [P.attempt]: number(input.attempt),
    [P.rounds]: number(input.rounds),
    [P.status]: select("Scheduled"),
  };
}

export interface TeamRowInput {
  group: SeasonLeagueGroup;
  week: number;
  sessionDate: string;
  seed: number;
  members: PlayerId[];
}

export function buildTeamRowProps(input: TeamRowInput): Props {
  const P = SEASON_LEAGUE_PROPS;
  return {
    [P.key]: title(teamKey(input.group, input.week, input.seed)),
    [P.league]: select(input.group),
    [P.week]: number(input.week),
    [P.sessionDate]: date(input.sessionDate),
    [P.phase]: select("Team"),
    [P.seed]: number(input.seed),
    [P.sideA]: relation(input.members),
    [P.status]: select("Scheduled"),
  };
}

export interface PlayoffRowInput {
  group: SeasonLeagueGroup;
  week: number;
  sessionDate: string;
  slot: string;
  sideA: PlayerId[];
  sideB: PlayerId[];
  scoreA: number;
  scoreB: number;
  timed: boolean;
}

export function buildPlayoffRowProps(input: PlayoffRowInput): Props {
  const P = SEASON_LEAGUE_PROPS;
  return {
    [P.key]: title(playoffKey(input.group, input.week, input.slot)),
    [P.league]: select(input.group),
    [P.week]: number(input.week),
    [P.sessionDate]: date(input.sessionDate),
    [P.phase]: select("Playoff"),
    [P.format]: select("Doubles"),
    [P.slot]: richText(input.slot),
    [P.sideA]: relation(input.sideA),
    [P.sideB]: relation(input.sideB),
    [P.scoreA]: number(input.scoreA),
    [P.scoreB]: number(input.scoreB),
    [P.status]: select("Played"),
    [P.timed]: checkbox(input.timed),
  };
}

export function buildScoreProps(scoreA: number, scoreB: number, timed: boolean): Props {
  const P = SEASON_LEAGUE_PROPS;
  return {
    [P.scoreA]: number(scoreA),
    [P.scoreB]: number(scoreB),
    [P.status]: select("Played"),
    [P.timed]: checkbox(timed),
  };
}

export function buildVoidProps(): Props {
  return { [SEASON_LEAGUE_PROPS.status]: select("Void") };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readRelation(prop: any): PlayerId[] {
  const arr = prop?.relation;
  if (!Array.isArray(arr)) return [];
  return arr.map((r: { id?: string }) => String(r?.id ?? "")).filter(Boolean);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readNumber(prop: any): number {
  return typeof prop?.number === "number" ? prop.number : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readNullableNumber(prop: any): number | null {
  return typeof prop?.number === "number" ? prop.number : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSeasonLeagueRow(page: any): SeasonLeagueRow {
  const P = SEASON_LEAGUE_PROPS;
  const p = page?.properties ?? {};
  const phase = p[P.phase]?.select?.name ?? "";
  const formatRaw = (p[P.format]?.select?.name ?? "").toLowerCase();
  const status = p[P.status]?.select?.name ?? "";
  return {
    pageId: String(page?.id ?? ""),
    key: readPlainText(p[P.key]),
    league: p[P.league]?.select?.name ?? "",
    week: readNumber(p[P.week]),
    sessionDate: p[P.sessionDate]?.date?.start?.slice(0, 10) ?? "",
    phase: phase === "League" || phase === "Day" || phase === "Team" || phase === "Playoff" ? phase : "",
    format: formatRaw === "singles" ? "singles" : formatRaw === "doubles" ? "doubles" : "",
    round: readNumber(p[P.round]),
    court: readNumber(p[P.court]),
    seed: readNumber(p[P.seed]),
    attempt: readNumber(p[P.attempt]),
    rounds: readNumber(p[P.rounds]),
    slot: readPlainText(p[P.slot]),
    sideA: readRelation(p[P.sideA]),
    sideB: readRelation(p[P.sideB]),
    present: readRelation(p[P.present]),
    scoreA: readNullableNumber(p[P.scoreA]),
    scoreB: readNullableNumber(p[P.scoreB]),
    status: status === "Scheduled" || status === "Played" || status === "Void" ? status : "",
    timed: p[P.timed]?.checkbox === true,
  };
}

// ---------------------------------------------------------------------------
// Env + HTTP
// ---------------------------------------------------------------------------

function notionEnv(): { notionKey: string; dbId: string } | null {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_SEASON_LEAGUE_DB_ID;
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

const MAX_PAGES = 10;
/** Notion rate-limits at ~3 req/s; a Sunday save is a burst of 4–9 creates. */
const WRITE_THROTTLE_MS = 350;
const RETRY_BACKOFF_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One write with ONE 429 retry (Retry-After honored). Never throws. */
async function notionWrite(
  notionKey: string,
  method: "POST" | "PATCH",
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; id?: string; error?: string }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: headers(notionKey),
        body: JSON.stringify(body),
      });
    } catch (err) {
      return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
    }
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, status: res.status, id: data.id };
    }
    if (res.status === 429 && attempt === 0) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_BACKOFF_MS;
      console.warn(`[notion-season-league] 429 on ${method} — retrying once in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    const text = await res.text().catch(() => "");
    console.error(`[notion-season-league] ${method} failed ${res.status}: ${text}`);
    return { ok: false, status: res.status, error: text.slice(0, 300) };
  }
  return { ok: false, status: 429, error: "rate limited twice" };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type SeasonLeagueReadStatus = "ok" | "config_missing" | "query_failed";

export interface SeasonLeagueRowsResult {
  rows: SeasonLeagueRow[];
  status: SeasonLeagueReadStatus;
}

/** Every row for one league (all weeks, all phases, incl. Void), paginated. */
export async function fetchSeasonLeagueRows(group: SeasonLeagueGroup): Promise<SeasonLeagueRowsResult> {
  const env = notionEnv();
  if (!env) return { rows: [], status: "config_missing" };

  const rows: SeasonLeagueRow[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
        method: "POST",
        headers: headers(env.notionKey),
        body: JSON.stringify({
          filter: { property: SEASON_LEAGUE_PROPS.league, select: { equals: group } },
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
        cache: "no-store",
      });
      if (!res.ok) {
        console.error(`[notion-season-league] query failed ${res.status}`, await res.text().catch(() => ""));
        return { rows: [], status: "query_failed" };
      }
      const data = (await res.json()) as {
        results?: unknown[];
        has_more?: boolean;
        next_cursor?: string | null;
      };
      for (const page of data.results ?? []) rows.push(parseSeasonLeagueRow(page));
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }
  } catch (err) {
    console.error("[notion-season-league] query threw", err);
    return { rows: [], status: "query_failed" };
  }
  return { rows: rows.filter((r) => r.pageId), status: "ok" };
}

export async function findSeasonLeagueRowByKey(key: string): Promise<SeasonLeagueRow | null> {
  const env = notionEnv();
  if (!env || !key) return null;
  try {
    const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
      method: "POST",
      headers: headers(env.notionKey),
      body: JSON.stringify({
        filter: { property: SEASON_LEAGUE_PROPS.key, title: { equals: key } },
        page_size: 1,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: unknown[] };
    const first = data.results?.[0];
    return first ? parseSeasonLeagueRow(first) : null;
  } catch (err) {
    console.error("[notion-season-league] key lookup threw", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type UpsertAction = "created" | "updated" | "skipped" | "failed";

export interface UpsertResult {
  action: UpsertAction;
  pageId?: string;
  error?: string;
}

/**
 * Find-or-create on the key title. An existing Played row is never touched
 * (`skipped`); a Scheduled or Void row is overwritten with the new props —
 * that is how a regenerate re-plans a round in place.
 */
export async function upsertSeasonLeagueRow(key: string, props: Props): Promise<UpsertResult> {
  const env = notionEnv();
  if (!env) return { action: "failed", error: "config_missing" };

  const existing = await findSeasonLeagueRowByKey(key);
  if (existing?.status === "Played") return { action: "skipped", pageId: existing.pageId };

  if (existing) {
    const r = await notionWrite(env.notionKey, "PATCH", `${NOTION_API}/pages/${existing.pageId}`, {
      properties: props,
    });
    return r.ok
      ? { action: "updated", pageId: existing.pageId }
      : { action: "failed", pageId: existing.pageId, error: r.error };
  }

  const r = await notionWrite(env.notionKey, "POST", `${NOTION_API}/pages`, {
    parent: { database_id: env.dbId },
    properties: props,
  });
  return r.ok ? { action: "created", pageId: r.id } : { action: "failed", error: r.error };
}

/** Sequential upserts with the write throttle; returns per-key outcomes. */
export async function upsertSeasonLeagueRows(
  entries: ReadonlyArray<{ key: string; props: Props }>,
): Promise<Array<UpsertResult & { key: string }>> {
  const out: Array<UpsertResult & { key: string }> = [];
  for (let i = 0; i < entries.length; i += 1) {
    if (i > 0) await sleep(WRITE_THROTTLE_MS);
    const entry = entries[i];
    out.push({ key: entry.key, ...(await upsertSeasonLeagueRow(entry.key, entry.props)) });
  }
  return out;
}

/**
 * Move a player's relations on rows that already exist (the trial-profile link).
 *
 * Deliberately narrow: it writes ONLY `Side A` / `Side B` / `Present`, and only
 * the ones the caller names. A link is not a rescore and not a replan, so a
 * Played row's score, status and key are unreachable from here — the property
 * list is built from the patch, never spread from a row.
 */
export async function patchSeasonLeagueRelations(
  patches: ReadonlyArray<{
    pageId: string;
    sideA?: readonly PlayerId[];
    sideB?: readonly PlayerId[];
    present?: readonly PlayerId[];
  }>,
): Promise<{ patched: number; failed: number }> {
  const env = notionEnv();
  if (!env) return { patched: 0, failed: patches.length };

  let patched = 0;
  let failed = 0;
  for (let i = 0; i < patches.length; i += 1) {
    if (i > 0) await sleep(WRITE_THROTTLE_MS);
    const patch = patches[i];
    const props: Props = {};
    if (patch.sideA) props[SEASON_LEAGUE_PROPS.sideA] = relation(patch.sideA);
    if (patch.sideB) props[SEASON_LEAGUE_PROPS.sideB] = relation(patch.sideB);
    if (patch.present) props[SEASON_LEAGUE_PROPS.present] = relation(patch.present);
    if (Object.keys(props).length === 0) continue;

    const r = await notionWrite(env.notionKey, "PATCH", `${NOTION_API}/pages/${patch.pageId}`, {
      properties: props,
    });
    if (r.ok) patched += 1;
    else failed += 1;
  }
  return { patched, failed };
}

export async function recordSeasonLeagueScore(
  pageId: string,
  scoreA: number,
  scoreB: number,
  timed: boolean,
): Promise<boolean> {
  const env = notionEnv();
  if (!env || !pageId) return false;
  const r = await notionWrite(env.notionKey, "PATCH", `${NOTION_API}/pages/${pageId}`, {
    properties: buildScoreProps(scoreA, scoreB, timed),
  });
  return r.ok;
}

export async function voidSeasonLeagueRow(pageId: string): Promise<boolean> {
  const env = notionEnv();
  if (!env || !pageId) return false;
  const r = await notionWrite(env.notionKey, "PATCH", `${NOTION_API}/pages/${pageId}`, {
    properties: buildVoidProps(),
  });
  return r.ok;
}

/** Void several rows, throttled. Returns how many succeeded. */
export async function voidSeasonLeagueRows(pageIds: readonly string[]): Promise<number> {
  let done = 0;
  for (let i = 0; i < pageIds.length; i += 1) {
    if (i > 0) await sleep(WRITE_THROTTLE_MS);
    if (await voidSeasonLeagueRow(pageIds[i])) done += 1;
  }
  return done;
}

// ---------------------------------------------------------------------------
// Schema probe — the loud half of "a filter naming a missing property 400s"
// ---------------------------------------------------------------------------

export type SchemaProbeStatus = "ok" | "config_missing" | "query_failed" | "mismatch";

export interface SchemaProbeResult {
  status: SchemaProbeStatus;
  missing: string[];
  mistyped: string[];
}

export async function probeSeasonLeagueSchema(): Promise<SchemaProbeResult> {
  const env = notionEnv();
  if (!env) return { status: "config_missing", missing: [], mistyped: [] };
  try {
    const res = await fetch(`${NOTION_API}/databases/${env.dbId}`, {
      method: "GET",
      headers: headers(env.notionKey),
      cache: "no-store",
    });
    if (!res.ok) return { status: "query_failed", missing: [], mistyped: [] };
    const data = (await res.json()) as { properties?: Record<string, { type?: string }> };
    const props = data.properties ?? {};
    const missing: string[] = [];
    const mistyped: string[] = [];
    for (const [name, type] of Object.entries(SEASON_LEAGUE_SCHEMA)) {
      const actual = props[name]?.type;
      if (!actual) missing.push(name);
      else if (actual !== type) mistyped.push(`${name} (${actual}, expected ${type})`);
    }
    return {
      status: missing.length || mistyped.length ? "mismatch" : "ok",
      missing,
      mistyped,
    };
  } catch (err) {
    console.error("[notion-season-league] schema probe threw", err);
    return { status: "query_failed", missing: [], mistyped: [] };
  }
}
