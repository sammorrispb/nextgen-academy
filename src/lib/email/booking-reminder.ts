import { c, s } from "./brand";
import { whatsappInviteHtml, whatsappInviteText } from "./whatsapp-invite";

interface ReminderInput {
  parentFirst: string;
  childFirst: string;
  sessionTitle: string;
  sessionDateLong: string; // "Saturday, May 23, 2026"
  sessionStart: string; // "5:30 PM"
  sessionLocation: string;
  /** True for hidden-location sessions — show the area + reveal note, no map link. */
  locationHidden?: boolean;
  detailUrl: string;
  /** Signed self-serve cancel URL. Optional — feature is off if secret missing. */
  cancelUrl?: string;
}

export function bookingReminderHtml(input: ReminderInput): string {
  const {
    parentFirst,
    childFirst,
    sessionTitle,
    sessionDateLong,
    sessionStart,
    sessionLocation,
    locationHidden,
    detailUrl,
    cancelUrl,
  } = input;

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sessionLocation)}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tomorrow &mdash; ${escape(sessionTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Tomorrow</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(childFirst)} is on the court tomorrow.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Quick heads up, ${escape(parentFirst)} &mdash; the more rest and hydration tonight, the better the reps tomorrow. Show up ready to grow.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${escape(sessionDateLong)} &middot; ${escape(sessionStart)}</p>
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(sessionTitle)}</p>
      <p style="margin:0 0 12px 0;color:${c.muted};font-size:14px;">${escape(sessionLocation)}</p>
      ${
        locationHidden
          ? `<p style="margin:0;color:${c.text};font-size:13px;line-height:1.5;">Exact location lands in your inbox today &mdash; about 24 hours before start.</p>`
          : `<p style="margin:0;">
        <a href="${directions}" style="${s.link}font-weight:700;text-decoration:none;">Open in Google Maps &rarr;</a>
      </p>`
      }
    </div>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">Tonight&rsquo;s checklist</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>Water bottle, packed</li>
      <li>Court shoes &mdash; no flat-soled sneakers</li>
      <li>Paddle if you have one. We have loaners.</li>
      <li>Eat ~90 minutes before the start &mdash; nothing heavy</li>
    </ul>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Plans change?</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        ${
          cancelUrl
            ? `If something comes up, <a href="${cancelUrl}" style="${s.link}font-weight:700;">cancel your reservation</a> so the next player can grab the seat. Drop-ins are non-refundable, but the swap helps the whole community.`
            : `If something comes up, reply to this email or text Sam at <a href="tel:13013254731" style="${s.link}">301-325-4731</a> so we can open the seat. Drop-ins are non-refundable, but the swap helps the whole community.`
        }
      </p>
    </div>

    <p style="margin:24px 0 0 0;color:${c.muted};font-size:13px;">
      <a href="${detailUrl}" style="${s.link}">View session details</a>
    </p>

    ${whatsappInviteHtml()}

    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on the court &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

interface ReminderTextInput extends ReminderInput {
  sessionDateLong: string;
}

export function bookingReminderText(input: ReminderTextInput): string {
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(input.sessionLocation)}`;

  const cancelLine = input.cancelUrl
    ? `If something comes up, cancel your reservation so the next player can grab the seat: ${input.cancelUrl}\nDrop-ins are non-refundable, but the swap helps the whole community.`
    : `If something comes up, reply to this email or text 301-325-4731 so we can open the seat. Drop-ins are non-refundable, but the swap helps the whole community.`;

  return [
    `Hi ${input.parentFirst},`,
    "",
    `Quick heads up — ${input.childFirst} is on the court tomorrow:`,
    "",
    `${input.sessionTitle}`,
    `${input.sessionDateLong} · ${input.sessionStart}`,
    `${input.sessionLocation}`,
    input.locationHidden
      ? `Exact location lands in your inbox today — about 24 hours before start.`
      : `Directions: ${mapsUrl}`,
    "",
    `Tonight's checklist:`,
    `- Water bottle, packed`,
    `- Court shoes (no flat-soled sneakers)`,
    `- Paddle if you have one. We have loaners.`,
    `- Eat ~90 minutes before the start — nothing heavy`,
    "",
    cancelLine,
    "",
    `Session link: ${input.detailUrl}`,
    "",
    whatsappInviteText(),
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
  ].join("\n");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
