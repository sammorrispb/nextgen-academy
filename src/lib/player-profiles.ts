import {
  fetchDropInsByParent,
  type AttendanceValue,
  type DropInRegistration,
} from "@/lib/notion-dropins";
import {
  fetchPlayerLevelsByParent,
  type PlayerLevel,
} from "@/lib/notion-player-bracket";

/**
 * Family/player profile, assembled from the Notion drop-in rows (the
 * transactional source of truth for sessions, payments, refunds, and
 * attendance). Open Brain is the semantic mirror the check-ins feed; this view
 * reads the ledger directly so it can show payment history.
 *
 * Refund caveat: a partial refund still flips the Notion row Status to
 * "Refunded" but the row only stores the original amount paid, so
 * `refundedUsd` treats every Refunded row as a full refund. Good enough for a
 * coach-facing summary; Stripe is the precise ledger for partials.
 */

export interface ProfileEvent {
  sessionTitle: string;
  sessionDate: string;
  location: string;
  status: string; // Confirmed | Cancelled | Refunded
  attendance: AttendanceValue | "";
  amountUsd: number;
  refunded: boolean;
}

export interface ChildProfile {
  childFirstName: string;
  birthYear: number;
  /** Coach-assigned skill bracket (Player CRM Level). "" when unassigned. */
  level: PlayerLevel | "";
  events: ProfileEvent[];
  attended: number;
  noShow: number;
  paidUsd: number; // currently-held (Confirmed) payments
  refundedUsd: number;
}

export interface FamilyProfile {
  key: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  children: ChildProfile[];
  lifetimeRegistrations: number;
  attended: number;
  noShow: number;
  paidUsd: number;
  refundedUsd: number;
}

export interface FamilyDirectoryChild {
  name: string;
  birthYear: number;
}

export interface FamilyDirectoryEntry {
  key: string;
  parentName: string;
  childNames: string[];
  children: FamilyDirectoryChild[];
  /** Newest registered session date (any status) — "recent activity". */
  lastSessionDate: string;
  /** Newest session the child was marked Present — "last attended". */
  lastAttendedDate: string;
  /** Oldest registered session date — a proxy for "date added". */
  firstSessionDate: string;
  registrations: number;
}

/** Minimal, coach-scoped search projection — parent + child NAMES only, never
 *  contact info or birth years. Powers the top-nav family search dropdown. */
export interface FamilySearchEntry {
  key: string;
  parentName: string;
  childNames: string[];
}

export function toSearchIndex(entries: FamilyDirectoryEntry[]): FamilySearchEntry[] {
  return entries.map((e) => ({
    key: e.key,
    parentName: e.parentName,
    childNames: e.childNames,
  }));
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

/** Stable per-family key for profile deep links. Email wins; phone is fallback. */
export function encodeParentKey(email: string, phone: string): string {
  const e = (email || "").trim().toLowerCase();
  const p = (phone || "").replace(/\D/g, "");
  if (e) return b64url(`e:${e}`);
  if (p) return b64url(`p:${p}`);
  return "";
}

export function decodeParentKey(
  key: string,
): { email: string; phone: string } | null {
  try {
    const id = Buffer.from(key, "base64url").toString("utf8");
    if (id.startsWith("e:")) return { email: id.slice(2), phone: "" };
    if (id.startsWith("p:")) return { email: "", phone: id.slice(2) };
    return null;
  } catch {
    return null;
  }
}

export function buildFamilyProfile(
  rows: DropInRegistration[],
  key: string,
): FamilyProfile | null {
  if (rows.length === 0) return null;

  // Identity: first non-empty value across the family's rows.
  const parentName = rows.find((r) => r.parentName)?.parentName ?? "";
  const parentEmail = rows.find((r) => r.parentEmail)?.parentEmail ?? "";
  const parentPhone = rows.find((r) => r.parentPhone)?.parentPhone ?? "";

  const byChild = new Map<string, DropInRegistration[]>();
  for (const r of rows) {
    const name = (r.childFirstName || "Unknown").trim();
    const k = name.toLowerCase();
    const arr = byChild.get(k) ?? [];
    arr.push(r);
    byChild.set(k, arr);
  }

  const children: ChildProfile[] = [];
  for (const group of byChild.values()) {
    const events: ProfileEvent[] = group.map((r) => ({
      sessionTitle: r.sessionTitle,
      sessionDate: r.sessionDate,
      location: r.location,
      status: r.status,
      attendance: r.attendance,
      amountUsd: r.amountPaidUsd,
      refunded: r.status === "Refunded",
    }));
    events.sort((a, b) => (a.sessionDate < b.sessionDate ? 1 : -1));

    children.push({
      childFirstName: group.find((r) => r.childFirstName)?.childFirstName ?? "Unknown",
      birthYear: group.find((r) => r.childBirthYear > 0)?.childBirthYear ?? 0,
      // Enriched from the Player CRM in getFamilyProfile (the async layer).
      level: "",
      events,
      attended: group.filter((r) => r.attendance === "Present").length,
      noShow: group.filter((r) => r.attendance === "No-show").length,
      paidUsd: group
        .filter((r) => r.status === "Confirmed")
        .reduce((sum, r) => sum + r.amountPaidUsd, 0),
      refundedUsd: group
        .filter((r) => r.status === "Refunded")
        .reduce((sum, r) => sum + r.amountPaidUsd, 0),
    });
  }
  children.sort((a, b) => a.childFirstName.localeCompare(b.childFirstName));

  return {
    key,
    parentName,
    parentEmail,
    parentPhone,
    children,
    lifetimeRegistrations: rows.length,
    attended: children.reduce((s, c) => s + c.attended, 0),
    noShow: children.reduce((s, c) => s + c.noShow, 0),
    paidUsd: children.reduce((s, c) => s + c.paidUsd, 0),
    refundedUsd: children.reduce((s, c) => s + c.refundedUsd, 0),
  };
}

/** Fetch + assemble one family's profile from its deep-link key, with each
 *  child's coach-assigned bracket overlaid from the Player CRM (fail-soft — a
 *  Notion miss just leaves brackets unassigned). */
export async function getFamilyProfile(key: string): Promise<FamilyProfile | null> {
  const decoded = decodeParentKey(key);
  if (!decoded) return null;
  const [rows, levels] = await Promise.all([
    fetchDropInsByParent(decoded.email, decoded.phone),
    fetchPlayerLevelsByParent(decoded.email, decoded.phone),
  ]);
  const profile = buildFamilyProfile(rows, key);
  if (profile) {
    for (const child of profile.children) {
      const entry = levels.get(child.childFirstName.trim().toLowerCase());
      child.level = entry?.level ?? "";
    }
  }
  return profile;
}

/** Collapse a flat list of rows into one directory entry per family. Carries the
 *  per-child birth years + first/last-attended dates the directory filters on. */
export function buildFamilyDirectory(
  rows: DropInRegistration[],
): FamilyDirectoryEntry[] {
  const byFamily = new Map<string, FamilyDirectoryEntry>();
  for (const r of rows) {
    const key = encodeParentKey(r.parentEmail, r.parentPhone);
    if (!key) continue;
    const entry =
      byFamily.get(key) ??
      {
        key,
        parentName: r.parentName || r.parentEmail || r.parentPhone || "Unknown",
        childNames: [] as string[],
        children: [] as FamilyDirectoryChild[],
        lastSessionDate: "",
        lastAttendedDate: "",
        firstSessionDate: "",
        registrations: 0,
      };
    entry.registrations += 1;
    if (r.childFirstName && !entry.childNames.includes(r.childFirstName)) {
      entry.childNames.push(r.childFirstName);
    }
    if (r.childFirstName) {
      const existing = entry.children.find(
        (c) => c.name.toLowerCase() === r.childFirstName.toLowerCase(),
      );
      if (existing) {
        if (!existing.birthYear && r.childBirthYear > 0) existing.birthYear = r.childBirthYear;
      } else {
        entry.children.push({ name: r.childFirstName, birthYear: r.childBirthYear || 0 });
      }
    }
    if (r.sessionDate > entry.lastSessionDate) entry.lastSessionDate = r.sessionDate;
    if (r.sessionDate && (!entry.firstSessionDate || r.sessionDate < entry.firstSessionDate)) {
      entry.firstSessionDate = r.sessionDate;
    }
    if (
      r.attendance === "Present" &&
      r.sessionDate > entry.lastAttendedDate
    ) {
      entry.lastAttendedDate = r.sessionDate;
    }
    byFamily.set(key, entry);
  }
  return Array.from(byFamily.values()).sort((a, b) =>
    a.lastSessionDate < b.lastSessionDate ? 1 : -1,
  );
}
