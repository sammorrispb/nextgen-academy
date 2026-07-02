// NGA Eval Slots — the Notion db behind parent self-serve eval booking
// (admin-reduction roadmap Phase 1a). Sam bulk-types Open slots; the public
// /free-evaluation/book page lists them (5-min ISR) and POST /api/eval-book
// claims one.
//
// Notion has no transactions, so claiming is CLAIM-THEN-VERIFY: pre-check the
// row is still Open (never overwrite a Booked row — this is what makes the
// page's 5-min ISR staleness safe), write the booking fields + Status=Booked,
// then RE-READ the row and verify Parent Email matches THIS booking. If a
// concurrent claimer won the write race, the re-read shows their email and we
// return "slot_taken" (the loser path) — never a double-book, never a
// confirmation sent for a slot someone else holds.

import { to12Hour } from "./eval-confirmation-send";

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
  | { ok: true; slot: OpenEvalSlot }
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

function readParentEmail(page: NotionSlotPage): string {
  return (page.properties?.["Parent Email"]?.email ?? "").trim().toLowerCase();
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

export async function claimEvalSlot(
  slotId: string,
  booking: EvalSlotBooking,
): Promise<ClaimEvalSlotResult> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey || !slotsDbId()) {
    return { ok: false, reason: "error", detail: "eval-slots env not configured" };
  }

  try {
    // 1. Pre-check: the row must still be Open. A Booked row (the common
    //    ISR-staleness case) is NEVER overwritten.
    const before = await getSlotPage(notionKey, slotId);
    if (!before) {
      return { ok: false, reason: "error", detail: "slot read failed" };
    }
    if (before.archived || before.in_trash || readStatus(before) !== "Open") {
      return { ok: false, reason: "slot_taken" };
    }

    // 2. Claim write. Child data = first name + level ONLY.
    const patch = await fetch(`${NOTION_API}/pages/${slotId}`, {
      method: "PATCH",
      headers: headers(notionKey),
      body: JSON.stringify({
        properties: {
          Status: { select: { name: "Booked" } },
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

    // 3. Verify: re-read and confirm the row holds THIS booking. A mismatch
    //    means a concurrent claimer won between our write and this read —
    //    loser path returns slot_taken (their booking stands, ours goes dark).
    const after = await getSlotPage(notionKey, slotId);
    if (!after) {
      return { ok: false, reason: "error", detail: "verify read failed" };
    }
    if (readParentEmail(after) !== booking.parentEmail.trim().toLowerCase()) {
      return { ok: false, reason: "slot_taken" };
    }

    const slot = readSlot(after);
    if (!slot) {
      return { ok: false, reason: "error", detail: "slot missing date/time/location" };
    }
    return { ok: true, slot };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      detail: err instanceof Error ? err.message : "unknown error",
    };
  }
}

/**
 * Best-effort rollback when the confirmation email fails AFTER a successful
 * claim: re-open the slot and clear the booking fields so the parent (who saw
 * an error) isn't silently holding a slot. Fail-soft — a miss here leaves a
 * Booked row Sam will see in Notion.
 */
export async function releaseEvalSlot(slotId: string): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;
  try {
    const res = await fetch(`${NOTION_API}/pages/${slotId}`, {
      method: "PATCH",
      headers: headers(notionKey),
      body: JSON.stringify({
        properties: {
          Status: { select: { name: "Open" } },
          "Parent Name": { rich_text: [] },
          "Parent Email": { email: null },
          "Parent Phone": { phone_number: null },
          "Child First Name": { rich_text: [] },
          Level: { select: null },
          "Booked At": { date: null },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
