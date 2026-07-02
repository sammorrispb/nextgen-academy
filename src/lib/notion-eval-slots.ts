// NGA Eval Slots — the Notion db behind parent self-serve eval booking
// (admin-reduction roadmap Phase 1a). Sam bulk-types Open slots; the public
// /free-evaluation/book page lists them (5-min ISR) and POST /api/eval-book
// claims one.
//
// Notion has no transactions (no CAS), so claiming is CLAIM-THEN-VERIFY with
// a per-claim BOOKING TOKEN: pre-check the row is still Open, in OUR Eval
// Slots db, and in the future (never overwrite a Booked row — this is what
// makes the page's 5-min ISR staleness safe); write the booking fields +
// Status=Booked + a fresh random "Booking Id"; wait ~500ms; then RE-READ the
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

/**
 * Future Open slots, soonest first. Fail-soft: missing env / Notion error →
 * empty list (the page renders its no-open-slots state).
 */
export async function fetchOpenEvalSlots(): Promise<OpenEvalSlot[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = slotsDbId();
  if (!notionKey || !dbId) return [];

  try {
    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: "POST",
      headers: headers(notionKey),
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Status", select: { equals: "Open" } },
            { property: "Date", date: { on_or_after: new Date().toISOString() } },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
        page_size: 100,
      }),
    });
    if (!res.ok) {
      console.error(`[eval-slots] query failed (${res.status})`);
      return [];
    }
    const data = (await res.json()) as { results?: NotionSlotPage[] };
    return (data.results ?? [])
      .map(readSlot)
      .filter((s): s is OpenEvalSlot => s !== null);
  } catch (err) {
    console.error("[eval-slots] query error:", err);
    return [];
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
    // 1. Pre-check: the row must still be Open. A Booked row (the common
    //    ISR-staleness case) is NEVER overwritten.
    const before = await getSlotPage(notionKey, slotId);
    if (!before) {
      return { ok: false, reason: "error", detail: "slot read failed" };
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
          Status: { select: { name: "Booked" } },
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
 * Best-effort CONDITIONAL rollback when the confirmation email fails AFTER a
 * successful claim: re-read the row, and ONLY when it still holds OUR
 * bookingId re-open it and clear the booking fields, so the parent (who saw
 * an error) isn't silently holding a slot.
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
