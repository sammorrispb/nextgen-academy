/**
 * Shared Notion property helpers (admin-reduction roadmap Phase 0.2),
 * extracted from the 7 files that each carried their own identical
 * readPlainText copy. First brick of the incremental typed-Notion layer —
 * grow this file instead of re-inlining helpers.
 */

/** Concatenated plain text of a Notion rich_text/title property. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readPlainText(prop: any): string {
  if (!prop) return "";
  const arr = prop.rich_text ?? prop.title ?? [];
  if (!Array.isArray(arr)) return "";
  return arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("");
}

/** The house email-shape check (same literal previously redefined ~24×).
 * Migration is opportunistic — swap call sites only when already editing. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * NGA Player CRM (Notion "Next Gen Academy Player Database") id — ONE
 * env-backed constant for the id that was previously hardcoded in 6 files
 * (roadmap Phase 1a batch of 0.2/M4). Resolution order, read at CALL time so
 * specs can set env before/after import:
 *   1. NOTION_PLAYER_CRM_DB_ID (the ONLY documented env override)
 *   2. the well-known literal (non-secret) so nothing breaks while unset.
 *
 * The legacy NOTION_DB_ID env is deliberately NOT consulted (PR #244 F8): it
 * was an undocumented widening that let one stray env var silently retarget
 * every CRM read/write — including the two outreach helpers (notion-eval,
 * lead-outreach-run) that historically honored it. Verified before removal:
 * no deployment environment sets NOTION_DB_ID.
 */
export const PLAYER_CRM_DB_ID_FALLBACK = "1e5e34c258384c6cb5f3e846543ecfc7";

export function playerCrmDbId(): string {
  return process.env.NOTION_PLAYER_CRM_DB_ID || PLAYER_CRM_DB_ID_FALLBACK;
}

// ---------------------------------------------------------------------------
// Page-create fail-soft (shared with notion-dropins, waitlist)
// ---------------------------------------------------------------------------

export const NOTION_API = "https://api.notion.com/v1";
export const NOTION_VERSION = "2022-06-28";

/**
 * Map a failed Notion HTTP status to a retry policy. 429 (rate limit) and 5xx
 * (server error) are worth retrying; every other 4xx is deterministic — the
 * same request will fail identically, so retrying only wastes attempts.
 *
 * Lives here (not in notion-dropins) so the fail-soft below can use it without
 * a cycle; notion-dropins re-exports it, which is where existing callers and
 * `e2e/notion-dropins.spec.ts` still import it from.
 */
export function classifyNotionFailure(status: number): "transient" | "permanent" {
  return status === 429 || status >= 500 ? "transient" : "permanent";
}

/**
 * POST a page create, failing soft on the optional `Source` attribution column.
 *
 * A deterministic rejection that names Source — the property doesn't exist on
 * that database, or its type drifted — must never cost us the row itself. This
 * has now bitten twice:
 *   - 2026-06-13 (the Landon incident): #174 shipped a Source write to the
 *     drop-ins DB before the property existed, 400ing every create and leaving
 *     paid parents unregistered.
 *   - 2026-08-25: the same write on the waitlist DB, whose schema never gained
 *     a Source property — the signup emailed fine and vanished from Notion.
 * So the retry is shared rather than re-inlined per route: attribution is
 * best-effort, the row it decorates is not.
 *
 * Returns the LAST response, the first failure's body (already consumed, so
 * callers log this instead of re-reading `res`), and whether Source was
 * dropped — surface that flag, it is the only signal that the schema drifted.
 */
export async function createNotionPageSourceFailSoft(args: {
  notionKey: string;
  databaseId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;
  /** Log tag, e.g. "[waitlist]". */
  logPrefix: string;
}): Promise<{ res: Response; bodyText: string; droppedSource: boolean }> {
  const { notionKey, databaseId, properties, logPrefix } = args;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postPage = (props: Record<string, any>) =>
    fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: props,
      }),
    });

  const res = await postPage(properties);
  if (
    res.ok ||
    !("Source" in properties) ||
    classifyNotionFailure(res.status) === "transient"
  ) {
    return { res, bodyText: "", droppedSource: false };
  }

  const bodyText = await res.text().catch(() => "");
  // Only a Source-named rejection is retried — anything else (a bad Status
  // option, a wrong title property) must stay visible, not be masked.
  if (!bodyText.includes("Source")) {
    return { res, bodyText, droppedSource: false };
  }

  console.error(
    `${logPrefix} Notion create rejected on Source — retrying without attribution so the row still lands`,
    res.status,
    bodyText,
  );
  const withoutSource = { ...properties };
  delete withoutSource.Source;
  return { res: await postPage(withoutSource), bodyText, droppedSource: true };
}
