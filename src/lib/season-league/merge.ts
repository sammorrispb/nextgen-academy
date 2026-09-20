import type { PlayerId } from "./types";

/**
 * Moving one player's identity onto another, purely.
 *
 * A kid who plays a Sunday before their family pays accumulates results against
 * whatever Fall Registrations row existed that day — `PlayerId` IS that row's
 * Notion page id. When the family then registers through checkout they get a
 * SECOND row with a new id, carrying the waiver, emergency contact and birth
 * year but none of the games. This module computes the relation rewrite that
 * joins the two; `admin-fall-actions.ts` does the I/O and owns the guards.
 *
 * It rewrites RELATIONS ONLY. Scores, statuses and keys are never in a patch
 * produced here, so a link can never re-open, rescore or re-plan a played game.
 */

export interface MergeableRow {
  pageId: string;
  key: string;
  /** "Scheduled" | "Played" | "Void" | "" */
  status: string;
  sideA: PlayerId[];
  sideB: PlayerId[];
  present: PlayerId[];
}

/** Only the relation lists that actually changed. */
export interface RelationPatch {
  pageId: string;
  sideA?: PlayerId[];
  sideB?: PlayerId[];
  present?: PlayerId[];
}

const RELATIONS = ["sideA", "sideB", "present"] as const;
type RelationField = (typeof RELATIONS)[number];

/** A Void row is dead history — rewriting it is noise, not correctness. */
function isLive(row: MergeableRow): boolean {
  return row.status !== "Void";
}

/**
 * `from` → `to`, preserving order and collapsing a duplicate. The dedupe is
 * belt-and-braces: `linkFallProfile` refuses outright when the target already
 * appears anywhere, so the two can never meet on one side in practice — but a
 * relation list holding one child twice would be a silent, unreadable court
 * assignment, so it is impossible here too.
 */
function rewriteList(ids: readonly PlayerId[], from: PlayerId, to: PlayerId): PlayerId[] | null {
  if (!ids.includes(from)) return null;
  const out: PlayerId[] = [];
  for (const id of ids) {
    const next = id === from ? to : id;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}

/**
 * The patches that move `from` onto `to` across a league's rows. Empty when
 * there is nothing to move — which is also what makes a re-run a no-op.
 */
export function rewritePlayerInRows(
  rows: readonly MergeableRow[],
  from: PlayerId,
  to: PlayerId,
): RelationPatch[] {
  const patches: RelationPatch[] = [];
  for (const row of rows) {
    if (!isLive(row)) continue;
    const patch: RelationPatch = { pageId: row.pageId };
    let changed = false;
    for (const field of RELATIONS) {
      const next = rewriteList(row[field as RelationField], from, to);
      if (next) {
        patch[field] = next;
        changed = true;
      }
    }
    if (changed) patches.push(patch);
  }
  return patches;
}

/**
 * Does this player hold a place in any live row? The guard that makes a link
 * safe: a target with zero games cannot be merged into self-play, cannot end up
 * twice on one side, and cannot be a second kid who really played.
 */
export function playerAppearsIn(rows: readonly MergeableRow[], id: PlayerId): boolean {
  return rows.some(
    (row) =>
      isLive(row) &&
      (row.sideA.includes(id) || row.sideB.includes(id) || row.present.includes(id)),
  );
}
