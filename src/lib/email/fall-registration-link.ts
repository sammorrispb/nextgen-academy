import { c, s } from "./brand";
import {
  FALL_POLL_DAY_LABEL,
  FALL_POLL_GROUPS,
  FALL_POLL_PRICE_USD,
  FALL_POLL_SEASON_LABEL,
  FALL_POLL_SEASON_WEEKS,
  FALL_POLL_SPOTS_PER_GROUP,
  FALL_POLL_VENUE,
} from "@/data/fall-poll-2026";
import { signatureExtrasHtml, signatureExtrasText } from "./signature";

/**
 * The "you said IN — here's how to lock the spot" email.
 *
 * Sent the moment a family confirms IN on the Fall 2026 poll, closing the
 * handoff the poll itself only promised ("Coach Sam will follow up with
 * payment details"). Until this existed that follow-up was manual, so an
 * answered poll could sit unconverted indefinitely.
 *
 * Terms are imported from fall-poll-2026, never re-typed — the poll email, the
 * confirm page, and this email must quote one set of numbers or a family gets
 * told two different prices. It DOES quote $225 for the same reason the poll
 * invite does: the number is real and operator-set, and someone about to pay
 * needs it before they click.
 *
 * Deliberately short. The decision was already made when they tapped IN; this
 * email has exactly one job, which is getting them to /fall while that
 * intent is still warm.
 */

export const FALL_REGISTRATION_URL = "https://nextgenpbacademy.com/fall";

export interface FallRegistrationLinkInput {
  firstName: string;
}

const groupsLine = FALL_POLL_GROUPS.map(
  (g) => `${g.level} ${g.timeLabel}`,
).join(" · ");

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function fallRegistrationLinkSubject(): string {
  return `You're in — here's the link to lock your fall spot`;
}

export function fallRegistrationLinkHtml(
  input: FallRegistrationLinkInput,
): string {
  const { firstName } = input;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px 12px;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">You&rsquo;re in &mdash; one step left</p>
    <h1 style="${s.heading} margin:0 0 20px 0;">Thanks ${escape(firstName)} &mdash; let&rsquo;s lock the spot</h1>

    <p style="margin:0 0 20px 0;color:${c.text};font-size:15px;line-height:1.65;">
      You said <strong style="color:${c.accentLime};">IN</strong> for the fall season, so here&rsquo;s
      the registration link. Spots are <strong>first come, first serve</strong> &mdash;
      ${FALL_POLL_SPOTS_PER_GROUP} per group &mdash; so grabbing yours now is the safest bet.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">What you&rsquo;re signing up for</p>
      <p style="margin:0 0 8px 0;color:${c.text};font-size:14px;line-height:1.7;">
        <strong>${FALL_POLL_SEASON_WEEKS} ${FALL_POLL_DAY_LABEL}</strong> at ${FALL_POLL_VENUE}<br>
        ${FALL_POLL_SEASON_LABEL}<br>
        ${groupsLine}
      </p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">
        <strong>$${FALL_POLL_PRICE_USD} per player</strong> for the full
        ${FALL_POLL_SEASON_WEEKS}-week season.
      </p>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px 0;"><tr>
      <td>
        <a href="${FALL_REGISTRATION_URL}" style="display:inline-block;background:${c.accentLime};color:${c.bgDark};padding:15px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Register for the season</a>
      </td>
    </tr></table>

    <p style="margin:0 0 24px 0;color:${c.muted};font-size:12px;line-height:1.6;">
      Registration and payment happen in one go. If the link gives you any trouble,
      just reply to this email and Coach Sam will sort it out by hand.
    </p>
      ${signatureExtrasHtml()}

    <p style="margin:0 0 24px 0;color:${c.muted};font-size:12px;line-height:1.6;">
      Changed your mind? No problem &mdash; reply and let us know, and we&rsquo;ll free the spot up.
    </p>

    <div style="${s.footer}">
      <p style="margin:0 0 6px 0;color:${c.text};font-size:14px;line-height:1.6;">
        See you on the court &mdash; better than yesterday, together.
      </p>
      <p style="margin:0;color:${c.text};font-size:14px;font-weight:700;">
        Coach Sam &middot; Next Gen Pickleball Academy
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function fallRegistrationLinkText(
  input: FallRegistrationLinkInput,
): string {
  const { firstName } = input;

  return [
    `Thanks ${firstName} — let's lock the spot.`,
    ``,
    `You said IN for the fall season, so here's the registration link. Spots are`,
    `first come, first serve — ${FALL_POLL_SPOTS_PER_GROUP} per group — so grabbing yours now is the safest bet.`,
    ``,
    `WHAT YOU'RE SIGNING UP FOR`,
    `${FALL_POLL_SEASON_WEEKS} ${FALL_POLL_DAY_LABEL} at ${FALL_POLL_VENUE}`,
    `${FALL_POLL_SEASON_LABEL}`,
    `${groupsLine}`,
    `$${FALL_POLL_PRICE_USD} per player for the full ${FALL_POLL_SEASON_WEEKS}-week season.`,
    ``,
    `Register: ${FALL_REGISTRATION_URL}`,
    ``,
    `Registration and payment happen in one go. If the link gives you any`,
    `trouble, just reply to this email and Coach Sam will sort it out by hand.`,
    ``,
    `Changed your mind? Reply and let us know, and we'll free the spot up.`,
    ``,
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    signatureExtrasText(),
  ].join("\n");
}
