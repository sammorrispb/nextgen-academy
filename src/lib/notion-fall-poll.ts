import { playerCrmDbId, readPlainText } from "./notion-utils";
import type { FallPollAction } from "./fall-poll-token";

/**
 * Player-CRM read/write for the Fall 2026 one-click poll.
 *
 * Read side — fetchActiveFamilies: the poll goes to CURRENT families (any CRM
 * row with Status = Active), which is a different audience rule from the
 * lead-marketing helpers (classifyLead would drop DD-derived rows — wrong
 * here: an active family is an active family regardless of how they first
 * found us). Suppression stays family-scoped exactly like resolveFamilyBucket:
 * the CRM holds ~405 rows for ~257 families, so one Quarantine tick anywhere
 * in the family suppresses every address it owns.
 *
 * Write side — recordFallPollResponse: stamps the "Fall 2026 Poll" select on
 * EVERY row the family owns (same all-rows rule as quarantineLeadByEmail, for
 * the same defence-in-depth reason). Latest confirmed answer wins — that's the
 * desired "changed my mind" behavior.
 *
 * The "Fall 2026 Poll" select property (options In / Interested / Out) must
 * exist on the Player CRM — Notion auto-creates select OPTIONS on write but
 * never properties.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export const FALL_POLL_PROPERTY = "Fall 2026 Poll";

const OPTION_FOR: Record<FallPollAction, "In" | "Interested" | "Out"> = {
  in: "In",
  interested: "Interested",
  out: "Out",
};

export interface ActiveFamily {
  email: string;
  parentName: string;
}

export interface ActiveFamiliesResult {
  families: ActiveFamily[];
  scannedRows: number;
  familiesTotal: number;
  quarantinedExcluded: number;
}

/** First plausible address out of a raw Parent Email cell — the CRM holds a
 * few rows where one email field carries several comma-joined addresses. */
function firstEmail(raw: string): string {
  return (
    raw
      .split(/[,\s]+/)
      .map((e) => e.trim())
      .find((e) => e.includes("@")) ?? ""
  );
}

function notionHeaders(notionKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${notionKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

export async function fetchActiveFamilies(): Promise<ActiveFamiliesResult> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) {
    throw new Error("fetchActiveFamilies: NOTION_API_KEY missing");
  }
  const db = playerCrmDbId();

  interface Fold {
    email: string;
    parentName: string;
    anyActive: boolean;
    anyQuarantined: boolean;
  }
  const byEmail = new Map<string, Fold>();
  let scannedRows = 0;

  let cursor: string | undefined;
  do {
    const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`fetchActiveFamilies: query failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    for (const page of data.results ?? []) {
      scannedRows++;
      const props = page.properties ?? {};
      const email = firstEmail(props["Parent Email"]?.email ?? "");
      if (!email) continue;
      const key = email.toLowerCase();
      const fold = byEmail.get(key) ?? {
        email,
        parentName: "",
        anyActive: false,
        anyQuarantined: false,
      };
      if (!fold.parentName) {
        fold.parentName = readPlainText(props["Parent Name"]).trim();
      }
      if (props.Status?.select?.name === "Active") fold.anyActive = true;
      if (props.Quarantine?.checkbox === true) fold.anyQuarantined = true;
      byEmail.set(key, fold);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  const families: ActiveFamily[] = [];
  let quarantinedExcluded = 0;
  for (const fold of byEmail.values()) {
    if (!fold.anyActive) continue;
    if (fold.anyQuarantined) {
      quarantinedExcluded++;
      continue;
    }
    families.push({ email: fold.email, parentName: fold.parentName });
  }

  return {
    families,
    scannedRows,
    familiesTotal: byEmail.size,
    quarantinedExcluded,
  };
}

const ACTION_FOR: Record<string, FallPollAction> = {
  In: "in",
  Interested: "interested",
  Out: "out",
};

/**
 * The FIRST address of a Parent Email cell, lowercased.
 *
 * A handful of CRM rows carry several comma-joined addresses in one cell, and
 * the poll token is minted from the first one (see the `contains` query below)
 * — so the first address is the one that actually received the link and tapped
 * it. Mailing the raw cell would produce a malformed recipient; mailing the
 * others would reach someone who never saw the poll.
 */
export function primaryParentEmail(cell: string): string {
  return firstEmail(cell ?? "").toLowerCase();
}

export interface RecordPollResult {
  ok: boolean;
  rowsUpdated: number;
  /** True when the address matched no CRM row. */
  notFound: boolean;
  /**
   * The answer these rows held BEFORE this write, or null if unanswered.
   * The registration-link send keys off this: only a transition INTO "in"
   * earns an email, so a re-tap of the same link mails nothing. Using the
   * poll value itself as the sent-flag avoids a second Notion property —
   * and Notion never auto-creates properties, only select options.
   */
  previous: FallPollAction | null;
  /**
   * The family's parent name as the CRM holds it, for greeting them in any
   * follow-up mail. Never derive a greeting from the email local-part — it
   * renders "Thanks jeffwhitey" to a paying parent.
   */
  parentName: string | null;
}

export async function recordFallPollResponse(
  email: string,
  action: FallPollAction,
): Promise<RecordPollResult> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) {
    console.error("[fall-poll] NOTION_API_KEY missing");
    return {
      ok: false,
      rowsUpdated: 0,
      notFound: false,
      previous: null,
      parentName: null,
    };
  }
  const db = playerCrmDbId();
  const normalized = email.trim().toLowerCase();

  // `contains`, not `equals`: a handful of CRM rows carry several comma-joined
  // addresses in one email cell, and the token is minted from the first one.
  const pageIds: string[] = [];
  let previous: FallPollAction | null = null;
  let parentName: string | null = null;
  let cursor: string | undefined;
  do {
    const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        filter: { property: "Parent Email", email: { contains: normalized } },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[fall-poll] query failed (${res.status}): ${text}`);
      return {
        ok: false,
        rowsUpdated: 0,
        notFound: false,
        previous: null,
        parentName: null,
      };
    }
    const data = await res.json();
    for (const page of data.results ?? []) {
      if (!page.id) continue;
      pageIds.push(page.id);
      // All of a family's rows are stamped together, so the first row carrying
      // an answer speaks for the family.
      if (previous === null) {
        const name = page.properties?.[FALL_POLL_PROPERTY]?.select?.name;
        if (name && ACTION_FOR[name]) previous = ACTION_FOR[name];
      }
      if (parentName === null) {
        const pn = readPlainText(page.properties?.["Parent Name"]).trim();
        if (pn) parentName = pn;
      }
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  if (pageIds.length === 0) {
    return {
      ok: true,
      rowsUpdated: 0,
      notFound: true,
      previous: null,
      parentName: null,
    };
  }

  let updated = 0;
  let failed = 0;
  for (const pageId of pageIds) {
    const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: notionHeaders(notionKey),
      body: JSON.stringify({
        properties: {
          [FALL_POLL_PROPERTY]: { select: { name: OPTION_FOR[action] } },
        },
      }),
    });
    if (res.ok) updated++;
    else {
      failed++;
      const text = await res.text().catch(() => "");
      console.error(`[fall-poll] patch ${pageId} failed (${res.status}): ${text}`);
    }
  }

  // Partial success is NOT ok: a stale duplicate row would show the wrong
  // answer to whoever reads that row first — the caller must tell the parent
  // we couldn't save it rather than show a false confirmation.
  return {
    ok: failed === 0,
    rowsUpdated: updated,
    notFound: false,
    previous,
    parentName,
  };
}
