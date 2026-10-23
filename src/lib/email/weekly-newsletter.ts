import { c, s } from "./brand";
import { appendUtm } from "./utm";
import type { CoachTip } from "@/lib/newsletter-tips";
import { seatStatusLabel } from "@/lib/seat-status";
import type { NewsletterProgram } from "@/lib/newsletter-programs";
import type { NewsletterEditorial } from "@/lib/newsletter-editorial";
import type { FallNewsletterProgress, picklParkNewsletterProgress } from "@/lib/newsletter-season-progress";
import {
  phoneLineHtml,
  phoneLineText,
  whatsappGroupsTopHtml,
  whatsappGroupsTopText,
} from "./signature";

// Layout (2026-10-23). Parents increasingly read this email through an
// assistant's summary (Apple Mail, Gmail) rather than top to bottom, and both
// skim the opening and drop the rest. So the issue leads with "At a glance":
// one dated sentence per thing a family can act on, built from the same data
// as the sections below so the two cannot disagree. Then the detail, grouped by
// who it is for: families enrolled now, ways to play, what is coming. Real
// h2/h3 headings and lists in the HTML, and the text part mirrors them section
// for section, because many readers and agents only ever see text/plain.
//
// No em dashes anywhere in this template's copy (Sam's rule for public copy);
// e2e/weekly-newsletter.spec.ts renders a full issue and fails on one.

const LESSONS_HEADING = "Private, semi-private and small-group lessons";
const YOUTH_LESSONS_COPY = "Help your player build a more consistent serve, rally or match plan with focused coaching. Choose one-on-one, semi-private (two players), or a small group at a similar level. Choose up to three available times for your player. Sam confirms the time and sends an invoice; there is no charge when you request.";
const PARENT_LESSONS_COPY = "Want coaching for your own game? Request a private lesson, a semi-private lesson with a partner, or a small-group lesson with friends. Choose up to three available times and enter your player count. Sam confirms the time and sends an invoice; there is no charge when you request.";
const SAM_LESSON_REQUEST_URL = "https://coach.sammorrispb.com/book/private-lesson";
const FORWARD_COPY = "Know a kid who'd love this? Forward this email. The community grows because parents like you make the introduction.";
const SIGNOFF = "See you on the court. Better than yesterday, together.";
const MAX_GLANCE = 6;
const MAX_SUBJECT = 78;
const MAX_PREVIEW = 150;

/** One open time slot within a date+location group. */
export interface NewsletterSessionSlot {
  label: string; // "4:30–5:30 PM"
}

/** A date+location group with one or more open slots that week. */
export interface NewsletterSessionGroup {
  dateLong: string; // "Saturday, May 23"
  location: string; // "Walter Johnson HS, Bethesda"
  slots: NewsletterSessionSlot[];
  /** Short, pre-rendered weather note for the date (county-level). Empty if unavailable. */
  weatherNote?: string;
}

/** An Open Crew Poll surfaced inside the newsletter. */
export interface NewsletterOpenPoll {
  title: string;
  slug: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  level: string;
  minPartySize: number;
  yesCount: number;
}

/** One bookable group within the fall-season block. */
export interface NewsletterFallGroup {
  /** "Green Ball" — canonical ball-color label, never a synonym. */
  label: string;
  /** "1:00–2:30 PM" */
  timeLabel: string;
  /** Seats still open, or null when the roster count couldn't be read. */
  spotsLeft: number | null;
}

export interface WeeklyNewsletterInput {
  parentFirst: string;
  /** ISO date the issue goes out (America/New_York). Dates the issue for readers and agents. */
  issueDate?: string;
  editorial?: NewsletterEditorial | null;
  programs?: NewsletterProgram[];
  /**
   * Fall calendar and registration. Once underway, show current remaining
   * dates/makeups and invite a reply about joining, without inventing a late
   * join fee. Null hides a completed season, including its recorded makeups.
   */
  fallSeason: {
    title: string;
    /** "September 20 – November 8, 2026" */
    seasonLabel: string;
    weeks: number;
    /** "Walter Johnson High School, Bethesda, MD" */
    venueLine: string;
    priceUsd: number;
    groups: NewsletterFallGroup[];
    /** UTM-stamped /fall registration URL. */
    url: string;
    progress?: FallNewsletterProgress;
    /** ISO date of the season's playoff Sunday, when it has one. */
    playoffDate?: string;
  } | null;
  /**
   * Pickl Park Saturdays. The partnership ends after the Oct 31 session, so the
   * issue carries one line for the families still playing there, never a
   * season pitch (Sam, 2026-10-23). The Pickl Park owns registration and price.
   * Absent or null renders nothing.
   */
  picklParkSeason?: {
    title: string;
    seasonLabel: string;
    weeks: number;
    /** "The Pickl Park, Frederick, MD" */
    venueLine: string;
    priceUsd?: number;
    sessionFormat: string;
    indoorNote: string;
    groups: NewsletterFallGroup[];
    url: string;
    progress?: ReturnType<typeof picklParkNewsletterProgress>;
  } | null;
  sessions: NewsletterSessionGroup[];
  /**
   * Open sessions beyond the weekly window, so parents can plan ahead.
   * Empty hides the block. Registration for any given date still opens 30 days
   * out on /schedule. Keep this block's copy season-neutral: a season word in
   * a template that ships every week is a bug with a delay on it.
   */
  laterSessions: NewsletterSessionGroup[];
  openPolls: NewsletterOpenPoll[];
  /**
   * Pre-rendered HTML for the "From Coach Sam" lead block, sourced from an
   * Approved row in the newsletter-drafts Notion DB. Null/undefined hides
   * the block — default behavior when Sam hasn't approved a draft this week.
   * See notion-newsletter-drafts.ts.
   */
  newsletterLeadHtml?: string | null;
  /** Plain-text mirror of newsletterLeadHtml for the text/plain MIME part. */
  newsletterLeadText?: string | null;
  tip: CoachTip;
  scheduleUrl: string;
  crewInterestUrl: string;
  unsubscribeUrl: string;
  /** Site origin for absolute links inside the poll cards. */
  origin: string;
  /**
   * UTM campaign label for first-party click attribution (e.g. "weekly-2026-06-04").
   * Stamps the same-origin CTAs built inside this template. The scheduleUrl /
   * crewInterestUrl passed in are already UTM-stamped by the cron.
   */
  utmCampaign: string;
  /**
   * Upcoming camp weeks. Empty hides the block. `publicArea` is the broad area
   * only, never `exactLocation` (child-safety policy in camps.ts).
   */
  camps: { weekLabel: string; publicArea: string }[];
  /** UTM-stamped /camp link. */
  campUrl: string;
  /** Minimum camp age (8) — the day-camp runs older than the 6–16 academy range. */
  campAgeMin: number;
  /** Lowest camp-option price (USD) for the "from $X/day" line. */
  campPriceFromUsd: number;
}

/** One line of "At a glance": a full sentence for the issue, a few words for the subject. */
export interface NewsletterGlance {
  text: string;
  short: string;
}

/**
 * Seat line for one fall group, or "" when the roster read failed. A null
 * count used to fall back to the group size, but the group size is exactly the
 * number this email no longer publishes, and silence beats a stale cap.
 */
export function fallSpotsLabel(g: NewsletterFallGroup): string {
  return seatStatusLabel(g.spotsLeft, { fullLabel: "Full, ask about the sub list" }) ?? "";
}

function fallGroupLine(g: NewsletterFallGroup): string {
  const spots = fallSpotsLabel(g);
  return `Sundays ${g.timeLabel} ET${spots ? ` · ${spots}` : ""}`;
}

/** "Sunday, November 8" from an ISO date, read in UTC so no zone can shift it. */
function longDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });
}

/** "Nov 8" */
function monthDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  });
}

/** "October 29, 2026" */
function issueDateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

function pollTimeRange(p: NewsletterOpenPoll): string {
  if (!p.startTime) return "";
  return p.endTime ? `${p.startTime}–${p.endTime}` : p.startTime;
}

function pollProgressLabel(p: NewsletterOpenPoll): string {
  const need = Math.max(0, p.minPartySize - p.yesCount);
  if (need <= 0) return "Locked in. Sam will text the WhatsApp group.";
  return `${p.yesCount} in · need ${need} more to lock it in`;
}

function visiblePrograms(input: WeeklyNewsletterInput): NewsletterProgram[] {
  const excluded = input.editorial?.excludedProgramKeys ?? [];
  return (input.programs ?? []).filter(p => !p.key || !excluded.includes(p.key));
}

function fallUnderway(input: WeeklyNewsletterInput): boolean {
  return input.fallSeason?.progress?.underway ?? false;
}

function upcomingPlayoff(input: WeeklyNewsletterInput): string | null {
  const playoff = input.fallSeason?.playoffDate;
  if (!playoff) return null;
  if (input.issueDate && playoff < input.issueDate) return null;
  return playoff;
}

/** The single Pickl Park line, or null once its last Saturday has passed. */
function picklParkLine(input: WeeklyNewsletterInput): NewsletterGlance | null {
  const season = input.picklParkSeason;
  const dates = season?.progress?.remainingDates ?? [];
  if (!season || !season.progress?.underway || dates.length === 0) return null;
  const last = dates[dates.length - 1];
  return dates.length === 1
    ? {
      text: `Pickl Park Saturdays in Frederick: the last session is ${longDay(last)}.`,
      short: `last Pickl Park Saturday ${monthDay(last)}`,
    }
    : {
      text: `Pickl Park Saturdays in Frederick: ${dates.length} Saturdays left, the last one ${longDay(last)}.`,
      short: `${dates.length} Pickl Park Saturdays left`,
    };
}

/** The fall season's glance line. */
function fallGlance(input: WeeklyNewsletterInput): NewsletterGlance | null {
  const fall = input.fallSeason;
  if (!fall) return null;
  if (!fallUnderway(input)) {
    return {
      text: `Fall Sunday season registration is open: ${fall.seasonLabel} at ${fall.venueLine}.`,
      short: "fall registration open",
    };
  }
  const playoff = upcomingPlayoff(input);
  const remaining = fall.progress?.scheduleNotes[0] ?? "";
  return {
    text: `Fall Sunday season at ${fall.venueLine}: ${remaining}${playoff ? ` Playoff ${longDay(playoff)}.` : ""}`.replace(/\s+$/, ""),
    short: playoff ? `fall playoff ${monthDay(playoff)}` : "fall Sundays continue",
  };
}

/**
 * "At a glance", in reading priority: what enrolled families need to know,
 * then what anyone can join this week, then what is coming. Capped so the
 * summary stays a summary.
 */
export function newsletterHighlights(input: WeeklyNewsletterInput): NewsletterGlance[] {
  const programs = visiblePrograms(input);
  const glances = (section: NewsletterProgram["section"]) =>
    programs.filter(p => p.section === section && p.glance).map(p => p.glance!);
  const out: NewsletterGlance[] = [];
  const fall = fallGlance(input);
  if (fall && fallUnderway(input)) out.push(fall);
  const pickl = picklParkLine(input);
  if (pickl) out.push(pickl);
  out.push(...glances("enrolled"));
  if (fall && !fallUnderway(input)) out.push(fall);
  if (input.sessions.length) {
    out.push({
      text: `Open drop-in sessions this week: ${input.sessions.map(g => `${g.dateLong} at ${g.location}`).join("; ")}.`,
      short: "open sessions this week",
    });
  }
  out.push(...glances("join"));
  if (input.camps.length) {
    out.push({ text: `Camp: ${input.camps[0].weekLabel}, ${input.camps[0].publicArea}.`, short: "camp coming up" });
  }
  out.push(...glances("next"));
  return out.slice(0, MAX_GLANCE);
}

/** Subject line: the approved editorial's, else built from the issue's top two items. */
export function weeklyNewsletterSubject(input: WeeklyNewsletterInput): string {
  if (input.editorial?.subject) return input.editorial.subject;
  const shorts = newsletterHighlights(input).map(h => h.short);
  if (shorts.length === 0) return `Next Gen this week: ${input.tip.title}`;
  const two = `Next Gen this week: ${shorts.slice(0, 2).join(" and ")}`;
  return shorts.length > 1 && two.length <= MAX_SUBJECT ? two : `Next Gen this week: ${shorts[0]}`;
}

/** Inbox preview text: the editorial's, else the opening glance lines, cut at a word. */
export function weeklyNewsletterPreview(input: WeeklyNewsletterInput): string {
  if (input.editorial?.previewText) return input.editorial.previewText;
  const joined = newsletterHighlights(input).map(h => h.text).join(" ");
  if (joined.length <= MAX_PREVIEW) return joined;
  const cut = joined.slice(0, MAX_PREVIEW);
  return `${cut.slice(0, cut.lastIndexOf(" "))}...`;
}

function headline(input: WeeklyNewsletterInput): string {
  return input.editorial?.headline ?? "Next Gen Pickleball Academy this week";
}

function intro(input: WeeklyNewsletterInput): string {
  return input.editorial?.intro
    ?? `Hi ${input.parentFirst}. The short version comes first, then the details for each program. Questions? Reply to this email and it goes straight to Coach Sam.`;
}

const FALL_UNDERWAY_JOIN = "Want your player to join the remaining sessions or the sub list? Reply to this email and Coach Sam will help you check availability and registration options.";

function fallJoinCopy(fall: NonNullable<WeeklyNewsletterInput["fallSeason"]>, underway: boolean): string {
  return underway
    ? FALL_UNDERWAY_JOIN
    : `$${fall.priceUsd} per player for the full season, first come, first served. Can't make all ${fall.weeks}? Reply and we'll put you on the sub list.`;
}

function fallDescription(fall: NonNullable<WeeklyNewsletterInput["fallSeason"]>, underway: boolean): string {
  return underway
    ? "Coached practice, then games with rotating partners."
    : `${fall.weeks} Sundays. Coached practice first, then a rotating-partner round robin, so your player plays with everyone in their group across the season, not just the friend they came with. One registration covers every Sunday.`;
}

function fallNotes(input: WeeklyNewsletterInput): string[] {
  const fall = input.fallSeason;
  if (!fall) return [];
  const playoff = upcomingPlayoff(input);
  return [
    ...(fall.progress?.scheduleNotes ?? []),
    ...(fall.progress?.makeupNotes ?? []),
    ...(playoff ? [`Playoff: ${longDay(playoff)}.`] : []),
  ];
}

// ---- HTML -------------------------------------------------------------------

const h2 = (text: string) =>
  `<h2 style="margin:36px 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:19px;color:${c.accentLime};">${text}</h2>`;
const h3 = (text: string) =>
  `<h3 style="margin:0 0 8px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;font-weight:900;color:${c.text};">${text}</h3>`;
const para = (html: string, muted = false) =>
  `<p style="margin:0 0 10px 0;color:${muted ? c.muted : c.text};font-size:14px;line-height:1.6;">${html}</p>`;
const list = (items: string[]) =>
  `<ul style="margin:0 0 10px 0;padding-left:20px;color:${c.text};font-size:14px;line-height:1.6;">${items.map(i => `<li style="margin:0 0 4px 0;">${i}</li>`).join("")}</ul>`;
const action = (href: string, label: string) =>
  `<p style="margin:12px 0 0 0;"><a href="${escape(href)}" style="${s.link}font-weight:700;">${escape(label)}</a></p>`;

function programCardHtml(p: NewsletterProgram): string {
  return `<div style="${s.card}">${h3(escape(p.title))}${para(escape(p.body))}${p.url ? action(p.url, p.linkLabel ?? "View details") : ""}</div>`;
}

function fallCardHtml(input: WeeklyNewsletterInput): string {
  const fall = input.fallSeason;
  if (!fall) return "";
  const underway = fallUnderway(input);
  return `<div style="${s.cardAccent}">
      ${h3(`${escape(fall.title)}: ${escape(fall.venueLine)}`)}
      ${para(escape(`${fall.seasonLabel}. ${fallDescription(fall, underway)}`))}
      ${list([
        ...fallNotes(input).map(escape),
        ...fall.groups.map(g => `<strong>${escape(g.label)}:</strong> ${escape(fallGroupLine(g))}`),
      ])}
      ${para(escape(fallJoinCopy(fall, underway)), true)}
      ${action(fall.url, underway ? "View remaining dates and weather calls" : "Register for the season")}
    </div>`;
}

export function weeklyNewsletterHtml(input: WeeklyNewsletterInput): string {
  const programs = visiblePrograms(input);
  const bySection = (section: NewsletterProgram["section"]) => programs.filter(p => p.section === section);
  const underway = fallUnderway(input);
  const pickl = picklParkLine(input);
  const highlights = newsletterHighlights(input);
  const hasLead = !!input.newsletterLeadHtml?.trim();
  // An approved editorial is the issue's headline story, so its lead opens the
  // issue. In an ordinary week the lead keeps its place below the tip.
  const leadFirst = hasLead && !!input.editorial;
  const leadHtml = hasLead ? `${h2("From Coach Sam this week")}<div style="${s.cardAccent}">${input.newsletterLeadHtml}</div>` : "";

  const enrolled = [
    underway ? fallCardHtml(input) : "",
    pickl && input.picklParkSeason
      ? `<div style="${s.card}">${h3(`Pickl Park Saturdays: ${escape(input.picklParkSeason.venueLine)}`)}${para(escape(pickl.text))}${para("The Pickl Park handles registration and fees for these sessions.", true)}</div>`
      : "",
    ...bySection("enrolled").map(programCardHtml),
  ].filter(Boolean);

  const sessionsHtml = input.sessions.length
    ? `<div style="${s.cardAccent}">
      ${h3("Open drop-in sessions this week")}
      ${para("One hour, drop-in. All times Eastern.", true)}
      ${input.sessions.map(g => `${para(`<strong>${escape(g.dateLong)}</strong>, ${escape(g.location)}`)}${list([
        ...g.slots.map(slot => escape(slot.label)),
        ...(g.weatherNote ? [`Forecast: ${escape(g.weatherNote)}`] : []),
      ])}`).join("")}
      ${action(input.scheduleUrl, "Book a spot on the schedule")}
    </div>`
    : `<div style="${s.card}">${para(`No open drop-in sessions this week. New dates post on the <a href="${escape(input.scheduleUrl)}" style="${s.link}font-weight:700;">schedule</a>.`)}</div>`;

  const laterHtml = input.laterSessions.length
    ? `<div style="${s.card}">
      ${h3("Further out on the calendar")}
      ${para("These dates are already on the calendar. Registration for each one opens 30 days out.")}
      ${list(input.laterSessions.map(g => `${escape(g.dateLong)}, ${escape(g.location)}`))}
      ${action(input.scheduleUrl, "See the full schedule")}
    </div>`
    : "";

  const campHtml = input.camps.length
    ? `<div style="${s.card}">
      ${h3("Camp")}
      ${para(`Next Gen Pickleball Camp: ages ${input.campAgeMin}+, half-day mornings, small groups. Come for a single morning or the full week.`)}
      ${list(input.camps.map(w => `${escape(w.weekLabel)}, ${escape(w.publicArea)}`))}
      ${para(`From $${input.campPriceFromUsd}/day · $150 full week.`, true)}
      ${action(input.campUrl, "See camp dates and book")}
    </div>`
    : "";

  const pollsHtml = input.openPolls.length
    ? `<div style="${s.card}">
      ${h3("Forming groups now")}
      ${para("Vote in the slots that work and Sam locks the group in when it hits the headcount.", true)}
      ${input.openPolls.map(p => `${para(`<strong>${escape(p.title)}</strong>`)}${list([
        escape([p.day, pollTimeRange(p), p.location, p.level].filter(Boolean).join(" · ")),
        escape(pollProgressLabel(p)),
        `<a href="${escape(appendUtm(`${input.origin}/poll/${encodeURIComponent(p.slug)}`, "poll", input.utmCampaign))}" style="${s.link}font-weight:700;">Vote on this slot</a>`,
      ])}`).join("")}
    </div>`
    : "";

  const crewHtml = `<div style="${s.card}">
      ${h3(input.openPolls.length ? "None of these fit?" : "Want a regular group?")}
      ${para("Tell us your player's level and the days that work. Sam looks for 3 more kids who match and texts the WhatsApp link when the slot has takers.")}
      ${action(input.crewInterestUrl, "Find your player's group")}
    </div>`;

  const lessonsHtml = `<div style="${s.card}">
      <h3 style="margin:0 0 6px 0;font-size:15px;color:${c.text};">For your player</h3>
      ${para(escape(YOUTH_LESSONS_COPY))}
      <p style="margin:0 0 18px 0;"><a href="${escape(appendUtm(`${input.origin}/lessons/book`, "youth-lessons", input.utmCampaign))}" style="${s.link}font-weight:700;">Request a youth lesson</a> &middot; <a href="sms:+13013254731" style="${s.link}">Text Coach Sam</a></p>
      <h3 style="margin:0 0 6px 0;font-size:15px;color:${c.text};">For parents who play</h3>
      ${para(escape(PARENT_LESSONS_COPY))}
      <p style="margin:0;"><a href="${escape(appendUtm(SAM_LESSON_REQUEST_URL, "parent-lessons", input.utmCampaign))}" style="${s.link}font-weight:700;">Request a private or group lesson with Sam</a></p>
    </div>`;

  const next = bySection("next");
  const dateLine = input.issueDate
    ? ` · <time datetime="${escape(input.issueDate)}">Week of ${escape(issueDateLabel(input.issueDate))}</time>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(weeklyNewsletterSubject(input))}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(weeklyNewsletterPreview(input))}</div>
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Next Gen this week${dateLine}</p>
    <h1 style="${s.heading} margin:0 0 14px 0;">${escape(headline(input))}</h1>
    ${para(escape(intro(input)))}

    ${leadFirst ? leadHtml : ""}

    ${highlights.length ? `${h2("At a glance")}${list(highlights.map(h => escape(h.text)))}` : ""}

    ${whatsappGroupsTopHtml()}

    ${enrolled.length ? `${h2("For families enrolled now")}${enrolled.join("\n")}` : ""}

    ${h2("Ways to play")}
    ${underway ? "" : fallCardHtml(input)}
    ${bySection("join").map(programCardHtml).join("\n")}
    ${sessionsHtml}
    ${laterHtml}
    ${campHtml}
    ${pollsHtml}
    ${crewHtml}

    ${next.length ? `${h2("Coming up")}${next.map(programCardHtml).join("\n")}` : ""}

    ${h2(`Coach tip: ${escape(input.tip.title)}`)}
    ${para(escape(input.tip.body))}

    ${leadFirst ? "" : leadHtml}

    ${h2(LESSONS_HEADING)}
    ${lessonsHtml}

    <div style="${s.card}">${para(escape(FORWARD_COPY))}</div>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        ${escape(SIGNOFF)}<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      ${phoneLineHtml()}
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        You&rsquo;re receiving Next Gen updates because you signed up for the newsletter or connected with us through an inquiry or program.
        <a href="${input.unsubscribeUrl}" style="color:${c.muted};text-decoration:underline;">Unsubscribe</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ---- Plain text -------------------------------------------------------------
// Markdown-style headings and bullets: readable as-is, and the structure an
// assistant or agent reading text/plain can parse into sections.

function programLines(p: NewsletterProgram): string[] {
  return [`### ${p.title}`, p.body, ...(p.url ? [`${p.linkLabel ?? "View details"}: ${p.url}`] : []), ""];
}

function fallLines(input: WeeklyNewsletterInput): string[] {
  const fall = input.fallSeason;
  if (!fall) return [];
  const underway = fallUnderway(input);
  return [
    `### ${fall.title}: ${fall.venueLine}`,
    `${fall.seasonLabel}. ${fallDescription(fall, underway)}`,
    ...fallNotes(input).map(n => `- ${n}`),
    ...fall.groups.map(g => `- ${g.label}: ${fallGroupLine(g)}`),
    fallJoinCopy(fall, underway),
    `${underway ? "View remaining dates and weather calls" : "Register for the season"}: ${fall.url}`,
    "",
  ];
}

export function weeklyNewsletterText(input: WeeklyNewsletterInput): string {
  const programs = visiblePrograms(input);
  const bySection = (section: NewsletterProgram["section"]) => programs.filter(p => p.section === section);
  const underway = fallUnderway(input);
  const pickl = picklParkLine(input);
  const highlights = newsletterHighlights(input);
  const lines: string[] = [
    `# ${headline(input)}`,
    ...(input.issueDate ? [`Week of ${issueDateLabel(input.issueDate)}`] : []),
    "",
    intro(input),
    "",
  ];

  const lead = input.newsletterLeadText?.trim()
    ? ["## From Coach Sam this week", "", input.newsletterLeadText.trim(), ""]
    : [];
  const leadFirst = lead.length > 0 && !!input.editorial;
  if (leadFirst) lines.push(...lead);

  if (highlights.length) lines.push("## At a glance", ...highlights.map(h => `- ${h.text}`), "");

  lines.push(whatsappGroupsTopText(), "");

  const enrolled: string[] = [
    ...(underway ? fallLines(input) : []),
    ...(pickl && input.picklParkSeason
      ? [`### Pickl Park Saturdays: ${input.picklParkSeason.venueLine}`, pickl.text, "The Pickl Park handles registration and fees for these sessions.", ""]
      : []),
    ...bySection("enrolled").flatMap(programLines),
  ];
  if (enrolled.length) lines.push("## For families enrolled now", "", ...enrolled);

  lines.push("## Ways to play", "");
  if (!underway) lines.push(...fallLines(input));
  for (const p of bySection("join")) lines.push(...programLines(p));

  if (input.sessions.length) {
    lines.push("### Open drop-in sessions this week", "One hour, drop-in. All times Eastern.");
    for (const g of input.sessions) {
      lines.push(`${g.dateLong}, ${g.location}`);
      for (const slot of g.slots) lines.push(`- ${slot.label}`);
      if (g.weatherNote) lines.push(`- Forecast: ${g.weatherNote}`);
    }
    lines.push(`Book a spot on the schedule: ${input.scheduleUrl}`, "");
  } else {
    lines.push(`No open drop-in sessions this week. New dates post on the schedule: ${input.scheduleUrl}`, "");
  }

  if (input.laterSessions.length) {
    lines.push(
      "### Further out on the calendar",
      "These dates are already on the calendar. Registration for each one opens 30 days out.",
      ...input.laterSessions.map(g => `- ${g.dateLong}, ${g.location}`),
      `See the full schedule: ${input.scheduleUrl}`,
      "",
    );
  }

  if (input.camps.length) {
    lines.push(
      "### Camp",
      `Next Gen Pickleball Camp: ages ${input.campAgeMin}+, half-day mornings, small groups. Come for a single morning or the full week.`,
      ...input.camps.map(w => `- ${w.weekLabel}, ${w.publicArea}`),
      `From $${input.campPriceFromUsd}/day · $150 full week.`,
      `See camp dates and book: ${input.campUrl}`,
      "",
    );
  }

  if (input.openPolls.length) {
    lines.push("### Forming groups now", "Vote in the slots that work and Sam locks the group in when it hits the headcount.");
    for (const p of input.openPolls) {
      lines.push(
        p.title,
        `- ${[p.day, pollTimeRange(p), p.location, p.level].filter(Boolean).join(" · ")}`,
        `- ${pollProgressLabel(p)}`,
        `- Vote: ${appendUtm(`${input.origin}/poll/${encodeURIComponent(p.slug)}`, "poll", input.utmCampaign)}`,
      );
    }
    lines.push("");
  }

  lines.push(
    `### ${input.openPolls.length ? "None of these fit?" : "Want a regular group?"}`,
    "Tell us your player's level and the days that work. Sam looks for 3 more kids who match and texts the WhatsApp link when the slot has takers.",
    `Find your player's group: ${input.crewInterestUrl}`,
    "",
  );

  const next = bySection("next");
  if (next.length) lines.push("## Coming up", "", ...next.flatMap(programLines));

  lines.push(
    `## Coach tip: ${input.tip.title}`,
    input.tip.body,
    "",
    ...(leadFirst ? [] : lead),
    `## ${LESSONS_HEADING}`,
    "### For your player",
    YOUTH_LESSONS_COPY,
    `Request a youth lesson: ${appendUtm(`${input.origin}/lessons/book`, "youth-lessons", input.utmCampaign)}`,
    "Text Coach Sam: sms:+13013254731",
    "",
    "### For parents who play",
    PARENT_LESSONS_COPY,
    `Request a private or group lesson with Sam: ${appendUtm(SAM_LESSON_REQUEST_URL, "parent-lessons", input.utmCampaign)}`,
    "",
    FORWARD_COPY,
    "",
    SIGNOFF,
    "Coach Sam · Next Gen Pickleball Academy",
    "",
    phoneLineText(),
    "",
    "You're receiving Next Gen updates because you signed up for the newsletter or connected with us through an inquiry or program.",
    `Unsubscribe: ${input.unsubscribeUrl}`,
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
