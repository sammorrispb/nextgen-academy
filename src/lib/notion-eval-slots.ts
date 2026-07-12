// NGA Eval Slots — the Notion db behind parent self-serve eval booking
// (admin-reduction roadmap Phase 1a). Sam bulk-types Open slots; the public
// /free-evaluation/book page lists them (5-min ISR) and POST /api/eval-book
// claims one.
//
// STATUS LIFECYCLE (flow change 2026-07-02 — Sam's call): a parent booking is
// a REQUEST, not a booking. Open → (public claim) → Requested → (Sam's
// coach-portal confirm at /coach/eval-requests) → Booked, or → (release) →
// Open. The parent gets a request-received email at claim time; the REAL
// confirmation (+ .ics + CRM Eval-Date stamp) fires only when Sam confirms.
//
// Notion has no transactions (no CAS), so claiming is CLAIM-THEN-VERIFY with
// a per-claim BOOKING TOKEN: pre-check the row is still Open, in OUR Eval
// Slots db, and in the future (never overwrite a claimed row — this is what
// makes the page's 5-min ISR staleness safe); write the booking fields +
// Status=Requested + a fresh random "Booking Id"; wait ~500ms; then RE-READ the
// row and verify Booking Id is OURS (email is deliberately NOT the identity
// check — two families can share an inbox, and an attacker-controlled page
// could echo any email). If a concurrent claimer won the write race, the
// re-read shows their token and we return "slot_taken" (the loser path) —
// never a confirmation sent for a slot someone else holds.
//
// RESIDUAL RACE (unavoidable without CAS): if claimer B's pre-check read Open
// before A's PATCH landed, AND B's PATCH lands after A's verify re-read
// (>~500ms later), both verifies can see their own token and both win. The
// 500ms delay shrinks that window to near-zero; if it ever fires, the admin
// booking-notification email carries slot id + booking id for BOTH bookings,
// so the double-book is visible and reconcilable in the inbox + Notion row.

import { randomUUID } from "crypto";
import { to12Hour } from "./eval-confirmation-send";
import { readPlainText } from "./notion-utils";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function slotsDbId(): string | null {
  return process.env.NOTION_EVAL_SLOTS_DB_ID || null;
}

function headers(notionKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${notionKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

export interface OpenEvalSlot {
  id: string;
  /** "YYYY-MM-DD" wall date, taken from the ISO string — never via Date math. */
  date: string;
  /** "5:30 PM" */
  startTime: string;
  /** "6:00 PM" — start + 30 min when the Notion row has no end time. */
  endTime: string;
  location: string;
}

export interface EvalSlotBooking {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirst: string;
  level: string;
}

export type ClaimEvalSlotResult =
  | { ok: true; slot: OpenEvalSlot; bookingId: string }
  | { ok: false; reason: "slot_taken" }
  | { ok: false; reason: "error"; detail: string };

const EVAL_DEFAULT_MINUTES = 30;

/**
 * Derive booking-display times from Notion date strings WITHOUT constructing
 * Date objects (the date-only/UTC off-by-one trap). Notion returns the wall
 * time with its offset (e.g. "2026-07-10T17:30:00.000-04:00"); we read the
 * date and clock digits straight off the string. Returns null when the slot
 * has no time component (a date-only row can't be booked).
 */
export function parseSlotTimes(
  start: string | null | undefined,
  end: string | null | undefined,
): { date: string; startTime: string; endTime: string } | null {
  if (!start || start.length < 16 || start[10] !== "T") return null;
  const date = start.slice(0, 10);
  const startTime = to12Hour(start.slice(11, 16));
  if (!startTime) return null;

  let endTime: string | null = null;
  if (end && end.length >= 16 && end[10] === "T") {
    endTime = to12Hour(end.slice(11, 16));
  }
  if (!endTime) {
    // No end on the row → default a 30-minute eval, by pure clock arithmetic.
    const h = parseInt(start.slice(11, 13), 10);
    const m = parseInt(start.slice(14, 16), 10);
    const total = (h * 60 + m + EVAL_DEFAULT_MINUTES) % (24 * 60);
    endTime = to12Hour(
      `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`,
    );
  }
  if (!endTime) return null;
  return { date, startTime, endTime };
}

// ── Notion row parsing ──────────────────────────────────────────────

interface NotionSlotPage {
  id: string;
  archived?: boolean;
  in_trash?: boolean;
  parent?: { type?: string; database_id?: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>;
}

function readSlot(page: NotionSlotPage): OpenEvalSlot | null {
  const props = page.properties ?? {};
  const dateProp = props["Date"]?.date;
  const times = parseSlotTimes(dateProp?.start, dateProp?.end);
  const location: string = props["Location"]?.select?.name ?? "";
  if (!times || !location) return null;
  return { id: page.id, ...times, location };
}

function readStatus(page: NotionSlotPage): string {
  return page.properties?.["Status"]?.select?.name ?? "";
}

function readBookingId(page: NotionSlotPage): string {
  return readPlainText(page.properties?.["Booking Id"]).trim();
}

/** Notion mixes dashed and bare-hex forms of the same id — compare normalized. */
function normalizeNotionId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

/** Epoch ms of the slot's start instant (the Notion string carries its own
 * offset, so Date.parse is an instant compare — no date-only/UTC trap). */
function readStartMs(page: NotionSlotPage): number {
  const start = page.properties?.["Date"]?.date?.start;
  return typeof start === "string" ? Date.parse(start) : NaN;
}

// ── Reads ───────────────────────────────────────────────────────────

export interface FetchOpenEvalSlotsResult {
  slots: OpenEvalSlot[];
  /** TRUE only on a real fetch failure (env missing is fail-soft empty, not
   * an error) — lets callers distinguish "couldn't load times" (show retry)
   * from "genuinely no open times" (show the contact fallback). */
  error: boolean;
}

/**
 * Safety ceilings on the open-slots pagination loop so a runaway (a Notion db
 * that never stops reporting has_more) can't spin forever. Sam bulk-types
 * eval slots by hand, so hundreds is realistic and 100s is not — 10 pages ×
 * 100 = 1000 rows is a generous headroom that still bounds the loop. Hitting a
 * ceiling is LOGGED, never silently swallowed (no-silent-caps convention).
 */
export const OPEN_SLOTS_MAX_PAGES = 10;
export const OPEN_SLOTS_MAX_ROWS = 1000;

/** Query body for the public open-slots picker: future Open rows, soonest
 * first, one 100-row page, with an optional pagination cursor. `nowIso` is
 * pinned once by the caller so every page filters against the SAME instant
 * (an on_or_after that drifted per page could skip a boundary slot). */
function buildOpenEvalSlotsQuery(nowIso: string, cursor?: string) {
  return {
    filter: {
      and: [
        { property: "Status", select: { equals: "Open" } },
        { property: "Date", date: { on_or_after: nowIso } },
      ],
    },
    sorts: [{ property: "Date", direction: "ascending" }],
    page_size: 100,
    ...(cursor ? { start_cursor: cursor } : {}),
  };
}

/**
 * Future Open slots, soonest first. Follows has_more/next_cursor until the db
 * is exhausted (or a logged safety ceiling), so the WHOLE open backlog
 * surfaces on the picker — not just the soonest 100 (the display-cap bug: Sam
 * loaded 180 slots and the last 80 stayed invisible until earlier ones
 * cleared).
 *
 * Fail-soft on missing env (empty list, no error — the page renders its
 * no-open-slots state). PARTIAL-SUCCESS on a later-page failure: the FIRST
 * page holds the soonest slots (the ones parents actually book), so if page 2+
 * fails we return what we've already fetched with `error: false` and log it —
 * showing the soonest 100 beats a false "No open times" empty state (which the
 * ISR-cached page would then serve). ONLY a first-page failure (nothing
 * accumulated) returns `{ slots: [], error: true }`, preserving the GET-503 /
 * retry contract for the total-outage case. An abnormal truncation
 * (has_more:true but no usable next_cursor) is treated the same way — keep the
 * partial, warn, stop (never a silent truncation).
 */
export async function fetchOpenEvalSlots(): Promise<FetchOpenEvalSlotsResult> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = slotsDbId();
  if (!notionKey || !dbId) return { slots: [], error: false };

  const nowIso = new Date().toISOString();
  const slots: OpenEvalSlot[] = [];
  let cursor: string | undefined;
  let pages = 0;

  try {
    do {
      const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
        method: "POST",
        headers: headers(notionKey),
        body: JSON.stringify(buildOpenEvalSlotsQuery(nowIso, cursor)),
      });
      if (!res.ok) {
        if (slots.length === 0) {
          // First page failed — nothing to show; signal error → GET 503/retry.
          console.error(`[eval-slots] query failed (${res.status})`);
          return { slots: [], error: true };
        }
        // A later page failed — keep the soonest slots already fetched rather
        // than blanking the picker. Never silent.
        console.warn(
          `[eval-slots] later page failed (${res.status}) after ${pages} page(s) — returning the ${slots.length} slot(s) already fetched`,
        );
        break;
      }
      const data = (await res.json()) as {
        results?: NotionSlotPage[];
        has_more?: boolean;
        next_cursor?: string | null;
      };
      for (const slot of (data.results ?? []).map(readSlot)) {
        if (slot) slots.push(slot);
      }
      pages++;

      const hasMore = data.has_more === true;
      const nextCursor = data.next_cursor || null;
      if (hasMore && !nextCursor) {
        // Abnormal: the db says there's more but gave us no cursor to fetch it.
        // Treat as a truncation — keep the partial, warn, stop (no silent cap).
        console.warn(
          `[eval-slots] has_more=true but no next_cursor after ${pages} page(s) — stopping with ${slots.length} slot(s) (possible truncation)`,
        );
        break;
      }
      cursor = hasMore ? nextCursor ?? undefined : undefined;

      if (cursor && (pages >= OPEN_SLOTS_MAX_PAGES || slots.length >= OPEN_SLOTS_MAX_ROWS)) {
        console.warn(
          `[eval-slots] pagination ceiling hit (${pages} pages, ${slots.length} rows) — more Open slots remain unshown; raise OPEN_SLOTS_MAX_PAGES/ROWS or prune stale slots`,
        );
        break;
      }
    } while (cursor);

    return { slots, error: false };
  } catch (err) {
    if (slots.length === 0) {
      console.error("[eval-slots] query error:", err);
      return { slots: [], error: true };
    }
    // Mid-pagination throw after earlier pages landed — same partial-success
    // stance as a later-page HTTP failure.
    console.warn(
      `[eval-slots] later page errored after ${pages} page(s) — returning the ${slots.length} slot(s) already fetched:`,
      err,
    );
    return { slots, error: false };
  }
}

// ── Claim (claim-then-verify) ───────────────────────────────────────

async function getSlotPage(
  notionKey: string,
  slotId: string,
): Promise<NotionSlotPage | null> {
  const res = await fetch(`${NOTION_API}/pages/${slotId}`, {
    method: "GET",
    headers: headers(notionKey),
  });
  if (!res.ok) return null;
  return (await res.json()) as NotionSlotPage;
}

// How long the claimer waits between its claim write and its verify re-read.
// A concurrent claimer's PATCH almost always lands inside this window, so the
// verify sees THEIR Booking Id and we lose cleanly (see the residual-race
// note in the header comment).
const VERIFY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function claimEvalSlot(
  slotId: string,
  booking: EvalSlotBooking,
): Promise<ClaimEvalSlotResult> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = slotsDbId();
  if (!notionKey || !dbId) {
    return { ok: false, reason: "error", detail: "eval-slots env not configured" };
  }

  try {
    // 1. Pre-check: the row must still be Open. A Requested/Booked row (the
    //    common ISR-staleness case) is NEVER overwritten.
    const before = await getSlotPage(notionKey, slotId);
    if (!before) {
      // Nonexistent / unreadable / unshared page — the SAME generic
      // slot_taken as every other unbookable case (no readability oracle:
      // a prober can't distinguish "can't read" from "readable but taken").
      return { ok: false, reason: "slot_taken" };
    }
    // Fail-safe gates — ALL of them answer with the same generic slot_taken
    // the genuinely-taken path returns, so a probing caller can't distinguish
    // "exists but not bookable" from "taken" (no existence/membership oracle):
    //  - the page must live IN the Eval Slots db (a valid page id from any
    //    other db the integration can read is NOT a slot and must never be
    //    written to),
    //  - it must be live (not archived/trashed) and Open,
    //  - its start must be strictly in the future (same instant-compare
    //    discipline as fetchOpenEvalSlots' on_or_after filter).
    const parentDb = before.parent?.database_id ?? "";
    if (!parentDb || normalizeNotionId(parentDb) !== normalizeNotionId(dbId)) {
      return { ok: false, reason: "slot_taken" };
    }
    if (before.archived || before.in_trash || readStatus(before) !== "Open") {
      return { ok: false, reason: "slot_taken" };
    }
    const startMs = readStartMs(before);
    if (!Number.isFinite(startMs) || startMs <= Date.now()) {
      return { ok: false, reason: "slot_taken" };
    }

    // 2. Claim write, carrying a fresh per-claim booking token. Child data =
    //    first name + level ONLY.
    const bookingId = randomUUID();
    const patch = await fetch(`${NOTION_API}/pages/${slotId}`, {
      method: "PATCH",
      headers: headers(notionKey),
      body: JSON.stringify({
        properties: {
          Status: { select: { name: "Requested" } },
          "Booking Id": {
            rich_text: [{ text: { content: bookingId } }],
          },
          "Parent Name": {
            rich_text: [{ text: { content: booking.parentName } }],
          },
          "Parent Email": { email: booking.parentEmail },
          "Parent Phone": { phone_number: booking.parentPhone },
          "Child First Name": {
            rich_text: [{ text: { content: booking.childFirst } }],
          },
          Level: { select: { name: booking.level } },
          "Booked At": { date: { start: new Date().toISOString() } },
        },
      }),
    });
    if (!patch.ok) {
      return { ok: false, reason: "error", detail: `claim write failed (${patch.status})` };
    }

    // 3. Verify (after a short delay so a concurrent claim's write lands
    //    first): re-read and confirm the row holds OUR Booking Id. A mismatch
    //    means a concurrent claimer won — loser path returns slot_taken
    //    (their booking stands, ours goes dark).
    await sleep(VERIFY_DELAY_MS);
    const after = await getSlotPage(notionKey, slotId);
    if (!after) {
      return { ok: false, reason: "error", detail: "verify read failed" };
    }
    if (readBookingId(after) !== bookingId) {
      return { ok: false, reason: "slot_taken" };
    }

    const slot = readSlot(after);
    if (!slot) {
      return { ok: false, reason: "error", detail: "slot missing date/time/location" };
    }
    return { ok: true, slot, bookingId };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      detail: err instanceof Error ? err.message : "unknown error",
    };
  }
}

export type ReleaseEvalSlotResult = "released" | "kept_foreign" | "failed";

/**
 * Best-effort CONDITIONAL release, used two ways: (a) rollback when the
 * request-received email fails AFTER a successful claim, and (b) Sam's
 * release/reschedule action in the /coach/eval-requests queue. Re-reads the
 * row, and ONLY when it still holds OUR bookingId re-opens it and clears the
 * booking fields.
 *
 * If the re-read shows a DIFFERENT Booking Id, a residual-race winner now
 * owns the row — leave it exactly as-is ("kept_foreign"): clearing it would
 * destroy THEIR valid booking, and their family must hear nothing from our
 * failed request. Fail-soft — "failed" leaves a Booked row Sam will see in
 * Notion (and the admin notify email carries slot id + booking id for
 * reconciliation).
 */
export async function releaseEvalSlot(
  slotId: string,
  bookingId: string,
): Promise<ReleaseEvalSlotResult> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return "failed";
  try {
    const current = await getSlotPage(notionKey, slotId);
    if (!current) return "failed";
    if (readBookingId(current) !== bookingId) {
      // The other booking won the row — theirs stands, ours goes dark.
      return "kept_foreign";
    }
    const res = await fetch(`${NOTION_API}/pages/${slotId}`, {
      method: "PATCH",
      headers: headers(notionKey),
      body: JSON.stringify({
        properties: {
          Status: { select: { name: "Open" } },
          "Booking Id": { rich_text: [] },
          "Parent Name": { rich_text: [] },
          "Parent Email": { email: null },
          "Parent Phone": { phone_number: null },
          "Child First Name": { rich_text: [] },
          Level: { select: null },
          "Booked At": { date: null },
        },
      }),
    });
    return res.ok ? "released" : "failed";
  } catch {
    return "failed";
  }
}

// ── Coach queue: Requested rows + Sam's confirm step ────────────────

/** A Requested row with its booking fields — COACH-AUTHED surfaces only
 * (parent contact is PII; never render on a public page). */
export interface RequestedEvalSlot extends OpenEvalSlot {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirst: string;
  level: string;
  bookingId: string;
}

/**
 * All Requested rows, soonest first — the /coach/eval-requests queue.
 * Fail-soft: missing env / Notion error → empty list (the queue page says so
 * and the Notion db remains the source of truth).
 */
export async function fetchRequestedEvalSlots(): Promise<RequestedEvalSlot[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = slotsDbId();
  if (!notionKey || !dbId) return [];

  try {
    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: "POST",
      headers: headers(notionKey),
      body: JSON.stringify({
        filter: { property: "Status", select: { equals: "Requested" } },
        sorts: [{ property: "Date", direction: "ascending" }],
        page_size: 100,
      }),
    });
    if (!res.ok) {
      console.error(`[eval-slots] requested query failed (${res.status})`);
      return [];
    }
    const data = (await res.json()) as { results?: NotionSlotPage[] };
    const out: RequestedEvalSlot[] = [];
    for (const page of data.results ?? []) {
      const slot = readSlot(page);
      if (!slot) continue;
      const props = page.properties ?? {};
      out.push({
        ...slot,
        parentName: readPlainText(props["Parent Name"]).trim(),
        parentEmail: (props["Parent Email"]?.email ?? "").trim(),
        parentPhone: (props["Parent Phone"]?.phone_number ?? "").trim(),
        childFirst: readPlainText(props["Child First Name"]).trim(),
        level: props["Level"]?.select?.name ?? "",
        bookingId: readBookingId(page),
      });
    }
    return out;
  } catch (err) {
    console.error("[eval-slots] requested query error:", err);
    return [];
  }
}

export type ConfirmEvalRequestResult =
  | { ok: true; to: string; crmUpdated: boolean; statusPatched: boolean }
  | { ok: false; error: string };

/**
 * Sam's confirm step (the /coach/eval-requests queue action; auth lives in
 * the server action wrapper — this is the shared core so trigger-parity specs
 * can pin the fan-out). Verifies the row is still a Requested slot in OUR db
 * holding the EXPECTED bookingId (a stale queue tab must not confirm a row
 * that was since released and re-claimed by a different family), then fires
 * the shared confirmation engine UNCHANGED — parent email + .ics + fail-soft
 * CRM Eval-Date stamp — and promotes Status → Booked. The status PATCH runs
 * AFTER the send (email is the core value; a missed promotion leaves the row
 * in the queue where a re-confirm is idempotent-safe for the parent).
 */
export async function confirmEvalRequest(
  slotId: string,
  bookingId: string,
): Promise<ConfirmEvalRequestResult> {
  // Dynamic import keeps module init one-directional at runtime; this module
  // is already imported BY eval callers at boot, and eval-confirmation-send
  // never imports us back at top level beyond to12Hour (value-only).
  const { sendEvalConfirmation } = await import("./eval-confirmation-send");

  const notionKey = process.env.NOTION_API_KEY;
  const dbId = slotsDbId();
  if (!notionKey || !dbId) {
    return { ok: false, error: "eval-slots env not configured" };
  }

  try {
    const page = await getSlotPage(notionKey, slotId);
    if (!page) return { ok: false, error: "Couldn't read the slot row." };
    const parentDb = page.parent?.database_id ?? "";
    if (!parentDb || normalizeNotionId(parentDb) !== normalizeNotionId(dbId)) {
      return { ok: false, error: "That page is not an eval slot." };
    }
    if (readStatus(page) !== "Requested") {
      return {
        ok: false,
        error:
          "This request was already handled (row is no longer Requested) — refresh the queue.",
      };
    }
    if (!bookingId || readBookingId(page) !== bookingId) {
      return {
        ok: false,
        error: "Booking changed since this page loaded — refresh the queue.",
      };
    }

    const slot = readSlot(page);
    if (!slot) return { ok: false, error: "Slot is missing date/time/location." };
    const props = page.properties ?? {};
    const parentEmail = (props["Parent Email"]?.email ?? "").trim();
    const parentName = readPlainText(props["Parent Name"]).trim();
    const childFirst = readPlainText(props["Child First Name"]).trim();
    if (!parentEmail || !childFirst) {
      return { ok: false, error: "Row is missing the parent email or child name." };
    }

    const send = await sendEvalConfirmation({
      parentEmail,
      parentFirst: parentName.split(/\s+/)[0],
      childFirst,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      location: slot.location,
    });
    if (!send.ok) {
      const detail = send.errors?.length ? `: ${send.errors.join(", ")}` : "";
      return { ok: false, error: `${send.error}${detail}` };
    }

    // Promote Requested → Booked (fail-soft: the email is already delivered;
    // a missed PATCH just leaves the row visible in the queue).
    const patch = await fetch(`${NOTION_API}/pages/${slotId}`, {
      method: "PATCH",
      headers: headers(notionKey),
      body: JSON.stringify({
        properties: { Status: { select: { name: "Booked" } } },
      }),
    });
    if (!patch.ok) {
      console.error(
        `[eval-slots] confirm sent but Status PATCH failed (${patch.status}) — slot ${slotId} still Requested`,
      );
    }

    return {
      ok: true,
      to: send.to,
      crmUpdated: send.dryRun ? false : send.crm.updated,
      statusPatched: patch.ok,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}
