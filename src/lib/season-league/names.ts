import type { PlayerId } from "./types";

/**
 * Display names for a roster. The league shows a child's FIRST NAME only; two
 * kids sharing one get a numeric suffix ("Aiden", "Aiden (2)") in roster
 * order — never a parent detail, never a birth year — and a blank name
 * renders as "Player".
 */
export interface NamedPlayer {
  pageId: PlayerId;
  childFirstName: string;
}

export function buildNameMap(players: readonly NamedPlayer[]): Map<PlayerId, string> {
  const seen = new Map<string, number>();
  const out = new Map<PlayerId, string>();
  for (const p of players) {
    const base = (p.childFirstName || "").trim() || "Player";
    const n = (seen.get(base.toLowerCase()) ?? 0) + 1;
    seen.set(base.toLowerCase(), n);
    out.set(p.pageId, n === 1 ? base : `${base} (${n})`);
  }
  return out;
}

export function nameFor(names: ReadonlyMap<PlayerId, string>, id: PlayerId): string {
  return names.get(id) ?? "Player";
}

export function sideLabel(names: ReadonlyMap<PlayerId, string>, ids: readonly PlayerId[]): string {
  return ids.map((id) => nameFor(names, id)).join(" & ");
}
