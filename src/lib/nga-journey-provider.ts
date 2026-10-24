import { NOTION_API, NOTION_VERSION, PLAYER_CRM_DB_ID_FALLBACK, playerCrmDbId } from "@/lib/notion-utils";

export interface NgaJourneyProvider {
  readonly kind: "notion" | "synthetic_https";
  readonly playerDbId: string;
  readonly sessionsDbId: string;
  readonly registrationsDbId: string;
  request(path: string, body?: object): Promise<unknown>;
}

export class NgaJourneyProviderError extends Error {
  constructor(readonly reason: "source_not_configured" | "source_unavailable", readonly status = 503) { super(reason); }
}

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const pagePath = /^\/v1\/pages\/(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i;
const normalizedId = (id: string) => id.replaceAll("-", "").toLowerCase();
const missing = () => new NgaJourneyProviderError("source_not_configured");

/** Resolve once per preview so slow reads and authority rechecks cannot switch
 * sources. The trusted deployment's project pin must first pass ownership
 * admission outside this module; valid configuration alone proves no ownership.
 * Fixture mode never resolves a Notion credential or canonical database fallback.
 */
export function resolveNgaJourneyProvider(): NgaJourneyProvider {
  const mode = process.env.NGA_JOURNEY_PROVIDER;
  let kind: NgaJourneyProvider["kind"], base: string, key: string;
  let playerDbId: string, sessionsDbId: string, registrationsDbId: string, runId: string | undefined;
  if (mode === "synthetic_https") {
    const ref = process.env.NGA_JOURNEY_FIXTURE_PROJECT_REF;
    const url = process.env.NGA_JOURNEY_FIXTURE_URL;
    runId = process.env.NGA_JOURNEY_FIXTURE_RUN_ID;
    const readKey = process.env.NGA_JOURNEY_FIXTURE_READ_KEY;
    const players = process.env.NGA_JOURNEY_PLAYERS_DB_ID;
    const sessions = process.env.NGA_JOURNEY_SESSIONS_DB_ID;
    const registrations = process.env.NGA_JOURNEY_REGISTRATIONS_DB_ID;
    if (process.env.VERCEL_ENV !== "preview" || !ref || !/^[a-z]{20}$/.test(ref)
      || ref === "hivuxgbiczpeqtnfzhnm" || /^(?:tqqh|czrir)/.test(ref)
      || url !== `https://${ref}.supabase.co/functions/v1/player-journey-fixture`
      || !runId || runId.length < 8 || runId.length > 40 || !/^[a-z][a-z\d]*(?:-[a-z\d]+)*$/.test(runId)
      || !readKey || !/^[A-Za-z\d_-]{32,128}$/.test(readKey)
      || !players || !sessions || !registrations || ![players, sessions, registrations].every((id) => uuid.test(id))) throw missing();
    const ids = [players, sessions, registrations].map(normalizedId);
    if (new Set(ids).size !== 3 || ids.includes(normalizedId(PLAYER_CRM_DB_ID_FALLBACK))) throw missing();
    kind = "synthetic_https"; base = url; key = readKey;
    playerDbId = players.toLowerCase(); sessionsDbId = sessions.toLowerCase(); registrationsDbId = registrations.toLowerCase();
  } else {
    if (mode !== undefined && mode !== "" && mode !== "notion") throw missing();
    const notionKey = process.env.NOTION_API_KEY, sessions = process.env.NOTION_SESSIONS_DB_ID;
    if (!notionKey || !sessions) throw missing();
    kind = "notion"; base = NOTION_API.slice(0, -3); key = notionKey;
    playerDbId = playerCrmDbId(); sessionsDbId = sessions; registrationsDbId = process.env.NOTION_DROPINS_DB_ID ?? "";
  }
  return Object.freeze({
    kind, playerDbId, sessionsDbId, registrationsDbId,
    async request(path: string, body?: object): Promise<unknown> {
      const readPage = body === undefined && pagePath.test(path);
      const querySessions = body !== undefined && path === `/v1/databases/${sessionsDbId}/query`;
      if (!readPage && !querySessions) throw new NgaJourneyProviderError("source_unavailable");
      try {
        const response = await fetch(`${base}${path}`, {
          method: querySessions ? "POST" : "GET",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(kind === "notion" ? { "Notion-Version": NOTION_VERSION } : { "X-Player-Journey-Run": runId! }) },
          ...(querySessions ? { body: JSON.stringify(body) } : {}),
          redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok || response.redirected) throw new NgaJourneyProviderError("source_unavailable", readPage && response.status === 404 ? 404 : 503);
        return await response.json();
      } catch (error) {
        if (error instanceof NgaJourneyProviderError) throw error;
        throw new NgaJourneyProviderError("source_unavailable");
      }
    },
  });
}
