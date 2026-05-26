import { c, s } from "./brand";
import { whatsappInviteHtml } from "./whatsapp-invite";

interface ConfirmationInput {
  parentFirst: string;
  childFirst: string;
  sessionTitle: string;
  sessionDateLong: string; // "Saturday, May 23, 2026"
  sessionStart: string; // "5:30 PM"
  sessionEnd: string; // "6:30 PM"
  sessionLocation: string;
  amountPaid: string; // "40.00"
  detailUrl: string;
  /** Signed self-serve cancel URL. Optional — feature is off if secret missing. */
  cancelUrl?: string;
  /** Append the WhatsApp parent-group invite. True only on the parent's first NGA touch. */
  includeWhatsappInvite?: boolean;
}

export function bookingConfirmationHtml(input: ConfirmationInput): string {
  const {
    parentFirst,
    childFirst,
    sessionTitle,
    sessionDateLong,
    sessionStart,
    sessionEnd,
    sessionLocation,
    amountPaid,
    detailUrl,
    cancelUrl,
    includeWhatsappInvite,
  } = input;

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sessionLocation)}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>You&rsquo;re registered &mdash; ${escape(sessionTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Confirmed</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">You&rsquo;re registered, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      ${escape(childFirst)} has a spot. The .ics file attached drops the session straight into your calendar &mdash; one tap.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${escape(sessionDateLong)} &middot; ${escape(sessionStart)}&ndash;${escape(sessionEnd)}</p>
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(sessionTitle)}</p>
      <p style="margin:0 0 12px 0;color:${c.muted};font-size:14px;">${escape(sessionLocation)}</p>
      <p style="margin:0;">
        <a href="${directions}" style="${s.link}font-weight:700;text-decoration:none;">Open in Google Maps &rarr;</a>
      </p>
    </div>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">What to bring</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>Water bottle</li>
      <li>Court shoes &mdash; no flat-soled sneakers</li>
      <li>A paddle if you have one. We have loaners.</li>
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
      Paid: $${escape(amountPaid)} &middot;
      <a href="${detailUrl}" style="${s.link}">View session details</a>
    </p>

    ${includeWhatsappInvite ? whatsappInviteHtml() : ""}

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

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
