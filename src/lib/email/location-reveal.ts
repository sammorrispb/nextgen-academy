import { c, s } from "./brand";

interface RevealInput {
  parentFirst: string;
  childFirst: string;
  sessionTitle: string;
  sessionDateLong: string; // "Tuesday, June 2, 2026"
  sessionStart: string; // "6:00 PM"
  sessionEnd: string; // "7:00 PM"
  /** The exact venue, revealed here for the first time. */
  sessionLocation: string;
  detailUrl: string;
  /** Signed self-serve cancel URL. Optional — feature off if secret missing. */
  cancelUrl?: string;
}

export function locationRevealHtml(input: RevealInput): string {
  const {
    parentFirst,
    childFirst,
    sessionTitle,
    sessionDateLong,
    sessionStart,
    sessionEnd,
    sessionLocation,
    detailUrl,
    cancelUrl,
  } = input;

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sessionLocation)}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Location for ${escape(sessionTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Here&rsquo;s the spot</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">Tomorrow&rsquo;s location, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      As promised, here&rsquo;s exactly where ${escape(childFirst)} is playing. See you on the court.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${escape(sessionDateLong)} &middot; ${escape(sessionStart)}&ndash;${escape(sessionEnd)}</p>
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(sessionTitle)}</p>
      <p style="margin:0 0 12px 0;color:${c.text};font-size:15px;font-weight:700;">${escape(sessionLocation)}</p>
      <p style="margin:0;">
        <a href="${directions}" style="${s.link}font-weight:700;text-decoration:none;">Open in Google Maps &rarr;</a>
      </p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Can&rsquo;t make it?</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        ${
          cancelUrl
            ? `If plans changed, <a href="${cancelUrl}" style="${s.link}font-weight:700;">cancel your spot</a> so the next player can grab it. Drop-ins are non-refundable, but the swap helps the whole community.`
            : `If plans changed, reply to this email or text Sam at <a href="tel:13013254731" style="${s.link}">301-325-4731</a> so we can open the seat. Drop-ins are non-refundable, but the swap helps the whole community.`
        }
      </p>
    </div>

    <p style="margin:24px 0 0 0;color:${c.muted};font-size:13px;">
      <a href="${detailUrl}" style="${s.link}">View session details</a>
    </p>

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

export function locationRevealText(input: RevealInput): string {
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(input.sessionLocation)}`;
  const cancelLine = input.cancelUrl
    ? `Can't make it? Cancel your spot so the next player can grab it: ${input.cancelUrl}\nDrop-ins are non-refundable, but the swap helps the whole community.`
    : `Can't make it? Reply to this email or text 301-325-4731 so we can open the seat. Drop-ins are non-refundable, but the swap helps the whole community.`;

  return [
    `Hi ${input.parentFirst},`,
    "",
    `As promised, here's exactly where ${input.childFirst} is playing:`,
    "",
    `${input.sessionTitle}`,
    `${input.sessionDateLong} · ${input.sessionStart}–${input.sessionEnd}`,
    `${input.sessionLocation}`,
    `Directions: ${mapsUrl}`,
    "",
    cancelLine,
    "",
    `Session link: ${input.detailUrl}`,
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
  ].join("\n");
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
