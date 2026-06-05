import { c, s } from "./brand";

/**
 * Confirmation email for a manually-scheduled FREE EVALUATION (Coach Sam meets
 * a brand-new player 1:1 to place them on the pathway). Distinct from
 * booking-confirmation.ts, which confirms a PAID drop-in. Evals are booked by
 * hand (a parent asks, Sam picks a time), so this template is sent via the
 * secret-gated /api/eval-confirmation endpoint rather than a Stripe webhook.
 *
 * Brand-reviewed (brand-review-nga). EASE = Excellence (preparedness — the .ics
 * + what-to-bring). Single primary CTA (the map gets the arrow); the calendar
 * drop is the attached .ics. No prices — evals are free.
 */

export interface EvalConfirmationInput {
  parentFirst: string;
  childFirst: string;
  /** Long form, e.g. "Tuesday, June 9, 2026". */
  dateLong: string;
  /** e.g. "10:00 AM". */
  startTime: string;
  /** e.g. "10:45 AM". */
  endTime: string;
  /** Free-form address shown in the card + used for the Maps link. */
  location: string;
  /** Defaults to "Coach Sam". */
  coachName?: string;
}

/** Subject ≤ 60 chars, never opens with the full brand name (it's in From). */
export function evalConfirmationSubject(
  childFirst: string,
  shortDate: string,
  startTime: string,
): string {
  return `${childFirst}'s free eval is set — ${shortDate} at ${startTime} ET`;
}

export function evalConfirmationHtml(input: EvalConfirmationInput): string {
  const {
    parentFirst,
    childFirst,
    dateLong,
    startTime,
    endTime,
    location,
    coachName = "Coach Sam",
  } = input;

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>You&rsquo;re all set &mdash; ${escape(childFirst)}&rsquo;s free evaluation</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Confirmed</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">You&rsquo;re all set, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      ${escape(childFirst)} has a free evaluation with ${escape(coachName)} booked. The .ics attached drops it straight into your calendar &mdash; one tap.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${escape(dateLong)} &middot; ${escape(startTime)}&ndash;${escape(endTime)} ET</p>
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">Free Evaluation with ${escape(coachName)}</p>
      <p style="margin:0 0 12px 0;color:${c.muted};font-size:14px;">${escape(location)}</p>
      <p style="margin:0;">
        <a href="${directions}" style="${s.link}font-weight:700;text-decoration:none;">Open in Google Maps &rarr;</a>
      </p>
    </div>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">What to expect</h2>
    <p style="margin:0 0 16px 0;color:${c.text};line-height:1.55;">
      A relaxed, no-pressure session. ${escape(coachName)} gets ${escape(childFirst)} moving, sees where she&rsquo;s starting from, and lays the first building blocks &mdash; grounded in our EASE values (Ethics, Attitude, Skills, Excellence). Afterward we&rsquo;ll talk through what we saw and the best next step. Brand-new to the sport is exactly where we love to begin.
    </p>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">What to bring</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>Water bottle</li>
      <li>Court shoes &mdash; no flat-soled sneakers</li>
      <li>A paddle if you have one. We have loaners.</li>
    </ul>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Plans change?</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Need to reschedule? Reply to this email or text Sam at <a href="tel:13013254731" style="${s.link}">301-325-4731</a> and we&rsquo;ll find another time.
      </p>
    </div>

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

export function evalConfirmationText(input: EvalConfirmationInput): string {
  const {
    parentFirst,
    childFirst,
    dateLong,
    startTime,
    endTime,
    location,
    coachName = "Coach Sam",
  } = input;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`;
  return [
    `You're all set, ${parentFirst}.`,
    "",
    `${childFirst} has a free evaluation with ${coachName} booked. The attached .ics drops it straight into your calendar — one tap.`,
    "",
    `${dateLong} · ${startTime}–${endTime} ET`,
    `Free Evaluation with ${coachName}`,
    location,
    `Open in Google Maps: ${directions}`,
    "",
    `What to expect: A relaxed, no-pressure session. ${coachName} gets ${childFirst} moving, sees where she's starting from, and lays the first building blocks — grounded in our EASE values (Ethics, Attitude, Skills, Excellence). Brand-new to the sport is exactly where we love to begin.`,
    "",
    `What to bring:`,
    `- Water bottle`,
    `- Court shoes — no flat-soled sneakers`,
    `- A paddle if you have one. We have loaners.`,
    "",
    `Plans change? Reply to this email or text Sam at 301-325-4731 and we'll find another time.`,
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
