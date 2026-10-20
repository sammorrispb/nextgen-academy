// NGA -> Link & Dink rotation-league client. One POST per command to
// /play/api/internal/nga-rotation-league (community-os apps/p3), the same
// X-NGA-Sync-Secret contract as the MVF roster sync.
//
// Child data that leaves NGA here: a registration's Notion page id
// (external_ref) and the child's first and last name, in roster_upsert only.
// Every other command carries a season slug, a week, a page id, a game id or
// scores. Pinned by e2e/invariant-rotation-league-egress.spec.ts.
//
// Only a production deploy sends. A preview or local build would write test
// check-ins onto the live season, so it refuses unless LINKDINK_BASE_URL points
// it at an L&D instance on purpose ("" counts as unset). Never throws.

const DEFAULT_LD_BASE_URL = "https://www.linkanddink.com";
const PATH = "/play/api/internal/nga-rotation-league";
/** The planner searches a few thousand candidates per round; give it room. */
export const ROTATION_LEAGUE_TIMEOUT_MS = 15000;

/** The endpoint's refusal codes (community-os route + service). Anything else
 * is reported by HTTP status alone, so a response body can't ride a log line. */
const KNOWN_CODES = new Set([
  "not_configured",
  "unauthorized",
  "too_large",
  "bad_input",
  "store_unavailable",
  "season_not_found",
  "season_closed",
  "not_a_play_week",
  "not_a_season_week",
  "player_not_found",
  "player_withdrawn",
  "game_not_found",
  "game_void",
  "bad_game_target",
  "bad_score",
  "bad_plan",
  "night_cancelled",
  "bad_side_size",
  "player_double_booked",
  "player_not_present",
  "court_taken",
  "legacy_erasure_review_required",
  "no_playoff",
  "not_the_playoff_week",
  "teams_locked",
  "teams_not_locked",
  "bracket_started",
  "bracket_changed",
  "bad_teams",
  "slot_not_found",
  "slot_not_ready",
]);

export type LeagueResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; reason?: string };

export function rotationLeagueTarget(): { url: string; secret: string } | { refused: string } {
  const production = process.env.VERCEL_ENV === "production";
  const baseUrlOverride = process.env.LINKDINK_BASE_URL || undefined;
  if (!production && !baseUrlOverride) return { refused: "not_production" };
  const secret = process.env.NGA_SYNC_SECRET;
  if (!secret) return { refused: "secret_unset" };
  const base = (baseUrlOverride ?? DEFAULT_LD_BASE_URL).replace(/\/+$/, "");
  return { url: `${base}${PATH}`, secret };
}

export async function callRotationLeague<T>(command: Record<string, unknown>): Promise<LeagueResult<T>> {
  const target = rotationLeagueTarget();
  if ("refused" in target) return { ok: false, code: target.refused };

  let res: Response;
  try {
    res = await fetch(target.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-nga-sync-secret": target.secret },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: AbortSignal.timeout(ROTATION_LEAGUE_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    console.error(`[rotation-league] ${String(command.action)} ${timedOut ? "timed out" : "failed to send"}`);
    return { ok: false, code: timedOut ? "timeout" : "unreachable" };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (res.ok && body.ok === true) return { ok: true, data: body as T };

  const code = typeof body.error === "string" && KNOWN_CODES.has(body.error) ? body.error : `http_${res.status}`;
  // `reason` is the engine's own short sentence ("Ties aren't allowed"), never database text.
  const reason =
    KNOWN_CODES.has(code) && typeof body.reason === "string" ? body.reason.slice(0, 200) : undefined;
  console.error(`[rotation-league] ${String(command.action)} refused: ${code}`);
  return { ok: false, code, ...(reason ? { reason } : {}) };
}
