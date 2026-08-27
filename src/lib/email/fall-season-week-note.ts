import { c, s } from "./brand";
import { signatureExtrasHtml, signatureExtrasText } from "./signature";

/**
 * The weekly season note — one template, two variants.
 *
 * `preview` ships Saturday: here's what we're working on tomorrow, here's the
 * word of the day, here's the five-minute thing they can do tonight.
 * `recap` ships Sunday evening: here's what we actually did, here's the one
 * question to ask in the car, here's the rep for this week.
 *
 * They share a week's content (focus, word, home rep) on purpose — a parent
 * who reads only one of the two still gets the whole week. Splitting them into
 * two templates would have meant maintaining the same six weeks twice.
 *
 * EASE value: whichever value is that week's Word of the Day. That's the point
 * of the rotation — the email, the huddle, and the debrief all carry the same
 * word, so a parent asking about it at dinner is reinforcing the coaching.
 *
 * One primary CTA (directions) on the preview, because they're driving there
 * tomorrow. The recap has none: nothing is being asked of them.
 */

export type WeekNoteVariant = "preview" | "recap";

export interface FallSeasonWeekNoteInput {
  variant: WeekNoteVariant;
  parentFirst: string;
  childFirst: string;
  /** 1-indexed. */
  week: number;
  /** Total weeks in the season. */
  totalWeeks: number;
  /** "Sunday, September 20" */
  dateLong: string;
  /** Week title, e.g. "The soft game". */
  title: string;
  /** The Skill Stack block name we go deep on, e.g. "Transition". */
  focusName: string;
  /** Its everyday alias, e.g. "The Slinky". */
  focusAlias: string;
  /** One plain sentence a parent can repeat. */
  parentLine: string;
  /** The EASE Word of the Day. */
  word: string;
  /** How we frame that word to the kids. */
  wordFraming: string;
  /** Five-minute thing to do at home. */
  homeRep: string;
  /** "Green Ball" */
  groupLabel: string;
  /** "1:00–2:30 PM" */
  timeLabel: string;
  /** Exact venue block. */
  venue: string;
}

export function fallSeasonWeekNoteSubject(
  input: Pick<FallSeasonWeekNoteInput, "variant" | "week" | "title" | "childFirst">,
): string {
  return input.variant === "preview"
    ? `Tomorrow, week ${input.week} — ${input.title}`
    : `Week ${input.week} done — what ${input.childFirst} worked on`;
}

export function fallSeasonWeekNoteHtml(input: FallSeasonWeekNoteInput): string {
  const {
    variant,
    parentFirst,
    childFirst,
    week,
    totalWeeks,
    dateLong,
    title,
    focusName,
    focusAlias,
    parentLine,
    word,
    wordFraming,
    homeRep,
    groupLabel,
    timeLabel,
    venue,
  } = input;

  const preview = variant === "preview";
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    venue,
  )}`;

  const opener = preview
    ? `Tomorrow is week ${week} of ${totalWeeks} &mdash; ${escape(groupLabel)}, ${escape(
        timeLabel,
      )}. Here&rsquo;s what ${escape(childFirst)} will be working on, so you know what you&rsquo;re watching.`
    : `Week ${week} of ${totalWeeks} is done. Here&rsquo;s what ${escape(
        childFirst,
      )} actually worked on, and the one question worth asking in the car.`;

  const carOrTonight = preview
    ? `<div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Five minutes tonight</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">${escape(
        homeRep,
      )}</p>
      <p style="margin:14px 0 0 0;">
        <a href="${directions}" style="${s.link}font-weight:700;text-decoration:none;">Open in Google Maps &rarr;</a>
      </p>
    </div>`
    : `<div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Ask them in the car</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        &ldquo;Show me the ${escape(focusAlias)}.&rdquo; Making them teach it back is what locks it in &mdash; and it beats &ldquo;how was practice?&rdquo; every time.
      </p>
      <p style="margin:10px 0 0 0;color:${c.muted};font-size:13px;line-height:1.55;">
        This week&rsquo;s five-minute rep: ${escape(homeRep)}
      </p>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Week ${week} &mdash; ${escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Week ${week} of ${totalWeeks} &middot; ${escape(dateLong)}</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(title)}</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Hi ${escape(parentFirst)} &mdash; ${opener}
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">On court: ${escape(focusName)} &mdash; &ldquo;${escape(focusAlias)}&rdquo;</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">${escape(parentLine)}</p>
    </div>

    <div style="${s.card}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentYellow};font-weight:700;">Word of the day: ${escape(word)}</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">${escape(wordFraming)}</p>
    </div>

    ${carOrTonight}

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      ${signatureExtrasHtml()}
    </div>
  </div>
</body>
</html>`;
}

export function fallSeasonWeekNoteText(input: FallSeasonWeekNoteInput): string {
  const preview = input.variant === "preview";
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    input.venue,
  )}`;

  const lines = [
    `Hi ${input.parentFirst},`,
    "",
    `Week ${input.week} of ${input.totalWeeks} · ${input.dateLong} — ${input.title}`,
    "",
    preview
      ? `Tomorrow is week ${input.week} of ${input.totalWeeks} — ${input.groupLabel}, ${input.timeLabel}. Here's what ${input.childFirst} will be working on, so you know what you're watching.`
      : `Week ${input.week} of ${input.totalWeeks} is done. Here's what ${input.childFirst} actually worked on, and the one question worth asking in the car.`,
    "",
    `ON COURT: ${input.focusName} — "${input.focusAlias}"`,
    input.parentLine,
    "",
    `WORD OF THE DAY: ${input.word}`,
    input.wordFraming,
    "",
  ];

  if (preview) {
    lines.push(
      `FIVE MINUTES TONIGHT`,
      input.homeRep,
      "",
      `Where we play: ${input.venue}`,
      `Directions: ${directions}`,
    );
  } else {
    lines.push(
      `ASK THEM IN THE CAR`,
      `"Show me the ${input.focusAlias}." Making them teach it back is what locks it in — and it beats "how was practice?" every time.`,
      "",
      `This week's five-minute rep: ${input.homeRep}`,
    );
  }

  lines.push(
    "",
    "",
    `Better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    signatureExtrasText(),
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
