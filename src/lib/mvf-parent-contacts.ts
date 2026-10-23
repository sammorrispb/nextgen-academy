import { createHmac } from "node:crypto";
import { buildMvfRosterSyncBody, MVF_TOURNAMENT_LD_EVENT_KEYS } from "@/lib/linkdink-roster-sync";
import { EMAIL_RE, NOTION_API, NOTION_VERSION, readPlainText } from "@/lib/notion-utils";

// Server-only by construction: node:crypto and server credentials must never
// become a client import. Only the internal route imports this reader.
// This is deliberately separate from the fail-soft roster/payment writers:
// an incomplete source must never look like a complete parent audience.
const MAX_PAGES = 20;
const LOOKUP_TIMEOUT_MS = 8000;
const SYNC_KEY_RE = /^nga:[A-Za-z0-9_-]{22}$/;
const REGISTRATION_REF_RE = /^nga-notion-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export interface MvfParentContactReference {
  sync_key: string;
  registration_ref: string;
}

interface MvfParentContactRequest {
  event_key: string;
  sync_keys: string[];
  registration_refs?: MvfParentContactReference[];
}

export interface MvfParentContacts {
  contacts: { sync_key: string; email: string }[];
  missing_sync_keys: string[];
}

export class MvfParentContactLookupError extends Error {
  constructor() { super("contact_lookup_failed"); }
}

function configuration() {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID;
  const syncSecret = process.env.NGA_SYNC_SECRET;
  if (process.env.VERCEL_ENV !== "production" || !notionKey || !syncSecret ||
    !dbId || !/^(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(dbId)) return null;
  return { notionKey, dbId, syncSecret };
}

export function mvfParentContactsConfigured(): boolean {
  return configuration() !== null;
}

function divisionFor(eventKey: string): "10u" | "14u" | null {
  if (eventKey === MVF_TOURNAMENT_LD_EVENT_KEYS["10u"]) return "10u";
  if (eventKey === MVF_TOURNAMENT_LD_EVENT_KEYS["14u"]) return "14u";
  return null;
}

function registrationPageId(reference: string): string | null {
  return REGISTRATION_REF_RE.exec(reference)?.[1].replaceAll("-", "").toLowerCase() ?? null;
}

export function isMvfParentContactRequest(input: unknown): input is MvfParentContactRequest {
  if (!record(input) || Object.keys(input).some((key) => !["event_key", "sync_keys", "registration_refs"].includes(key)) ||
    typeof input.event_key !== "string" ||
    !divisionFor(input.event_key) || !Array.isArray(input.sync_keys) || input.sync_keys.length > 100) return false;
  const keys = new Set(input.sync_keys);
  if (!input.sync_keys.every((key) => typeof key === "string" && SYNC_KEY_RE.test(key)) || keys.size !== input.sync_keys.length) return false;
  if (!Object.hasOwn(input, "registration_refs")) return true;
  if (!Array.isArray(input.registration_refs) || input.registration_refs.length > 100) return false;
  const seenKeys = new Set<string>();
  const seenPages = new Set<string>();
  for (const reference of input.registration_refs) {
    if (!record(reference) || Object.keys(reference).length !== 2 || typeof reference.sync_key !== "string" ||
      !keys.has(reference.sync_key) || typeof reference.registration_ref !== "string") return false;
    const pageId = registrationPageId(reference.registration_ref);
    if (!pageId || seenKeys.has(reference.sync_key) || seenPages.has(pageId)) return false;
    seenKeys.add(reference.sync_key);
    seenPages.add(pageId);
  }
  return true;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parentContact(page: unknown, dbId: string, division: "10u" | "14u", secret: string) {
  if (!record(page) || typeof page.id !== "string" || !record(page.parent) ||
    typeof page.parent.database_id !== "string" ||
    page.parent.database_id.replaceAll("-", "").toLowerCase() !== dbId.replaceAll("-", "").toLowerCase() ||
    !record(page.properties)) throw new MvfParentContactLookupError();
  if (page.archived || page.in_trash) return null;
  const p = page.properties as Record<string, {
    select?: { name?: string } | null;
    email?: string | null;
    rich_text?: { plain_text?: string }[];
  }>;
  if (p.Division?.select?.name !== division.toUpperCase() ||
    (p.Status?.select?.name !== "Pending" && p.Status?.select?.name !== "Confirmed")) return null;
  const rawEmail = p["Parent Email"]?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  const body = buildMvfRosterSyncBody({ division, parentEmail: email,
    childFirstName: readPlainText(p["Child First Name"]), childLastName: readPlainText(p["Child Last Name"]) });
  // Exact counterpart of L&D's ngaSyncKey. Clean names first, as the original
  // sync did, then use its email/first/last normalization and domain separation.
  // A stable private page reference needs no child's spelling to deliver to
  // that registration's parent; an unusable name still cannot match a legacy key.
  let syncKey: string | null = null;
  if (body?.first_name) {
    const material = [body.email, body.first_name, body.last_name].map((part) => part.trim().toLowerCase()).join("|");
    const digest = createHmac("sha256", secret).update(`nga-roster-sync:${material}`).digest("base64url");
    syncKey = `nga:${digest.slice(0, 22)}`;
  }
  return { page_id: page.id.replaceAll("-", "").toLowerCase(), sync_key: syncKey, email };
}

export async function readMvfParentContacts(
  eventKey: string,
  syncKeys: string[],
  registrationRefs: MvfParentContactReference[] = [],
): Promise<MvfParentContacts> {
  const config = configuration();
  const division = divisionFor(eventKey);
  if (!config || !division || !isMvfParentContactRequest({ event_key: eventKey, sync_keys: syncKeys, registration_refs: registrationRefs })) {
    throw new MvfParentContactLookupError();
  }
  if (syncKeys.length === 0) return { contacts: [], missing_sync_keys: [] };
  const requested = new Set(syncKeys);
  const referencedKeys = new Set(registrationRefs.map((reference) => reference.sync_key));
  const keyByPage = new Map(registrationRefs.map((reference) => [registrationPageId(reference.registration_ref)!, reference.sync_key]));
  const contacts = new Map<string, string>();
  const addContact = (key: string, email: string) => {
    const existing = contacts.get(key);
    if (existing && existing !== email) throw new MvfParentContactLookupError();
    contacts.set(key, email);
  };
  const cursors = new Set<string>();
  const signal = AbortSignal.timeout(LOOKUP_TIMEOUT_MS);
  let cursor: string | undefined;
  try {
    for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
      const response = await fetch(`${NOTION_API}/databases/${config.dbId}/query`, {
        method: "POST", headers: { Authorization: `Bearer ${config.notionKey}`,
          "Content-Type": "application/json", "Notion-Version": NOTION_VERSION },
        body: JSON.stringify({ filter: { and: [
          { property: "Division", select: { equals: division.toUpperCase() } },
          { or: [{ property: "Status", select: { equals: "Pending" } }, { property: "Status", select: { equals: "Confirmed" } }] },
        ] }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
        cache: "no-store", redirect: "error", signal,
      });
      if (!response.ok) throw new MvfParentContactLookupError();
      const data: unknown = await response.json();
      if (!record(data) || !Array.isArray(data.results) || data.results.length > 100 ||
        typeof data.has_more !== "boolean") throw new MvfParentContactLookupError();
      for (const page of data.results) {
        const contact = parentContact(page, config.dbId, division, config.syncSecret);
        if (!contact) continue;
        const referenceKey = keyByPage.get(contact.page_id);
        if (referenceKey) addContact(referenceKey, contact.email);
        // Explicit provenance is authoritative for this key. If its row is
        // missing/ineligible, never fall back to a coincident legacy match.
        if (contact.sync_key && requested.has(contact.sync_key) && !referencedKeys.has(contact.sync_key)) {
          addContact(contact.sync_key, contact.email);
        }
      }
      if (!data.has_more) {
        return { contacts: syncKeys.flatMap((sync_key) => {
          const email = contacts.get(sync_key);
          return email ? [{ sync_key, email }] : [];
        }), missing_sync_keys: syncKeys.filter((key) => !contacts.has(key)) };
      }
      if (typeof data.next_cursor !== "string" || !data.next_cursor || cursors.has(data.next_cursor)) {
        throw new MvfParentContactLookupError();
      }
      cursor = data.next_cursor;
      cursors.add(cursor);
    }
    throw new MvfParentContactLookupError();
  } catch {
    // Provider bodies/exceptions can contain parent contacts, child data or
    // credentials. Neither logging nor the response may include any of them.
    throw new MvfParentContactLookupError();
  }
}
