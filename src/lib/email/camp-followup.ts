import { c, s } from "./brand";

/**
 * Camp conclusion follow-up — the "that's a wrap" email to every family whose
 * camper just finished a camp week. Three jobs, in CTA order:
 *   1. Ask for a Google review (the ONE primary CTA — arrowed button).
 *   2. Hand the parent a copy-paste blurb to share on neighborhood listservs /
 *      Facebook groups / team chats.
 *   3. Point at the next camp with a register link (utility link, not a chip).
 *
 * Pure builders (mirrors camp-reminder.ts) so copy is unit-testable without
 * the send engine. Recipient is always the PARENT contact, never a minor.
 *
 * The share blurb is text parents will paste PUBLICLY, so it may only ever
 * carry the next camp's `publicArea` — the exact venue stays on closed,
 * post-payment surfaces per the child-safety location policy in camps.ts.
 * Pinned by e2e/camp-followup.spec.ts.
 */

export interface CampFollowupNextCamp {
  title: string;
  weekLabel: string; // "August 17 – August 20, 2026"
  /** Broad public area ONLY (e.g. "Rockville, MD") — never the exact venue. */
  publicArea: string;
  hours: string; // "9:30 AM – 12:30 PM"
  registerUrl: string; // absolute, e.g. "https://nextgenpbacademy.com/camp/august-17"
  /** Display prices from CAMP_OPTIONS — camp pricing is real, safe to quote. */
  priceDayUsd: number;
  priceWeekUsd: number;
  ageMin: number;
  ageMax: number;
}

export interface CampFollowupInput {
  parentFirst: string;
  /** One name, or several joined upstream ("Ava & Max"). */
  childFirst: string;
  campTitle: string; // the camp that just wrapped
  campWeek: string;
  reviewUrl: string;
  /** Pre-built copy-paste blurb (buildCampShareBlurb). */
  shareBlurb: string;
  /** Omitted when no camp is on the calendar after this one. */
  nextCamp?: CampFollowupNextCamp | null;
}

/**
 * The blurb a parent pastes into a listserv or Facebook group, verbatim.
 * Plain text on purpose — it has to survive every paste target.
 */
export function buildCampShareBlurb(next: CampFollowupNextCamp): string {
  return [
    "Our kid just wrapped up a week of pickleball camp with Next Gen Pickleball Academy and had a blast — real coaching, tons of court time, and the most encouraging coaches. Sharing for any families still looking for a fun week before school starts:",
    "",
    `${next.title} — Next Gen Pickleball Academy`,
    `• ${next.weekLabel} (Mon–Thu mornings, ${next.hours})`,
    `• ${next.publicArea}`,
    `• Ages ${next.ageMin}–${next.ageMax} — every level welcome, loaner paddles available`,
    `• $${next.priceDayUsd} a morning or $${next.priceWeekUsd} for the full week`,
    "",
    `Register: ${next.registerUrl}`,
  ].join("\n");
}

export function campFollowupSubject(childFirst: string): string {
  return `${childFirst || "Your camper"} crushed camp week — thank you (+ a quick favor)`;
}

export function campFollowupHtml(input: CampFollowupInput): string {
  const { parentFirst, childFirst, campTitle, campWeek, reviewUrl, shareBlurb, nextCamp } = input;

  const blurbHtml = escape(shareBlurb).replace(/\n/g, "<br>");

  const nextCampHtml = nextCamp
    ? `
    <div style="${s.card}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentYellow};font-weight:700;">One more camp this summer</p>
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(nextCamp.title)}</p>
      <p style="margin:0 0 12px 0;color:${c.muted};font-size:14px;">${escape(nextCamp.weekLabel)} &middot; Mon&ndash;Thu mornings, ${escape(nextCamp.hours)} &middot; ${escape(nextCamp.publicArea)}</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">
        Ages ${nextCamp.ageMin}&ndash;${nextCamp.ageMax}, every level welcome &mdash; $${nextCamp.priceDayUsd} a morning or $${nextCamp.priceWeekUsd} for the full week. Spots go family-by-family, so if ${escape(childFirst)} wants one more week on the court: <a href="${escape(nextCamp.registerUrl)}" style="${s.link}">register for ${escape(nextCamp.weekLabel)}</a>.
      </p>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>That&rsquo;s a wrap &mdash; ${escape(campTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Camp wrap-up &middot; ${escape(campWeek)}</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">That&rsquo;s a wrap &mdash; ${escape(childFirst)} brought it all week.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Hi ${escape(parentFirst)} &mdash; thank you for trusting us with ${escape(childFirst)} this week at ${escape(campTitle)}. Every morning we watched kids try things that didn&rsquo;t work yet, take another rep, and walk off the court better than they walked on. That&rsquo;s the whole point, and ${escape(childFirst)} was right in the middle of it.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Two minutes that help a ton</p>
      <p style="margin:0 0 16px 0;color:${c.text};font-size:14px;line-height:1.6;">
        We&rsquo;re a small local academy, and honest reviews from real camp families are how the next parent finds us. If this week earned it, would you leave us a quick Google review? A sentence or two about what ${escape(childFirst)} got out of camp is perfect.
      </p>
      <a href="${escape(reviewUrl)}" style="${s.cta}">Leave a Google review &rarr;</a>
    </div>

    <div style="${s.card}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Know a family who&rsquo;d love this?</p>
      <p style="margin:0 0 12px 0;color:${c.text};font-size:14px;line-height:1.6;">
        The copy below is ready to paste into your neighborhood listserv, Facebook or WhatsApp group, or team chat &mdash; copy, paste, done. It means more coming from you than it ever could from us.
      </p>
      <div style="background:${c.bgDark};border:1px solid ${c.border};border-radius:8px;padding:16px;font-family:'Roboto Mono',Consolas,monospace;font-size:13px;line-height:1.6;color:${c.text};white-space:pre-wrap;">${blurbHtml}</div>
    </div>
${nextCampHtml}
    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        Questions, or a story from the week we should hear? Just reply to this email or text Coach Sam at <a href="tel:13013254731" style="${s.link}">301-325-4731</a>.<br><br>
        See you on the court &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function campFollowupText(input: CampFollowupInput): string {
  const { parentFirst, childFirst, campTitle, campWeek, reviewUrl, shareBlurb, nextCamp } = input;
  const lines = [
    `Hi ${parentFirst},`,
    "",
    `That's a wrap on ${campTitle} (${campWeek}) — thank you for trusting us with ${childFirst} this week. Every morning we watched kids try things that didn't work yet, take another rep, and walk off the court better than they walked on. That's the whole point, and ${childFirst} was right in the middle of it.`,
    "",
    "TWO MINUTES THAT HELP A TON",
    `We're a small local academy, and honest reviews from real camp families are how the next parent finds us. If this week earned it, would you leave us a quick Google review? A sentence or two about what ${childFirst} got out of camp is perfect.`,
    `Leave a Google review: ${reviewUrl}`,
    "",
    "KNOW A FAMILY WHO'D LOVE THIS?",
    "The blurb below is ready to paste into your neighborhood listserv, Facebook or WhatsApp group, or team chat — copy, paste, done. It means more coming from you than it ever could from us.",
    "",
    "---",
    shareBlurb,
    "---",
  ];
  if (nextCamp) {
    lines.push(
      "",
      "ONE MORE CAMP THIS SUMMER",
      `${nextCamp.title} — ${nextCamp.weekLabel} (Mon–Thu mornings, ${nextCamp.hours}) · ${nextCamp.publicArea}`,
      `Ages ${nextCamp.ageMin}–${nextCamp.ageMax}, every level welcome — $${nextCamp.priceDayUsd} a morning or $${nextCamp.priceWeekUsd} for the full week.`,
      `Register: ${nextCamp.registerUrl}`,
    );
  }
  lines.push(
    "",
    "Questions, or a story from the week we should hear? Just reply to this email or text Coach Sam at 301-325-4731.",
    "",
    "See you on the court — better than yesterday, together.",
    "Coach Sam · Next Gen Pickleball Academy",
  );
  return lines.join("\n");
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
