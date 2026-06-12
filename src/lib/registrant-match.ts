import type { DropInRegistration } from "@/lib/notion-dropins";

/**
 * Registration↔session matching. Rows written since 2026-06-12 stamp the
 * session row's Notion page ID (`Session Row ID`) — for those, ID equality is
 * authoritative and survives any later title rename. Older rows only snapshot
 * the Session Title text as it read at checkout, so they fall back to
 * normalized-title matching (date is already filtered in the Notion query).
 */
export function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Notion page IDs appear both dashed and undashed depending on the API path. */
export function normalizePageId(s: string): string {
  return s.trim().toLowerCase().replace(/-/g, "");
}

export interface RegistrantPartition {
  matched: DropInRegistration[];
  /** Same-date rows that belong to a different session (e.g. the other level
   * courts on an all-levels Tuesday). */
  otherTitleCount: number;
}

const STATUS_ORDER: Record<string, number> = { Confirmed: 0 };

export function partitionRegistrants(
  rows: DropInRegistration[],
  sessionTitle: string,
  sessionRowId = "",
): RegistrantPartition {
  const wantTitle = normalizeTitle(sessionTitle);
  const wantId = normalizePageId(sessionRowId);
  const matched: DropInRegistration[] = [];
  let otherTitleCount = 0;
  for (const row of rows) {
    const rowId = normalizePageId(row.sessionRowId);
    const isMatch =
      rowId && wantId ? rowId === wantId : normalizeTitle(row.sessionTitle) === wantTitle;
    if (isMatch) matched.push(row);
    else otherTitleCount++;
  }
  matched.sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1) ||
      a.childFirstName.localeCompare(b.childFirstName),
  );
  return { matched, otherTitleCount };
}
