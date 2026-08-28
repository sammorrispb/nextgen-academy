import { c, s } from "./brand";
import {
  FALL_PUBLIC_AREA,
  FALL_RAIN_DATES,
  FALL_SEASON_LABEL,
  FALL_SEASON_WEEKS,
  FALL_SUNDAYS,
  FALL_VENUE,
  FALL_VENUE_SHORT,
  FALL_YOUTH_BLOCKS,
} from "@/data/fall-2026";
import { getVenue } from "@/data/venue-parking";
import { inferCity } from "@/lib/venue-lookup";
import { signatureExtrasHtml, signatureExtrasText } from "./signature";

/**
 * The "the season moved venues" notice to families who ALREADY PAID.
 *
 * Sam lost the Earle B. Wood MS courts for the Fall 2026 Sundays and moved the
 * season to Walter Johnson HS on 2026-08-27, with 9 seats already sold. These
 * families bought a season that named Rockville; Bethesda is a materially
 * different drive for some of them. So this email has two jobs, and the second
 * is the one that matters:
 *
 *  1. State the change plainly, up top, with the new address — no burying it
 *     under reassurance, and no "small update" framing for something a parent
 *     has to redraw their Sunday around.
 *  2. Offer a full refund, at equal visual weight to everything else. The
 *     season is sold as non-refundable, but the terms changed AFTER purchase
 *     and not by the family's choice, so "non-refundable" is not ours to lean
 *     on here (Sam's call, 2026-08-27). No dark patterns: the refund line is
 *     body copy in its own card, not fine print at the bottom.
 *
 * Everything factual is imported from the season constants and the venue table
 * — dates, times, address, and the parking guidance — so this email cannot
 * quote a venue the site contradicts, and a second move updates it for free.
 *
 * NO CHILD FIELDS. The copy says "your player", never a name, so this template
 * egresses parent contact data only and stays off the minor-PII surface that
 * `docs/hostile-reviewer.md` gates. Do not add a child name to personalize it.
 */

export const FALL_SEASON_URL = "https://nextgenpbacademy.com/fall";
export const COACH_PHONE_DISPLAY = "301-325-4731";
export const COACH_PHONE_TEL = "13013254731";

/** The venue we moved AWAY from — named once, so parents aren't left guessing. */
export const FALL_PREVIOUS_VENUE_SHORT = "Earle B. Wood Middle School";

export interface FallVenueChangeInput {
  firstName: string;
}

// "Green Ball 1:00–2:30 PM" — same single-PM collapse fall-season-2026 does,
// so the email and the season page read identically.
const blocksLine = FALL_YOUTH_BLOCKS.map(
  (b) => `${b.level} Ball ${`${b.startTime}–${b.endTime}`.replace(" PM–", "–")}`,
).join(" · ");

const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "long",
  day: "numeric",
  timeZone: "UTC",
};

/** ISO date-only → "September 20". Noon-UTC anchor per the repo's date rule. */
function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", DATE_FMT);
}

const sundaysLine = FALL_SUNDAYS.map(dayLabel).join(" · ");
const rainLine = FALL_RAIN_DATES.map(dayLabel).join(" or ");

/** Parking guidance for the new venue, from the same table the site renders. */
const parkingTip = getVenue(FALL_VENUE)?.tip ?? "";

/**
 * City alone ("Bethesda") for mid-sentence prose. FALL_PUBLIC_AREA carries the
 * state too, which is right on an address line and clunky inside a sentence.
 */
const newCity = inferCity(FALL_VENUE) ?? FALL_PUBLIC_AREA;

function escape(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 50 chars with the current venue name — the guide caps a parent-facing
 * subject at 60 (50 ideal), and the earlier draft ran to 71. "Moved" has to
 * survive truncation on a phone: a recipient who reads nothing but the
 * subject must still learn the season changed venues.
 */
export function fallVenueChangeSubject(): string {
  return `Fall season has moved — ${FALL_VENUE_SHORT}`;
}

export function fallVenueChangeHtml(input: FallVenueChangeInput): string {
  const { firstName } = input;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px 12px;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Fall season &mdash; location change</p>
    <h1 style="${s.heading} margin:0 0 20px 0;">We&rsquo;ve moved to ${FALL_VENUE_SHORT}</h1>

    <p style="margin:0 0 20px 0;color:${c.text};font-size:15px;line-height:1.65;">
      Hi ${escape(firstName)} &mdash; one change you&rsquo;ll want before the season starts.
      ${FALL_PREVIOUS_VENUE_SHORT} is no longer available to us for these Sundays, so the
      fall season is moving to <strong style="color:${c.accentLime};">${FALL_VENUE_SHORT}</strong>
      in ${FALL_PUBLIC_AREA}.
    </p>

    <p style="margin:0 0 20px 0;color:${c.text};font-size:15px;line-height:1.65;">
      <strong>Everything else is exactly the same</strong> &mdash; same ${FALL_SEASON_WEEKS} Sundays,
      same start times, same groups, same price. Only the courts changed.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">The new address</p>
      <p style="margin:0 0 12px 0;color:${c.text};font-size:14px;line-height:1.7;">
        <strong>${FALL_VENUE}</strong>
      </p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">
        ${parkingTip}
      </p>
    </div>

    <div style="${s.card}">
      <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Unchanged</p>
      <p style="margin:0 0 8px 0;color:${c.text};font-size:14px;line-height:1.7;">
        <strong>${blocksLine}</strong><br>
        ${FALL_SEASON_LABEL}
      </p>
      <p style="margin:0 0 8px 0;color:${c.text};font-size:14px;line-height:1.6;">
        Your Sundays: ${sundaysLine}.
      </p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">
        Rain dates are still held for ${rainLine} &mdash; at the new courts too.
      </p>
    </div>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">If the new location doesn&rsquo;t work for you</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.7;">
        You signed up for a season in Rockville, and ${newCity} is a different drive.
        If that change doesn&rsquo;t work for your family, just reply to this email and
        <strong>we&rsquo;ll refund you in full</strong> &mdash; no explanation needed, no hard
        feelings. You picked this season on the details we gave you, and those details moved.
      </p>
    </div>

    <p style="margin:24px 0 24px 0;color:${c.text};font-size:15px;line-height:1.65;">
      Nothing to do if the new courts work for you &mdash; your player&rsquo;s spot is held and
      we&rsquo;ll see you on ${dayLabel(FALL_SUNDAYS[0])}. Questions either way, reply here or
      text Coach Sam at <a href="tel:${COACH_PHONE_TEL}" style="color:${c.link};">${COACH_PHONE_DISPLAY}</a>.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;"><tr>
      <td>
        <a href="${FALL_SEASON_URL}" style="display:inline-block;background:${c.accentLime};color:${c.bgDark};padding:15px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">See the updated season page</a>
      </td>
    </tr></table>

    <p style="margin:0 0 24px 0;color:${c.muted};font-size:12px;line-height:1.6;">
      Sorry for the shuffle &mdash; school court availability is out of our hands, and
      we&rsquo;d rather move once now than change things on you mid-season.
    </p>
      ${signatureExtrasHtml()}

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

export function fallVenueChangeText(input: FallVenueChangeInput): string {
  const { firstName } = input;

  return [
    `We've moved to ${FALL_VENUE_SHORT}.`,
    ``,
    `Hi ${firstName} — one change you'll want before the season starts.`,
    `${FALL_PREVIOUS_VENUE_SHORT} is no longer available to us for these Sundays,`,
    `so the fall season is moving to ${FALL_VENUE_SHORT} in ${FALL_PUBLIC_AREA}.`,
    ``,
    `Everything else is exactly the same — same ${FALL_SEASON_WEEKS} Sundays, same start`,
    `times, same groups, same price. Only the courts changed.`,
    ``,
    `THE NEW ADDRESS`,
    `${FALL_VENUE}`,
    `${parkingTip}`,
    ``,
    `UNCHANGED`,
    `${blocksLine}`,
    `${FALL_SEASON_LABEL}`,
    `Your Sundays: ${sundaysLine}.`,
    `Rain dates are still held for ${rainLine} — at the new courts too.`,
    ``,
    `IF THE NEW LOCATION DOESN'T WORK FOR YOU`,
    `You signed up for a season in Rockville, and ${newCity} is a different`,
    `drive. If that change doesn't work for your family, just reply to this email`,
    `and we'll refund you in full — no explanation needed, no hard feelings. You`,
    `picked this season on the details we gave you, and those details moved.`,
    ``,
    `Nothing to do if the new courts work for you — your player's spot is held and`,
    `we'll see you on ${dayLabel(FALL_SUNDAYS[0])}. Questions either way, reply here`,
    `or text Coach Sam at ${COACH_PHONE_DISPLAY}.`,
    ``,
    `Season page: ${FALL_SEASON_URL}`,
    ``,
    `Sorry for the shuffle — school court availability is out of our hands, and`,
    `we'd rather move once now than change things on you mid-season.`,
    ``,
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    signatureExtrasText(),
  ].join("\n");
}
