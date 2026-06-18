import { site } from "@/data/site";
import { c, s } from "./brand";

/**
 * Post-eval "next steps" email — the coach-to-parent recap after a free
 * evaluation. Placed on the pathway (Red/Orange/Green/Yellow); every level
 * leads with a group drop-in recommendation.
 *
 * Brand policy (BRAND_GUIDELINES.md → STRATEGIC CONTEXT, updated 2026-06-18):
 * every public group session runs a court per level (Red/Orange/Green/Yellow),
 * so all four levels get the live drop-in list. Red/Orange ("foundation"
 * levels) additionally surface private lessons as an optional fast-track and
 * match only sessions explicitly opened to their level (never an unleveled
 * general weekend row). The session list is passed in (fetched live from the
 * Sessions DB) — never hardcode dates here.
 */

export type Level = "Red" | "Orange" | "Green" | "Yellow";

export const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  Red: "Pre-rally — building the foundation. Your child gets a Red Ball court of their own so they start playing right away; private lessons are available to fast-track the rally.",
  Orange:
    "Developing — rallying a few balls and ready to grow. Orange Ball group play builds rules mastery and full-court movement, with private lessons available for extra 1:1 reps.",
  Green:
    "Consistent — full-court play, learning strategy and mid-game decisions.",
  Yellow:
    "Competitive — full game, working on shot selection and tournament fundamentals.",
};

/**
 * Red and Orange are "foundation" levels: they get the optional private-lesson
 * fast-track and match only sessions opened to their exact level (the per-level
 * group courts), never an unleveled general weekend row. Green and Yellow can
 * also slot into unleveled general sessions. (Name kept for the route import
 * that gates session matching — a Minor-PII slop-free file we don't touch.)
 */
export function isPrivateBridgeLevel(level: Level): boolean {
  return level === "Red" || level === "Orange";
}

export interface SessionLineInput {
  date: string; // "YYYY-MM-DD"
  startTime: string; // "4:30 PM"
  location: string;
  /** Non-empty = location-hidden session — use this broad area, never `location`. */
  publicArea: string;
}

/**
 * One human line for the upcoming-sessions list, e.g. "Sat, Jun 7 — Bethesda ·
 * 4:30 PM". Respects location-hidden mode (publicArea wins over the exact
 * address). Date is UTC-anchored to avoid the build-server off-by-one.
 */
export function formatSessionLine(input: SessionLineInput): string {
  const place = input.publicArea?.trim() || input.location?.trim() || "TBA";
  const label = input.date
    ? new Date(`${input.date}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "";
  const time = input.startTime?.trim();
  return [label, `— ${place}`, time ? `· ${time}` : ""]
    .filter(Boolean)
    .join(" ");
}

export interface PostEvalEmailArgs {
  parentFirstName: string;
  childFirstName: string;
  level: Level;
  levelDescription: string;
  observations: string;
  /** Pre-formatted upcoming-session lines (group levels only). */
  sessionLines: string[];
}

export function buildPostEvalFollowupHtml(args: PostEvalEmailArgs): string {
  const obsBlock = args.observations.trim()
    ? `<p style="font-size: 15px; line-height: 1.6; margin: 16px 0;"><strong style="color: ${c.muted};">What I saw:</strong><br/>${escape(args.observations).replace(/\n/g, "<br/>")}</p>`
    : "";

  const isPrivateBridge = isPrivateBridgeLevel(args.level);

  // The upcoming-sessions list + price + Reserve CTA, rendered only when we
  // actually have lines to show.
  const reservableBlock = args.sessionLines.length
    ? `<ul style="font-size: 15px; line-height: 1.7; padding-left: 20px;">${args.sessionLines
        .map((line) => `<li>${escape(line)}</li>`)
        .join("")}</ul>
  <p style="font-size: 15px; line-height: 1.6;">$20 per 1-hour slot.</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 16px 0;">
    <a href="${site.website}/schedule" style="${s.cta}">Reserve a slot</a>
  </p>`
    : "";

  let nextStepsBlock: string;
  if (isPrivateBridge) {
    // Foundation levels (Red/Orange) now lead with their own group court, with
    // private lessons offered as an optional fast-track underneath.
    const groupBlock = args.sessionLines.length
      ? reservableBlock
      : `<p style="font-size: 15px; line-height: 1.6;">New ${args.level} Ball sessions post regularly &mdash; reply to this email and I&rsquo;ll grab you the next open slot, or check the schedule for the latest.</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 16px 0;">
    <a href="${site.website}/schedule" style="${s.cta}">Reserve a slot</a>
  </p>`;
    nextStepsBlock = `
  <p style="font-size: 15px; line-height: 1.6;"><strong style="color: ${c.muted};">Where to go from here:</strong></p>
  <p style="font-size: 15px; line-height: 1.6;">The best fit right now is a <strong>${args.level} Ball</strong> drop-in slot &mdash; ${args.childFirstName} gets their own court at their level, so they start playing right away. Upcoming sessions:</p>
  ${groupBlock}
  <p style="font-size: 15px; line-height: 1.6; margin-top: 20px;"><strong style="color: ${c.muted};">Want to fast-track?</strong></p>
  <p style="font-size: 15px; line-height: 1.6;">A short run of <strong>private lessons</strong> (most kids need 4&ndash;6) speeds up the rally, footwork, and consistency. Just reply and I&rsquo;ll send a tailored plan and rate within 24 hours.</p>`;
  } else {
    const groupSessions = args.sessionLines.length
      ? reservableBlock
      : `<p style="font-size: 15px; line-height: 1.6;">New ${args.level} Ball sessions post regularly &mdash; reply to this email and I&rsquo;ll grab you the next open slot, or check the schedule for the latest.</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 16px 0;">
    <a href="${site.website}/schedule" style="${s.cta}">Reserve a slot</a>
  </p>`;
    nextStepsBlock = `
  <p style="font-size: 15px; line-height: 1.6;"><strong style="color: ${c.muted};">Where to go from here:</strong></p>
  <p style="font-size: 15px; line-height: 1.6;">The best fit right now is a ${args.level} Ball drop-in slot. Our current upcoming sessions:</p>
  ${groupSessions}`;
  }

  return `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 16px;">
    ${args.childFirstName === "your child" ? "Evaluation" : escape(args.childFirstName) + "'s evaluation"} — next steps
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${escape(args.parentFirstName)},</p>
  <p style="font-size: 15px; line-height: 1.6;">Thanks for bringing ${escape(args.childFirstName)} out today. Quick recap and what I'd recommend next.</p>

  <div style="${s.cardAccent}">
    <p style="margin: 0 0 4px; font-size: 13px; color: ${c.muted}; text-transform: uppercase; letter-spacing: 1px;">Starting level</p>
    <p style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: ${c.accentLime};">${escape(args.level) + " Ball"}</p>
    <p style="margin: 0; font-size: 14px; color: ${c.text}; line-height: 1.5;">${escape(args.levelDescription)}</p>
  </div>

  ${obsBlock}
  ${nextStepsBlock}

  <div style="${s.footer}">
    <p style="font-size: 14px; line-height: 1.6;">Reply to this email or text me at <a href="tel:${site.phone}" style="${s.link}">${site.phone}</a>.</p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court!<br/>
      <strong style="color: ${c.accentLime};">— Coach Sam</strong><br/>
      <span style="color: ${c.muted};">Co-Founder &amp; Head Coach, Next Gen Pickleball Academy</span><br/>
      <a href="${site.website}" style="${s.link}">nextgenpbacademy.com</a>
    </p>
  </div>
</div>`;
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
