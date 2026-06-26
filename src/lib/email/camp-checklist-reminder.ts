import { c, s } from "./brand";

/**
 * Coach-facing "camp today — pack & set up" nudge. Fires at 7am ET on every
 * scheduled camp morning (see api/cron/camp-checklist-reminder) and links the
 * coach to /coach/camp-checklist so the supply + setup run-of-show is one tap
 * away before drop-off.
 *
 * Pure builder so the copy unit-tests without the cron. Recipients are COACHES
 * ONLY (the allowlist / admin address) — this email carries no parent or child
 * data, so it's outside the minor-PII egress surface entirely.
 */

export interface CampChecklistDay {
  /** "Summer Camp — Week 1". */
  title: string;
  /** "June 29 – July 2, 2026". */
  week: string;
  /** "9:30 AM – 12:30 PM". */
  hours: string;
  /** Resolved "Where" block — exact venue (may be multi-line). */
  location: string;
}

export interface CampChecklistReminderInput {
  /** Human day, e.g. "Monday, June 29". */
  dayLong: string;
  /** The camp(s) running today — usually one. */
  camps: CampChecklistDay[];
  /** Absolute link to the coach checklist page. */
  checklistUrl: string;
}

export function campChecklistSubject(weekday: string): string {
  return `Camp today (${weekday}) — pack & setup checklist`;
}

export function campChecklistHtml(input: CampChecklistReminderInput): string {
  const { dayLong, camps, checklistUrl } = input;

  const campsHtml = camps
    .map(
      (camp) => `
      <div style="${s.card}">
        <p style="margin: 0 0 4px; font-weight: 700; color: ${c.text};">${escape(
          camp.title,
        )}</p>
        <p style="margin: 0 0 8px; color: ${c.muted};">${escape(
          camp.week,
        )} · ${escape(camp.hours)}</p>
        <p style="margin: 0; color: ${c.text};">${escape(camp.location).replace(
          /\n/g,
          "<br>",
        )}</p>
      </div>`,
    )
    .join("");

  return `
  <div style="${s.wrapper}">
    <h1 style="${s.heading}">Camp today — let's set up</h1>
    <p style="font-size: 16px; line-height: 1.6;">
      Good morning, Coach. ${escape(
        dayLong,
      )} is a camp morning. Run the supply and
      setup checklist before drop-off so the wagon's packed and the courts are
      ready when the first camper arrives.
    </p>

    ${campsHtml}

    <div style="text-align: center; margin: 28px 0;">
      <a href="${checklistUrl}" style="${s.cta}">Open the camp checklist →</a>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Don't forget</p>
      <p style="margin: 6px 0 0; font-size: 14px; line-height: 1.6; color: ${
        c.text
      };">
        Balls (one bag per level), nets, ball caddies, the wagon, pop-up shade,
        water cooler, first-aid kit, and the printed roster + lesson plans. Tip
        the boxes on the page or print it to carry a paper copy.
      </p>
    </div>

    <div style="${s.footer}">
      <p style="font-size: 13px; color: ${c.muted}; margin: 0;">
        Automated coach reminder · Next Gen Pickleball Academy
      </p>
    </div>
  </div>`;
}

export function campChecklistText(input: CampChecklistReminderInput): string {
  const { dayLong, camps, checklistUrl } = input;
  const campLines = camps
    .map((camp) =>
      [
        `- ${camp.title} (${camp.week}) · ${camp.hours}`,
        `  ${camp.location.replace(/\n/g, " · ")}`,
      ].join("\n"),
    )
    .join("\n");
  return [
    `Camp today — let's set up`,
    ``,
    `Good morning, Coach. ${dayLong} is a camp morning. Run the supply and setup checklist before drop-off.`,
    ``,
    campLines,
    ``,
    `Open the camp checklist: ${checklistUrl}`,
    ``,
    `Don't forget: balls (one bag per level), nets, ball caddies, the wagon, pop-up shade, water cooler, first-aid kit, and the printed roster + lesson plans.`,
    ``,
    `Automated coach reminder · Next Gen Pickleball Academy`,
  ].join("\n");
}

// Minimal HTML-escape — the inputs here are our own camp config, not user
// input, but escape anyway so a stray "&" in a venue name can't break markup.
function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
