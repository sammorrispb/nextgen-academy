import { parseSubmissionId, submissionKeyFor } from "@/lib/submission-key";
import type { MvfJuniorTournamentData, MvfJuniorTournamentErrors } from "@/lib/validate-mvf-junior-tournament";

export const MVF_DRAFT_KEY = "nga:mvf-2026-10-24:registration:v1";
export const MVF_DRAFT_TTL_MS = 30 * 60 * 1000;
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const TEXT_FIELDS = ["division", "parentName", "email", "phone", "childFirstName", "childLastName"] as const;
type FormDraft = Pick<MvfJuniorTournamentData, typeof TEXT_FIELDS[number] | "resident">;
type Session = { version: 1; expiresAt: number; draft?: FormDraft; keys: Record<string, string>; lastAttempt?: string };
const HASH_RE = /^[a-f0-9]{64}$/;

export function emptyMvfForm(): MvfJuniorTournamentData {
  return {
    division: "", resident: true, parentName: "", email: "", phone: "",
    childFirstName: "", childLastName: "", childDob: "",
    emergencyName: "", emergencyPhone: "", allergies: "", smsConsent: false,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function draftFor(value: unknown): FormDraft | undefined {
  if (!record(value) || typeof value.resident !== "boolean") return;
  if (TEXT_FIELDS.some((field) => typeof value[field] !== "string" || (value[field] as string).length > 2000)) return;
  return Object.fromEntries([
    ...TEXT_FIELDS.map((field) => [field, value[field]]), ["resident", value.resident],
  ]) as FormDraft;
}

export function clearMvfSession(storage?: DraftStorage): void {
  try { storage?.removeItem(MVF_DRAFT_KEY); } catch { /* Private/blocked storage is optional. */ }
}

function readSession(storage: DraftStorage | undefined, now: number): Session | undefined {
  try {
    const raw = storage?.getItem(MVF_DRAFT_KEY);
    if (!raw) return;
    if (raw.length > 100_000) throw new Error("Invalid draft");
    const data: unknown = JSON.parse(raw);
    if (!record(data) || data.version !== 1 || typeof data.expiresAt !== "number" || !Number.isFinite(data.expiresAt) || data.expiresAt <= now || data.expiresAt > now + MVF_DRAFT_TTL_MS || !record(data.keys)) throw new Error("Invalid draft");
    const keys: Record<string, string> = {};
    for (const [hash, id] of Object.entries(data.keys)) {
      if (!HASH_RE.test(hash) || !parseSubmissionId(id)) throw new Error("Invalid retry key");
      keys[hash] = id as string;
    }
    if (data.lastAttempt !== undefined && (typeof data.lastAttempt !== "string" || !HASH_RE.test(data.lastAttempt) || !keys[data.lastAttempt])) throw new Error("Invalid retry key");
    const draft = data.draft === undefined ? undefined : draftFor(data.draft);
    if (data.draft !== undefined && !draft) throw new Error("Invalid draft");
    const session: Session = { version: 1, expiresAt: data.expiresAt, draft, keys, lastAttempt: data.lastAttempt as string | undefined };
    // Rewriting strips fields left by an older draft version immediately.
    if (JSON.stringify(session) !== raw) writeSession(storage, session);
    return session;
  } catch {
    clearMvfSession(storage);
  }
}

function writeSession(storage: DraftStorage | undefined, session: Session): void {
  try { storage?.setItem(MVF_DRAFT_KEY, JSON.stringify(session)); } catch { /* Keep the in-page retry key when storage is unavailable. */ }
}

function sessionFor(storage: DraftStorage | undefined, now: number): Session {
  return readSession(storage, now) ?? { version: 1, expiresAt: now + MVF_DRAFT_TTL_MS, keys: {} };
}

export function readMvfDraft(storage?: DraftStorage, now = Date.now()): { form: MvfJuniorTournamentData; lastAttempt?: string } | null {
  const session = readSession(storage, now);
  if (!session?.draft) return null;
  return { form: { ...emptyMvfForm(), ...session.draft }, lastAttempt: session.lastAttempt };
}

export function saveMvfDraft(storage: DraftStorage | undefined, form: MvfJuniorTournamentData, now = Date.now()): number {
  const session = sessionFor(storage, now);
  session.draft = draftFor(form);
  writeSession(storage, session);
  return session.expiresAt;
}

export function clearMvfDraft(storage?: DraftStorage, now = Date.now()): void {
  const session = readSession(storage, now);
  if (!session) return;
  // Keep opaque retry keys until expiry: starting over must not accidentally
  // send a second invoice if the parent enters the same registration again.
  delete session.draft;
  delete session.lastAttempt;
  writeSession(storage, session);
}

export async function rememberMvfSubmission(
  issued: Map<string, string>,
  form: MvfJuniorTournamentData,
  storage?: DraftStorage,
  recoveryFingerprint?: string,
  now = Date.now(),
): Promise<boolean> {
  const snapshot = JSON.stringify(form);
  // Persist hashes, never raw request snapshots (which include medical notes).
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(snapshot));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (recoveryFingerprint && recoveryFingerprint !== fingerprint) return false;
  const session = sessionFor(storage, now);
  const previous = session.keys[fingerprint];
  if (previous) issued.set(snapshot, previous);
  const id = submissionKeyFor(issued, form);
  session.keys[fingerprint] = id;
  session.lastAttempt = fingerprint;
  writeSession(storage, session);
  return true;
}

export function focusMvfError(errors: MvfJuniorTournamentErrors, document: { getElementById(id: string): { focus(): void } | null }): void {
  const first = Object.keys(errors)[0];
  if (!first) return;
  const id = first === "division" ? "mt-division-10u" : first === "resident" ? "mt-resident-yes" : `mt-${first}`;
  document.getElementById(id)?.focus();
}
