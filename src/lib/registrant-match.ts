import type { DropInRegistration } from "@/lib/notion-dropins";

/**
 * Drop-in rows carry no Notion relation back to their session row — they store
 * the Session Title / Session Date text as it read at checkout time. Matching
 * is therefore by date (in the Notion query) + normalized title (here), so a
 * later whitespace/case tweak to the session title doesn't orphan its roster.
 */
export function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface RegistrantPartition {
  matched: DropInRegistration[];
  /** Same-date rows registered under a different session title (e.g. the
   * other level courts on an all-levels Tuesday). */
  otherTitleCount: number;
}

const STATUS_ORDER: Record<string, number> = { Confirmed: 0 };

export function partitionRegistrants(
  rows: DropInRegistration[],
  sessionTitle: string,
): RegistrantPartition {
  const want = normalizeTitle(sessionTitle);
  const matched: DropInRegistration[] = [];
  let otherTitleCount = 0;
  for (const row of rows) {
    if (normalizeTitle(row.sessionTitle) === want) matched.push(row);
    else otherTitleCount++;
  }
  matched.sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1) ||
      a.childFirstName.localeCompare(b.childFirstName),
  );
  return { matched, otherTitleCount };
}
