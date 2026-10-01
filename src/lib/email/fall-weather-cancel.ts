import { c, s } from "./brand";
import { FALL_VENUE_SHORT } from "@/data/fall-2026";
import {
  FALL_STATUS_URL_DISPLAY,
  fallCallBlock,
  longDayLabel,
  shortDayLabel,
  type FallCallGroup,
} from "@/lib/fall-calls";
import { signatureExtrasHtml, signatureExtrasText } from "./signature";

/**
 * The "we've called it off" email for the Fall 2026 Sunday season — the email
 * the Sept 12 kickoff promised ("I'll post in the WhatsApp group AND email you
 * directly") for any cancellation.
 *
 * Its jobs, in order: (1) don't come to the courts, stated in the subject and
 * the first line; (2) when the session is made up, with the exact rain date the
 * calendar derived; (3) what the rest of the season now looks like, so nobody
 * has to work out that it runs a week later.
 *
 * NO CHILD FIELDS. "Your player", never a name — parent contact only, same
 * posture as the venue-change notice. Do not personalise it with a child name.
 */

export const FALL_SEASON_URL = "https://nextgenpbacademy.com/fall";

export interface FallWeatherCancelGroup {
  group: FallCallGroup;
  /** The rain date that replaces this session, or null if none is left. */
  makeupDate: string | null;
  /** This group's sessions still to play after the cancellation, ISO, in order. */
  remaining: readonly string[];
}

export interface FallWeatherCancelInput {
  firstName: string;
  /** The cancelled date (ISO). */
  date: string;
  /** Today in Eastern (ISO) — decides "today" versus the date. */
  todayIso: string;
  /** The cancelled groups THIS family has a player in. */
  groups: readonly FallWeatherCancelGroup[];
  /** Sam's public reason, e.g. "steady rain and wet courts". Optional. */
  note?: string;
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function whatLabel(groups: readonly FallWeatherCancelGroup[]): string {
  return groups.length === 1 ? fallCallBlock(groups[0].group).label : "Fall season";
}

/** ≤ 60 chars: "Green Ball cancelled today (Sun, Sep 27) — weather". */
export function fallWeatherCancelSubject(input: FallWeatherCancelInput): string {
  const day = shortDayLabel(input.date);
  const when = input.date === input.todayIso ? `today (${day})` : day;
  return `${whatLabel(input.groups)} cancelled ${when} — weather`;
}

function reasonClause(note: string | undefined): string {
  const n = (note ?? "").trim();
  return n ? n : "the weather";
}

function makeupLine(g: FallWeatherCancelGroup): string {
  const block = fallCallBlock(g.group);
  return g.makeupDate
    ? `${block.label}: ${longDayLabel(g.makeupDate)}, ${block.timeLabel}, same courts at ${FALL_VENUE_SHORT}.`
    : `${block.label}: both rain dates are already in use, so this one can't move to a rain date. A session we can't make up is refunded — I'll be in touch this week with the details.`;
}

function remainingLine(g: FallWeatherCancelGroup): string {
  const block = fallCallBlock(g.group);
  if (g.remaining.length === 0) return `${block.label}: no Sundays left on the calendar.`;
  return `${block.label}: ${g.remaining.map(shortDayLabel).join(" · ")}`;
}

export function fallWeatherCancelHtml(input: FallWeatherCancelInput): string {
  const { firstName, date, todayIso, groups, note } = input;
  const isToday = date === todayIso;
  const headline = isToday
    ? `No ${whatLabel(groups)} today`
    : `No ${whatLabel(groups)} on ${longDayLabel(date)}`;
  const which = groups
    .map((g) => {
      const b = fallCallBlock(g.group);
      return `${b.label} (${b.timeLabel})`;
    })
    .join(" and ");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px 12px;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentYellow};font-weight:700;">Fall season &mdash; weather call</p>
    <h1 style="${s.headingYellow} margin:0 0 20px 0;">${escape(headline)}</h1>

    <p style="margin:0 0 20px 0;color:${c.text};font-size:15px;line-height:1.65;">
      Hi ${escape(firstName)} &mdash; we&rsquo;re calling off ${escape(which)}
      ${isToday ? "today" : `on ${escape(longDayLabel(date))}`} at ${FALL_VENUE_SHORT} because of
      ${escape(reasonClause(note))}. <strong>Please don&rsquo;t head to the courts.</strong>
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Your make-up</p>
      ${groups
        .map(
          (g) =>
            `<p style="margin:0 0 8px 0;color:${c.text};font-size:14px;line-height:1.7;">${escape(makeupLine(g))}</p>`,
        )
        .join("\n      ")}
    </div>

    <div style="${s.card}">
      <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Your Sundays from here</p>
      ${groups
        .map(
          (g) =>
            `<p style="margin:0 0 8px 0;color:${c.text};font-size:14px;line-height:1.7;">${escape(remainingLine(g))}</p>`,
        )
        .join("\n      ")}
      <p style="margin:8px 0 0 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Nothing is lost &mdash; we pick the season up right where we left off, rotating partners and
        standings included. It just finishes a Sunday later.
      </p>
    </div>

    <p style="margin:24px 0 24px 0;color:${c.text};font-size:15px;line-height:1.65;">
      Every call goes up in your group&rsquo;s season WhatsApp and at
      <a href="${FALL_SEASON_URL}" style="${s.link}">${FALL_STATUS_URL_DISPLAY}</a>. Questions? Just reply to this email.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;"><tr>
      <td>
        <a href="${FALL_SEASON_URL}" style="display:inline-block;background:${c.accentLime};color:${c.bgDark};padding:15px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">See the season schedule</a>
      </td>
    </tr></table>

    <div style="${s.footer}">
      <p style="margin:0 0 6px 0;color:${c.text};font-size:14px;line-height:1.6;">
        Thanks for rolling with us &mdash; better than yesterday, together.
      </p>
      <p style="margin:0;color:${c.text};font-size:14px;font-weight:700;">
        Coach Sam &middot; Next Gen Pickleball Academy
      </p>
      ${signatureExtrasHtml()}
    </div>
  </div>
</body>
</html>`;
}

export function fallWeatherCancelText(input: FallWeatherCancelInput): string {
  const { firstName, date, todayIso, groups, note } = input;
  const isToday = date === todayIso;
  const which = groups
    .map((g) => {
      const b = fallCallBlock(g.group);
      return `${b.label} (${b.timeLabel})`;
    })
    .join(" and ");

  return [
    isToday ? `No ${whatLabel(groups)} today.` : `No ${whatLabel(groups)} on ${longDayLabel(date)}.`,
    ``,
    `Hi ${firstName} — we're calling off ${which} ${isToday ? "today" : `on ${longDayLabel(date)}`} at ${FALL_VENUE_SHORT} because of ${reasonClause(note)}. Please don't head to the courts.`,
    ``,
    `YOUR MAKE-UP`,
    ...groups.map(makeupLine),
    ``,
    `YOUR SUNDAYS FROM HERE`,
    ...groups.map(remainingLine),
    `Nothing is lost — we pick the season up right where we left off, rotating partners and standings included. It just finishes a Sunday later.`,
    ``,
    `Every call goes up in your group's season WhatsApp and at ${FALL_STATUS_URL_DISPLAY}. Questions? Just reply to this email.`,
    ``,
    `Season schedule: ${FALL_SEASON_URL}`,
    ``,
    `Thanks for rolling with us — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    ``,
    signatureExtrasText(),
  ].join("\n");
}
