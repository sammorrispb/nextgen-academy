import { createHmac } from "node:crypto";
import { MVF_JUNIOR_SERIES } from "@/data/mvf-junior-series";
import { seriesEventKey } from "@/data/mvf-series-registration";
import {
  buildMvfRosterSyncBody,
  buildMvfSeriesRosterSyncBody,
  MVF_TOURNAMENT_LD_EVENT_KEYS,
  mvfSeriesLdEventKey,
  type MvfRosterSyncBody,
} from "@/lib/linkdink-roster-sync";
import { EMAIL_RE, NOTION_API, NOTION_VERSION, readPlainText } from "@/lib/notion-utils";

// Server-only by construction: node:crypto and server credentials must never
// become a client import. Only the internal route imports this reader.
// This is deliberately separate from the fail-soft roster/payment writers:
// an incomplete source must never look like a complete parent audience.
const MAX_PAGES = 20;
const LOOKUP_TIMEOUT_MS = 8000;
const SYNC_KEY_RE = /^nga:[A-Za-z0-9_-]{22}$/;
const REGISTRATION_REF_RE = /^nga-notion-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const DB_ID_RE = /^(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i;
const OCTOBER_DB_ENV = "NOTION_MVF_TOURNAMENT_REGS_DB_ID";
const SERIES_DB_ENV = "NOTION_MVF_SERIES_REGS_DB_ID";

/**
 * Where one L&D event key's parents live. October (10U/14U, Oct 24 2026) reads
 * its own registrations DB, where Pending rows had an invoice out and were
 * already seated on the roster at invoice time. The November-onward series
 * (12U/16U) reads the series DB and only Confirmed + Paid rows: the series
 * webhook seats a child on L&D only once the seat is published as paid, so a
 * Pending or Review-required row is never on the roster this audience mirrors.
 */
interface ContactSource {
  dbEnv: typeof OCTOBER_DB_ENV | typeof SERIES_DB_ENV;
  division: string;
  statuses: readonly string[];
  /** Series only: the row's own ledger key, e.g. mvf-junior-tournament-november-2026-12u. */
  seriesEventKey?: string;
  syncBody: (email: string, first: string, last: string) => MvfRosterSyncBody | null;
}

/** Every accepted L&D key, derived from the tournament data, never listed by hand. */
const SOURCES: ReadonlyMap<string, ContactSource> = new Map<string, ContactSource>([
  ...(["10u", "14u"] as const).map((division): [string, ContactSource] => [MVF_TOURNAMENT_LD_EVENT_KEYS[division], {
    dbEnv: OCTOBER_DB_ENV, division, statuses: ["Pending", "Confirmed"],
    syncBody: (parentEmail, childFirstName, childLastName) =>
      buildMvfRosterSyncBody({ division, parentEmail, childFirstName, childLastName }),
  }]),
  ...MVF_JUNIOR_SERIES.flatMap((event) => event.divisions.flatMap(({ slug: division }): [string, ContactSource][] => {
    const ldKey = mvfSeriesLdEventKey(event.slug, division);
    return ldKey ? [[ldKey, {
      dbEnv: SERIES_DB_ENV, division, statuses: ["Confirmed"], seriesEventKey: seriesEventKey(event.slug, division),
      syncBody: (parentEmail, childFirstName, childLastName) =>
        buildMvfSeriesRosterSyncBody({ event: event.slug, division, parentEmail, childFirstName, childLastName }),
    }]] : [];
  })),
]);

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

function normalizedDbId(value: string | undefined): string | null {
  return value && DB_ID_RE.test(value) ? value.replaceAll("-", "").toLowerCase() : null;
}

/** The base credentials, plus each registrations DB that is validly configured.
 * The series DB is refused if it names the October DB: the two hold different
 * divisions under different status rules, and one must never stand in for the other. */
function configuration() {
  const notionKey = process.env.NOTION_API_KEY;
  const syncSecret = process.env.NGA_SYNC_SECRET;
  if (process.env.VERCEL_ENV !== "production" || !notionKey || !syncSecret) return null;
  const october = normalizedDbId(process.env[OCTOBER_DB_ENV]);
  const series = normalizedDbId(process.env[SERIES_DB_ENV]);
  const dbs: Partial<Record<ContactSource["dbEnv"], string>> = {};
  if (october) dbs[OCTOBER_DB_ENV] = october;
  if (series && series !== october) dbs[SERIES_DB_ENV] = series;
  return Object.keys(dbs).length ? { notionKey, syncSecret, dbs } : null;
}

/** Without a key: is any contact source usable. With one: is that key's own source. */
export function mvfParentContactsConfigured(eventKey?: string): boolean {
  const config = configuration();
  if (!config) return false;
  if (eventKey === undefined) return true;
  const source = SOURCES.get(eventKey);
  return Boolean(source && config.dbs[source.dbEnv]);
}

function registrationPageId(reference: string): string | null {
  return REGISTRATION_REF_RE.exec(reference)?.[1].replaceAll("-", "").toLowerCase() ?? null;
}

export function isMvfParentContactRequest(input: unknown): input is MvfParentContactRequest {
  if (!record(input) || Object.keys(input).some((key) => !["event_key", "sync_keys", "registration_refs"].includes(key)) ||
    typeof input.event_key !== "string" ||
    !SOURCES.has(input.event_key) || !Array.isArray(input.sync_keys) || input.sync_keys.length > 100) return false;
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

function parentContact(page: unknown, dbId: string, source: ContactSource, secret: string) {
  if (!record(page) || typeof page.id !== "string" || !record(page.parent) ||
    typeof page.parent.database_id !== "string" ||
    page.parent.database_id.replaceAll("-", "").toLowerCase() !== dbId ||
    !record(page.properties)) throw new MvfParentContactLookupError();
  if (page.archived || page.in_trash) return null;
  const p = page.properties as Record<string, {
    select?: { name?: string } | null;
    email?: string | null;
    checkbox?: boolean;
    rich_text?: { plain_text?: string }[];
  }>;
  const status = p.Status?.select?.name;
  if (p.Division?.select?.name !== source.division.toUpperCase() ||
    typeof status !== "string" || !source.statuses.includes(status)) return null;
  // A series seat is on the L&D roster only once it is published as paid, and
  // one series DB holds every month, so the row must name this tournament too.
  if (source.seriesEventKey !== undefined &&
    (p.Paid?.checkbox !== true || readPlainText(p["Event Key"]) !== source.seriesEventKey)) return null;
  const rawEmail = p["Parent Email"]?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  const body = source.syncBody(email, readPlainText(p["Child First Name"]), readPlainText(p["Child Last Name"]));
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

function sourceFilter(source: ContactSource) {
  const statuses = source.statuses.map((status) => ({ property: "Status", select: { equals: status } }));
  return { and: [
    ...(source.seriesEventKey !== undefined
      ? [{ property: "Event Key", rich_text: { equals: source.seriesEventKey } }] : []),
    { property: "Division", select: { equals: source.division.toUpperCase() } },
    statuses.length === 1 ? statuses[0] : { or: statuses },
  ] };
}

export async function readMvfParentContacts(
  eventKey: string,
  syncKeys: string[],
  registrationRefs: MvfParentContactReference[] = [],
): Promise<MvfParentContacts> {
  const config = configuration();
  const source = SOURCES.get(eventKey);
  const dbId = source ? config?.dbs[source.dbEnv] : undefined;
  if (!config || !source || !dbId || !isMvfParentContactRequest({ event_key: eventKey, sync_keys: syncKeys, registration_refs: registrationRefs })) {
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
      const response = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
        method: "POST", headers: { Authorization: `Bearer ${config.notionKey}`,
          "Content-Type": "application/json", "Notion-Version": NOTION_VERSION },
        body: JSON.stringify({ filter: sourceFilter(source), page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
        cache: "no-store", redirect: "error", signal,
      });
      if (!response.ok) throw new MvfParentContactLookupError();
      const data: unknown = await response.json();
      if (!record(data) || !Array.isArray(data.results) || data.results.length > 100 ||
        typeof data.has_more !== "boolean") throw new MvfParentContactLookupError();
      for (const page of data.results) {
        const contact = parentContact(page, dbId, source, config.syncSecret);
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
