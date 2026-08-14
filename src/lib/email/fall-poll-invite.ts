import { c, s } from "./brand";
import { whatsappInviteHtml, whatsappInviteText } from "./whatsapp-invite";
import {
  FALL_POLL_DAY_LABEL,
  FALL_POLL_GROUPS,
  FALL_POLL_PRICE_USD,
  FALL_POLL_SEASON_LABEL,
  FALL_POLL_SEASON_WEEKS,
  FALL_POLL_SPOTS_PER_GROUP,
  FALL_POLL_VENUE,
} from "@/data/fall-poll-2026";

/**
 * The Fall 2026 season announcement + one-click poll, to ACTIVE families only.
 *
 * Unlike the fall-survey template, this one QUOTES the real price: Sam set the
 * season terms (2026-08-14) — $225 per player, 6 Sundays, 8 spots per group —
 * so the honest-pricing rule now cuts the other way: a family deciding "in or
 * out" needs the number.
 *
 * The three answers render at equal visual weight (no dark patterns — "Out"
 * is as easy to tap as "In"), and each link lands on a confirm page before
 * anything is recorded, so a mail-scanner prefetch can never cast a vote.
 *
 * When no signing secret is configured the links degrade to a reply-with-a-
 * word ask instead of rendering dead buttons (camp-outreach precedent).
 */

export interface FallPollLinks {
  inUrl: string;
  interestedUrl: string;
  outUrl: string;
}

export interface FallPollInviteInput {
  firstName: string;
  /** null = no signing secret configured — degrade to the reply-based ask. */
  links: FallPollLinks | null;
}

export function fallPollInviteSubject(): string {
  return `Fall season is on — ${FALL_POLL_DAY_LABEL} at ${FALL_POLL_VENUE}. Are you in?`;
}

const groupsLine = FALL_POLL_GROUPS.map(
  (g) => `${g.level} ${g.timeLabel}`,
).join(" · ");

const pollButton = (label: string, sub: string, url: string) =>
  `<td style="padding:4px;width:33%;">
    <a href="${url}" style="display:block;background:${c.bgCard};border:2px solid ${c.accentLime};color:${c.text};padding:14px 8px;border-radius:8px;text-decoration:none;text-align:center;">
      <span style="display:block;font-weight:700;font-size:16px;color:${c.accentLime};">${label}</span>
      <span style="display:block;font-size:12px;color:${c.muted};margin-top:4px;">${sub}</span>
    </a>
  </td>`;

export function fallPollInviteHtml(input: FallPollInviteInput): string {
  const { firstName, links } = input;

  const pollBlock = links
    ? `<p style="margin:0 0 12px 0;color:${c.text};font-size:15px;line-height:1.65;">
        <strong>Tap one</strong> — it takes two seconds, and you can change your
        answer any time by tapping a different one:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;"><tr>
        ${pollButton("IN", "Count us in", links.inUrl)}
        ${pollButton("INTERESTED", "Tell me more", links.interestedUrl)}
        ${pollButton("OUT", "Not this season", links.outUrl)}
      </tr></table>
      <p style="margin:0 0 24px 0;color:${c.muted};font-size:12px;line-height:1.6;">
        Tapping IN doesn&rsquo;t charge you anything &mdash; Coach Sam follows up
        with payment details, and spots are first come, first serve.
      </p>`
    : `<p style="margin:0 0 24px 0;color:${c.text};font-size:15px;line-height:1.65;">
        <strong>Just reply to this email with one word</strong> &mdash; IN, INTERESTED,
        or OUT &mdash; and we&rsquo;ll take it from there.
      </p>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px 12px;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Fall 2026 season &mdash; it&rsquo;s happening</p>
    <h1 style="${s.heading} margin:0 0 20px 0;">Hey ${escape(firstName)} &mdash; fall Sundays are booked</h1>

    <p style="margin:0 0 20px 0;color:${c.text};font-size:15px;line-height:1.65;">
      The fall season is on: <strong>${FALL_POLL_SEASON_WEEKS} ${FALL_POLL_DAY_LABEL}</strong> at
      ${FALL_POLL_VENUE}, running <strong>${FALL_POLL_SEASON_LABEL}</strong>.
      Same court, same crew, every week &mdash; that&rsquo;s where the real jumps happen.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">The details</p>
      <p style="margin:0 0 8px 0;color:${c.text};font-size:14px;line-height:1.7;">
        ${FALL_POLL_GROUPS.map(
          (g) =>
            `<strong>${g.level} Ball</strong> &mdash; ${FALL_POLL_DAY_LABEL} ${g.timeLabel}, ${FALL_POLL_SPOTS_PER_GROUP} spots`,
        ).join("<br>")}
      </p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">
        <strong>$${FALL_POLL_PRICE_USD} per player</strong> for the full
        ${FALL_POLL_SEASON_WEEKS}-week season.
      </p>
    </div>

    ${pollBlock}

    ${whatsappInviteHtml()}

    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        Coach Sam<br>
        Next Gen Pickleball Academy
      </p>
      <p style="margin:12px 0 0 0;color:${c.muted};font-size:12px;line-height:1.6;">
        Questions? Just reply. Don&rsquo;t want season emails? Reply &ldquo;skip&rdquo; and we&rsquo;ll stop.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function fallPollInviteText(input: FallPollInviteInput): string {
  const { firstName, links } = input;

  const lines: string[] = [
    `Hey ${firstName} — fall Sundays are booked`,
    "",
    `The fall season is on: ${FALL_POLL_SEASON_WEEKS} ${FALL_POLL_DAY_LABEL} at ${FALL_POLL_VENUE}, running ${FALL_POLL_SEASON_LABEL}. Same court, same crew, every week — that's where the real jumps happen.`,
    "",
    "THE DETAILS",
    ...FALL_POLL_GROUPS.map(
      (g) =>
        `${g.level} Ball — ${FALL_POLL_DAY_LABEL} ${g.timeLabel}, ${FALL_POLL_SPOTS_PER_GROUP} spots`,
    ),
    `$${FALL_POLL_PRICE_USD} per player for the full ${FALL_POLL_SEASON_WEEKS}-week season.`,
    "",
  ];

  if (links) {
    lines.push(
      "Tap one — you can change your answer any time by tapping a different one:",
      `IN (count us in): ${links.inUrl}`,
      `INTERESTED (tell me more): ${links.interestedUrl}`,
      `OUT (not this season): ${links.outUrl}`,
      "",
      "Tapping IN doesn't charge you anything — Coach Sam follows up with payment details, and spots are first come, first serve.",
    );
  } else {
    lines.push(
      "Just reply to this email with one word — IN, INTERESTED, or OUT — and we'll take it from there.",
    );
  }

  lines.push(
    "",
    whatsappInviteText(),
    "",
    "Coach Sam",
    "Next Gen Pickleball Academy",
    "",
    `Questions? Just reply. Don't want season emails? Reply "skip" and we'll stop.`,
  );

  return lines.join("\n");
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// groupsLine is exported for the confirm page's season recap line.
export const FALL_POLL_GROUPS_LINE = groupsLine;
