/**
 * Write + read side for the NGA Waivers Notion DB (NOTION_WAIVERS_DB_ID).
 *
 * One row per parent, keyed/deduped on Parent Email (phone fallback). The
 * one-time waiver is a parent-level legal record, NOT a per-registration row —
 * so it lives in its own DB that the pre-checkout gate can query *before* a
 * parent has any drop-in/roster row at all.
 *
 *   createWaiver()      — write a signed row (caller dedups first via findWaiver*)
 *   findWaiverByEmail() — lookup used for dedup + the gate
 *   hasWaiverOnFile()   — the gate's boolean read (see fail-open note below)
 *
 * No child fields are ever written here — the waiver is parent-scoped, so this
 * file stays outside the minor-PII egress surface by construction.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function env(): { key?: string; db?: string } {
  return {
    key: process.env.NOTION_API_KEY,
    db: process.env.NOTION_WAIVERS_DB_ID,
  };
}

export interface WaiverRow {
  parentName: string;
  email: string;
  phone?: string;
  /** The full legal name the parent typed as their e-signature. */
  signatureName: string;
  /** Waiver text version agreed to, e.g. "2026-06". */
  waiverVersion: string;
  /** ISO 8601 datetime the waiver was signed. */
  signedAtIso: string;
  /** Signer IP (x-forwarded-for), best-effort audit trail. */
  signedIp?: string;
}

async function queryByProperty(
  key: string,
  db: string,
  property: "Parent Email" | "Parent Phone",
  filterKey: "email" | "phone_number",
  value: string,
): Promise<string | null> {
  const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property, [filterKey]: { equals: value } },
      page_size: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Notion waivers query failed (${res.status}): ${await res
        .text()
        .catch(() => "")}`,
    );
  }
  const data = (await res.json()) as { results: { id: string }[] };
  return data.results[0]?.id ?? null;
}

/** Find an existing waiver row for this parent email. Returns its pageId or null. */
export async function findWaiverByEmail(
  email: string,
): Promise<{ pageId: string } | null> {
  const { key, db } = env();
  if (!key || !db || !email) return null;
  const id = await queryByProperty(
    key,
    db,
    "Parent Email",
    "email",
    email.trim().toLowerCase(),
  );
  return id ? { pageId: id } : null;
}

/**
 * The pre-checkout gate read: does this parent have a signed waiver on file?
 *
 * Fail-open when NOTION_WAIVERS_DB_ID is UNSET (the DB isn't wired in this
 * environment yet) so a misconfiguration can't block all paid checkout — this
 * mirrors the repo-wide "skip gracefully if env missing" convention. Once the
 * env var is set the gate fail-CLOSES: no matching row → false → blocked.
 * A transient Notion error also fails open (logged) so a Notion blip never
 * takes down the revenue path; the waiver is still presented at /waiver/sign.
 */
export async function hasWaiverOnFile(
  email?: string,
  phone?: string,
): Promise<boolean> {
  const { key, db } = env();
  if (!key || !db) return true; // unconfigured → fail-open
  try {
    if (email) {
      const byEmail = await queryByProperty(
        key,
        db,
        "Parent Email",
        "email",
        email.trim().toLowerCase(),
      );
      if (byEmail) return true;
    }
    if (phone) {
      const byPhone = await queryByProperty(
        key,
        db,
        "Parent Phone",
        "phone_number",
        phone.trim(),
      );
      if (byPhone) return true;
    }
    return false;
  } catch (err) {
    console.error("[notion-waivers] hasWaiverOnFile error — failing open:", err);
    return true;
  }
}

export async function createWaiver(
  row: WaiverRow,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  const { key, db } = env();
  if (!key || !db) {
    return { ok: false, error: "NOTION_WAIVERS_DB_ID not configured" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Signature: { title: [{ text: { content: row.parentName.slice(0, 200) } }] },
    "Parent Email": { email: row.email.trim().toLowerCase() },
    "Parent Name": { rich_text: [{ text: { content: row.parentName } }] },
    "Signature Name": {
      rich_text: [{ text: { content: row.signatureName } }],
    },
    "Signed At": { date: { start: row.signedAtIso } },
    "Waiver Version": {
      rich_text: [{ text: { content: row.waiverVersion } }],
    },
  };
  if (row.phone) {
    properties["Parent Phone"] = { phone_number: row.phone };
  }
  if (row.signedIp) {
    properties["Signed IP"] = { rich_text: [{ text: { content: row.signedIp } }] };
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({ parent: { database_id: db }, properties }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Notion waiver create failed (${res.status}): ${text}` };
  }
  const data = await res.json();
  return { ok: true, pageId: data.id };
}
