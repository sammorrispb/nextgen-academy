import { c, s } from "./brand";

/**
 * "Camp starts Monday" reminder — the Friday-before-camp email to every
 * registered family. Pure builder so the copy can be unit-tested without the
 * cron; mirrors the booking-reminder.ts (HTML+text + cardAccent block) and
 * camp-confirmation.ts (camp content) precedents.
 *
 * `location` is pre-resolved by the caller (the cron reads the camp's exact
 * venue from camps.ts — a closed, post-payment surface, never public — and
 * passes the "Where" block). Keeping the camps.ts lookup in the caller leaves
 * this template pure. Recipient is always the PARENT contact, never a minor.
 *
 * The drop-off/pick-up windows + the $25 administrative-fee line are NEW facts
 * not in the confirmation email. Per Sam's instruction the fee is stated as a
 * POLICY only — no payment link in this email.
 */

export interface CampReminderInput {
  parentFirst: string;
  childFirst: string;
  campTitle: string; // "Summer Camp — Week 1"
  campWeek: string; // "June 29 – July 2, 2026"
  optionLabel: string; // "Full week (Mon–Thu)" / "Single morning · Monday June 29"
  optionHours: string; // "9:30 AM – 12:30 PM"
  /** Resolved "Where" block — exact venue (may be multi-line) or broad-area fallback. */
  location: string;
  /** Human start day, e.g. "Monday, June 29". Pre-formatted by the caller. */
  startDayLong: string;
  /** Drop-off window, e.g. "9:15–9:30 AM". */
  dropoffWindow: string;
  /** Pick-up window, e.g. "12:30–12:45 PM". */
  pickupWindow: string;
  /** Late/early administrative fee, already formatted, e.g. "$25". */
  lateFee: string;
  /** Human rain/makeup day, e.g. "Friday, July 3". Pre-formatted by the caller. */
  makeupDayLong: string;
}

export function campReminderSubject(childFirst: string, weekday: string): string {
  return `${childFirst || "Your camper"} starts camp ${weekday}`;
}

export function campReminderHtml(input: CampReminderInput): string {
  const {
    parentFirst,
    childFirst,
    campTitle,
    campWeek,
    optionLabel,
    optionHours,
    location,
    startDayLong,
    dropoffWindow,
    pickupWindow,
    lateFee,
    makeupDayLong,
  } = input;

  const locationHtml = escape(location).replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Camp starts ${escape(startDayLong)} &mdash; ${escape(campTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Camp starts ${escape(startDayLong)}</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(childFirst)} is on the court this week.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Hi ${escape(parentFirst)} &mdash; we&rsquo;re looking forward to a great week. Here&rsquo;s everything you need so the mornings run smooth.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${escape(campWeek)}</p>
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(campTitle)}</p>
      <p style="margin:0 0 12px 0;color:${c.muted};font-size:14px;">${escape(optionLabel)} &middot; ${escape(optionHours)}</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.5;">${locationHtml}</p>
    </div>

    <div style="${s.card}">
      <p style="margin:0 0 8px 0;font-family:Montserrat,Arial,sans-serif;font-size:15px;color:${c.text};">Drop-off &amp; pick-up</p>
      <p style="margin:0 0 4px 0;color:${c.text};font-size:14px;line-height:1.6;">Drop-off: <strong>${escape(dropoffWindow)}</strong></p>
      <p style="margin:0 0 12px 0;color:${c.text};font-size:14px;line-height:1.6;">Pick-up: <strong>${escape(pickupWindow)}</strong></p>
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.55;">
        Early drop-off or late pick-up adds a ${escape(lateFee)} administrative fee, due before the next morning&rsquo;s camp (or we can take payment on the spot). Keeping the windows tight helps our coaches stay focused on the court &mdash; thank you.
      </p>
    </div>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">What to bring each day</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>Refillable water bottle</li>
      <li>Court shoes &mdash; no flat-soled sneakers</li>
      <li>A morning snack</li>
      <li>A paddle if you have one &mdash; we have loaners</li>
    </ul>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Rain plan</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        We&rsquo;re outdoors on the courts with shade and a water cooler, and we play rain or shine &mdash; dress for the weather. If a morning is truly washed out, our makeup day is ${escape(makeupDayLong)}.
      </p>
    </div>

    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        Questions? Just reply to this email or text Coach Sam at <a href="tel:13013254731" style="${s.link}">301-325-4731</a>.<br><br>
        See you on the court &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function campReminderText(input: CampReminderInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `${input.childFirst} starts camp ${input.startDayLong} — here's everything you need for the week.`,
    "",
    `${input.campTitle}`,
    `${input.campWeek}`,
    `${input.optionLabel} · ${input.optionHours}`,
    "",
    `Where: ${input.location}`,
    "",
    `Drop-off & pick-up:`,
    `- Drop-off: ${input.dropoffWindow}`,
    `- Pick-up: ${input.pickupWindow}`,
    `Early drop-off or late pick-up adds a ${input.lateFee} administrative fee, due before the next morning's camp (or we can take payment on the spot). Keeping the windows tight helps our coaches stay focused on the court — thank you.`,
    "",
    `What to bring each day:`,
    `- Refillable water bottle`,
    `- Court shoes (no flat-soled sneakers)`,
    `- A morning snack`,
    `- A paddle if you have one — we have loaners.`,
    "",
    `Rain plan: We're outdoors on the courts with shade and a water cooler, and we play rain or shine — dress for the weather. If a morning is truly washed out, our makeup day is ${input.makeupDayLong}.`,
    "",
    `Questions? Just reply to this email or text Coach Sam at 301-325-4731.`,
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
  ].join("\n");
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
