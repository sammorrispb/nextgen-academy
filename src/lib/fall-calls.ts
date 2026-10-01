import {
  FALL_END_TIME,
  FALL_RAIN_DATES,
  FALL_START_TIME,
  FALL_SUNDAYS,
  FALL_VENUE_SHORT,
  FALL_WEATHER_CALL_LEAD_HOURS,
  FALL_YOUTH_BLOCKS,
  type FallBlockLevel,
} from "@/data/fall-2026";

/**
 * Fall 2026 weather calls — the PURE half (no fetch, no env, date-injected).
 *
 * Sam's rules (2026-09-26):
 *  - The call is made two hours before each group starts, per GROUP: Green
 *    (1:00 PM) is called by 11:00 AM, Yellow (2:30 PM) by 12:30 PM. So one
 *    Sunday can hold Green and cancel Yellow.
 *  - A cancelled session moves to the NEXT OPEN rain date — the earliest rain
 *    date after it that this group has not already claimed. Nothing is
 *    refunded while a rain date is left; that is the stated remedy in
 *    fall-refund-policy.ts.
 *  - Rain dates are not booked with CUPF up front. The first time a group
 *    claims one, Sam books it on ActiveMONTGOMERY (the agent environment
 *    cannot reach it, and checkout is card + reCAPTCHA), then marks it Booked.
 *
 * The makeup mapping is DERIVED here from the call statuses, never stored,
 * so it cannot drift from them: replay every cancellation in date order and
 * give each one the next unclaimed rain date. The league weeks follow for free
 * — season-league rows key on Week, not date, so a washed-out week is simply
 * played on the next Sunday and the playoff lands on the rain date.
 *
 * A Sunday that has passed without being marked is counted as held. Sam only
 * has to act when he cancels; "we're on" is optional bookkeeping.
 */

export type FallCallGroup = FallBlockLevel;

export const FALL_CALL_GROUPS: readonly FallCallGroup[] = FALL_YOUTH_BLOCKS.map(
  (b) => b.level,
);

export const FALL_CALL_STATUSES = ["Scheduled", "Held", "Cancelled"] as const;
export type FallCallStatus = (typeof FALL_CALL_STATUSES)[number];

export const FALL_CUPF_STATUSES = ["Not booked", "Requested", "Booked"] as const;
export type FallCupfStatus = (typeof FALL_CUPF_STATUSES)[number];

export type FallCallDateKind = "season" | "rain";

/** Every date a call can be made for: the six Sundays, then the rain dates. */
export const FALL_CALL_DATES: readonly { date: string; kind: FallCallDateKind }[] = [
  ...FALL_SUNDAYS.map((date) => ({ date, kind: "season" as const })),
  ...FALL_RAIN_DATES.map((date) => ({ date, kind: "rain" as const })),
];

export function fallCallDateKind(date: string): FallCallDateKind | null {
  return FALL_CALL_DATES.find((d) => d.date === date)?.kind ?? null;
}

export function isFallCallGroup(raw: unknown): raw is FallCallGroup {
  return typeof raw === "string" && (FALL_CALL_GROUPS as readonly string[]).includes(raw);
}

/**
 * What the Notion tracker holds for one date. Anything absent reads as the
 * default: every group Scheduled, the rain date not booked, nobody emailed.
 */
export interface FallCallRecord {
  date: string;
  status?: Partial<Record<FallCallGroup, FallCallStatus>>;
  cupf?: FallCupfStatus | null;
  note?: string;
  notifiedAt?: Partial<Record<FallCallGroup, string | null>>;
}

/**
 * Lenient on purpose. A select option typed by hand in Notion as "Canceled"
 * (one L) or "Rained out" must NOT read as Scheduled — that would tell
 * families on /fall that a called-off session is on.
 */
export function normalizeCallStatus(raw: string | null | undefined): FallCallStatus {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "Scheduled";
  if (s.startsWith("cancel") || s.includes("rain") || s.includes("off")) return "Cancelled";
  if (s === "held" || s === "on" || s === "played" || s.startsWith("go")) return "Held";
  return "Scheduled";
}

export function normalizeCupfStatus(raw: string | null | undefined): FallCupfStatus {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "booked" || s === "confirmed" || s === "paid") return "Booked";
  if (s.startsWith("request") || s === "pending" || s === "submitted") return "Requested";
  return "Not booked";
}

// ---------------------------------------------------------------------------
// Times and labels
// ---------------------------------------------------------------------------

/** "1:00 PM" minus the lead → "11:00 AM". Throws on a shape it can't read. */
export function weatherCallTime(
  startTime: string,
  leadHours: number = FALL_WEATHER_CALL_LEAD_HOURS,
): string {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(startTime.trim());
  if (!m) throw new Error(`Unreadable start time: ${startTime}`);
  const hour24 = (Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  let minutes = hour24 * 60 + Number(m[2]) - leadHours * 60;
  minutes = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(minutes / 60);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
}

export interface FallCallBlock {
  group: FallCallGroup;
  /** "Green Ball" */
  label: string;
  startTime: string;
  endTime: string;
  /** "1:00–2:30 PM" */
  timeLabel: string;
  /** "11:00 AM" */
  callTime: string;
}

export const FALL_CALL_BLOCKS: readonly FallCallBlock[] = FALL_YOUTH_BLOCKS.map((b) => ({
  group: b.level,
  label: `${b.level} Ball`,
  startTime: b.startTime,
  endTime: b.endTime,
  timeLabel: `${b.startTime}–${b.endTime}`.replace(" PM–", "–"),
  callTime: weatherCallTime(b.startTime),
}));

export function fallCallBlock(group: FallCallGroup): FallCallBlock {
  const block = FALL_CALL_BLOCKS.find((b) => b.group === group);
  if (!block) throw new Error(`Unknown fall group: ${group}`);
  return block;
}

/** The one sentence every surface uses to state the rule, so they can't drift. */
export const FALL_WEATHER_CALL_POLICY = `We make the weather call two hours before each group starts — ${FALL_CALL_BLOCKS.map(
  (b) => `${b.callTime} for ${b.label}`,
).join(", ")}.`;

function isoToDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** "Sun, Sep 27" */
export function shortDayLabel(iso: string): string {
  return isoToDate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Sunday, September 27" */
export function longDayLabel(iso: string): string {
  return isoToDate(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// The derived season calendar
// ---------------------------------------------------------------------------

export type FallSessionState =
  /** Scheduled, still ahead. */
  | "upcoming"
  /** Scheduled, and it's today — the call may still be pending. */
  | "today"
  /** Marked Held on or before the day: the call was made and it's going ahead. */
  | "on"
  /** In the past and not cancelled. */
  | "held"
  | "cancelled";

export interface FallGroupSession {
  date: string;
  kind: FallCallDateKind;
  status: FallCallStatus;
  state: FallSessionState;
  /** Past and never marked — counted as held by default. */
  derivedHeld: boolean;
  /** Cancelled only: the rain date that replaces it, or null if none is left. */
  makeupDate: string | null;
  /** Rain-date sessions only: the cancelled date this one makes up. */
  makeupFor: string | null;
}

export interface FallGroupSchedule extends FallCallBlock {
  sessions: FallGroupSession[];
  held: number;
  cancelled: number;
  remaining: number;
  /** Cancelled dates with no rain date left — Sam's call: add a date or refund. */
  unresolved: string[];
}

export interface FallRainDateUse {
  date: string;
  cupf: FallCupfStatus;
  usedBy: { group: FallCallGroup; makeupFor: string }[];
  /** Claimed by a group and not yet Booked with CUPF. */
  needsBooking: boolean;
}

export interface FallSeasonCalendar {
  groups: FallGroupSchedule[];
  rainDates: FallRainDateUse[];
}

function recordFor(records: readonly FallCallRecord[], date: string): FallCallRecord | undefined {
  return records.find((r) => r.date === date);
}

function statusOf(
  records: readonly FallCallRecord[],
  date: string,
  group: FallCallGroup,
): FallCallStatus {
  return recordFor(records, date)?.status?.[group] ?? "Scheduled";
}

function stateOf(status: FallCallStatus, date: string, todayIso: string): FallSessionState {
  if (status === "Cancelled") return "cancelled";
  if (date < todayIso) return "held";
  if (status === "Held") return "on";
  return date === todayIso ? "today" : "upcoming";
}

function scheduleFor(
  block: FallCallBlock,
  records: readonly FallCallRecord[],
  todayIso: string,
): FallGroupSchedule {
  const rainPool = [...FALL_RAIN_DATES].sort();
  const claimed = new Set<string>();
  const queue: { date: string; kind: FallCallDateKind; makeupFor: string | null }[] =
    FALL_SUNDAYS.map((date) => ({ date, kind: "season" as const, makeupFor: null }));
  const sessions: FallGroupSession[] = [];
  const unresolved: string[] = [];

  // `queue` grows while we walk it: a cancellation appends its makeup, which
  // is always later than anything already queued, so date order holds.
  for (let i = 0; i < queue.length; i += 1) {
    const slot = queue[i];
    const status = statusOf(records, slot.date, block.group);
    let makeupDate: string | null = null;
    if (status === "Cancelled") {
      const next = rainPool.find((r) => r > slot.date && !claimed.has(r));
      if (next) {
        claimed.add(next);
        queue.push({ date: next, kind: "rain", makeupFor: slot.date });
        makeupDate = next;
      } else {
        unresolved.push(slot.date);
      }
    }
    sessions.push({
      date: slot.date,
      kind: slot.kind,
      status,
      state: stateOf(status, slot.date, todayIso),
      derivedHeld: status === "Scheduled" && slot.date < todayIso,
      makeupDate,
      makeupFor: slot.makeupFor,
    });
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...block,
    sessions,
    held: sessions.filter((s) => s.state === "held").length,
    cancelled: sessions.filter((s) => s.state === "cancelled").length,
    remaining: sessions.filter(
      (s) => s.state === "upcoming" || s.state === "today" || s.state === "on",
    ).length,
    unresolved,
  };
}

export function buildFallCalendar(
  records: readonly FallCallRecord[],
  todayIso: string,
): FallSeasonCalendar {
  const groups = FALL_CALL_BLOCKS.map((block) => scheduleFor(block, records, todayIso));
  const rainDates = FALL_RAIN_DATES.map((date) => {
    const usedBy = groups.flatMap((g) =>
      g.sessions
        .filter((s) => s.date === date && s.makeupFor)
        .map((s) => ({ group: g.group, makeupFor: s.makeupFor as string })),
    );
    const cupf = recordFor(records, date)?.cupf ?? "Not booked";
    return { date, cupf, usedBy, needsBooking: usedBy.length > 0 && cupf !== "Booked" };
  });
  return { groups, rainDates };
}

/** The session a group has on `date`, or null if it doesn't play that day. */
export function sessionOn(
  calendar: FallSeasonCalendar,
  group: FallCallGroup,
  date: string,
): FallGroupSession | null {
  return calendar.groups.find((g) => g.group === group)?.sessions.find((s) => s.date === date) ?? null;
}

/**
 * The date the public banner and the admin page centre on: the first date on
 * or after today that any group plays (or was called off) — so a cancellation
 * stays on screen for the whole of its own day. Null once the season is over.
 */
export function focusDate(calendar: FallSeasonCalendar, todayIso: string): string | null {
  const dates = calendar.groups
    .flatMap((g) => g.sessions.map((s) => s.date))
    .filter((d) => d >= todayIso)
    .sort();
  return dates[0] ?? null;
}

/** Records with `status` applied to `groups` on `date` — for projecting a call. */
export function applyCall(
  records: readonly FallCallRecord[],
  date: string,
  groups: readonly FallCallGroup[],
  status: FallCallStatus,
): FallCallRecord[] {
  const existing = recordFor(records, date);
  const nextStatus: Partial<Record<FallCallGroup, FallCallStatus>> = { ...(existing?.status ?? {}) };
  for (const g of groups) nextStatus[g] = status;
  const updated: FallCallRecord = { ...(existing ?? { date }), status: nextStatus };
  return existing
    ? records.map((r) => (r.date === date ? updated : r))
    : [...records, updated];
}

// ---------------------------------------------------------------------------
// WhatsApp + CUPF helpers
// ---------------------------------------------------------------------------

export const FALL_STATUS_URL_DISPLAY = "nextgenpbacademy.com/fall";

export const FALL_WHATSAPP_NOTE_MAX = 200;

function whenWord(date: string, todayIso: string): string {
  return date === todayIso ? "today" : "on Sunday";
}

/**
 * The go/no-go post for ONE group's WhatsApp. Plain text — WhatsApp renders
 * *asterisks* as bold, which is the only emphasis used.
 */
export function whatsAppCallText(input: {
  group: FallCallGroup;
  date: string;
  todayIso: string;
  outcome: "cancelled" | "on";
  makeupDate?: string | null;
  note?: string;
}): string {
  const block = fallCallBlock(input.group);
  const day = shortDayLabel(input.date);
  const when = whenWord(input.date, input.todayIso);
  if (input.outcome === "on") {
    return [
      `*${block.label} is ON ${when}* (${day}), ${block.timeLabel} at ${FALL_VENUE_SHORT}.`,
      `See you on court! — Coach Sam`,
    ].join("\n");
  }
  const reason = (input.note ?? "").trim();
  const makeup = input.makeupDate
    ? `Make-up: ${longDayLabel(input.makeupDate)}, ${block.timeLabel}, same courts.`
    : `Both rain dates are already in use — I'll be in touch about this one.`;
  return [
    `*${block.label} is CANCELLED ${when}* (${day})${reason ? ` — ${reason}` : " for weather"}.`,
    makeup,
    `Families are getting an email too. Latest status any time: ${FALL_STATUS_URL_DISPLAY}`,
    `— Coach Sam`,
  ].join("\n");
}

/** Opens WhatsApp with the text filled in; Sam picks the group and taps send. */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Where CUPF courts are booked. Sam's step: card + reCAPTCHA at checkout. */
export const ACTIVEMONTGOMERY_URL = "https://mdmontgomeryctyweb.myvscloud.com/webtrac/web/";

/**
 * What to book for a rain date. Always the whole 1:00–4:00 PM block: the same
 * weather that takes one group usually takes the other, and extending a CUPF
 * reservation later costs a modification fee and a second review.
 */
export function cupfBookingLine(rainDate: string): string {
  return `${FALL_VENUE_SHORT} tennis court · ${longDayLabel(rainDate)} · ${FALL_START_TIME.replace(
    " PM",
    "",
  )}–${FALL_END_TIME}`;
}

// ---------------------------------------------------------------------------
// Extra recipients (families the roster DB doesn't hold yet)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const FALL_CALL_MAX_EXTRA_EMAILS = 25;

/**
 * Parses the admin form's "also email" box. A family who paid off the website
 * (an invoice link) has no roster row, so without this they would miss the
 * cancellation. Invalid entries are returned, never silently dropped.
 */
export function parseExtraEmails(raw: string | readonly string[] | undefined): {
  valid: string[];
  invalid: string[];
} {
  const parts = (Array.isArray(raw) ? raw : String(raw ?? "").split(/[\s,;]+/))
    .map((p) => String(p).trim().toLowerCase())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (!EMAIL_RE.test(p)) invalid.push(p);
    else if (!valid.includes(p)) valid.push(p);
  }
  return { valid: valid.slice(0, FALL_CALL_MAX_EXTRA_EMAILS), invalid };
}
