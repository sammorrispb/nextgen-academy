import { c, s } from "./brand";
import { whatsappInviteHtml, whatsappInviteText } from "./whatsapp-invite";
import {
  FALL_END_TIME,
  FALL_NO_HOLD_NOTE,
  FALL_PROGRAMS,
  FALL_SEASON_LABEL,
  FALL_SEASON_WEEKS,
  FALL_START_TIME,
  FALL_VENUE_SHORT,
  SLOTS_PER_GROUP,
  type FallProgram,
} from "@/data/fall-2026";

/**
 * The fall-season feedback broadcast. One template, two variants:
 *   nga — goes to the NGA parent lists; leads with the youth season.
 *   ld  — goes to the Link & Dink subscriber list; leads with the adult round
 *         robin, because that's what an adult reader is deciding about.
 * Both variants carry BOTH programs: parents are actively encouraged to play in
 * the adult block while their kid is on the next court, and plenty of L&D
 * players have kids.
 *
 * NO PRICE APPEARS HERE, in either variant. There is no Stripe product for a
 * season, and the standing NGA rule is that we never quote a price that doesn't
 * exist. The survey asks what a season would be worth instead. A dollar figure
 * in this file is a test failure (e2e/fall-survey.spec.ts).
 */

export type FallSurveyVariant = "nga" | "ld";

export interface FallSurveyInput {
  firstName: string;
  variant: FallSurveyVariant;
  /** UTM-stamped /fall link — the single CTA. */
  fallUrl: string;
  /** Signed unsubscribe link, or null for recipients who aren't on a list. */
  unsubscribeUrl: string | null;
}

export function fallSurveySubject(variant: FallSurveyVariant): string {
  return variant === "ld"
    ? "Fall round robin at Wood MS — does this work for you?"
    : "Planning fall at Wood MS — tell us if this works";
}

function programsInOrder(variant: FallSurveyVariant): FallProgram[] {
  const youth = FALL_PROGRAMS.find((p) => p.track === "youth")!;
  const adult = FALL_PROGRAMS.find((p) => p.track === "adult")!;
  return variant === "ld" ? [adult, youth] : [youth, adult];
}

function programCardHtml(p: FallProgram): string {
  return `<div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${p.who}</p>
      <h2 style="font-family:Montserrat,Arial,sans-serif;color:${c.text};font-size:18px;margin:0 0 10px 0;">${p.name}</h2>
      <p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.6;">${p.format}</p>
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        ${SLOTS_PER_GROUP} spots in each ${p.groupNoun} &mdash; ${p.groups.join(" &middot; ")}
      </p>
    </div>`;
}

function programCardText(p: FallProgram): string {
  // Program names stay in title case — they're brand names, not section
  // headers, and "LINK & DINK" reads as shouting.
  return [
    p.name,
    p.who,
    p.format,
    `${SLOTS_PER_GROUP} spots in each ${p.groupNoun} — ${p.groups.join(" · ")}`,
  ].join("\n");
}

export function fallSurveyHtml(input: FallSurveyInput): string {
  const { firstName, variant, fallUrl, unsubscribeUrl } = input;

  const unsubBlock = unsubscribeUrl
    ? `<p style="margin:12px 0 0 0;color:${c.muted};font-size:12px;line-height:1.6;">
        Don&rsquo;t want these? <a href="${unsubscribeUrl}" style="color:${c.muted};text-decoration:underline;">Unsubscribe</a>.
      </p>`
    : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px 12px;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Fall 2026 &mdash; we need your read</p>
    <h1 style="${s.heading} margin:0 0 20px 0;">Hey ${escape(firstName)} &mdash; would this fall work?</h1>

    <p style="margin:0 0 20px 0;color:${c.text};font-size:15px;line-height:1.65;">
      We&rsquo;re looking at ${FALL_SEASON_WEEKS} weeks at ${FALL_VENUE_SHORT},
      <strong>Saturdays and Sundays, ${FALL_START_TIME}&ndash;${FALL_END_TIME}</strong>,
      running ${FALL_SEASON_LABEL}. Two programs, same window, so a family can come
      together and everybody plays.
    </p>

    ${programsInOrder(variant).map(programCardHtml).join("")}

    <div style="${s.card}">
      <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.muted};font-weight:700;">How it would work</p>
      <p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.6;">
        <strong>${SLOTS_PER_GROUP} spots per group, first come first serve.</strong>
        Small on purpose &mdash; everybody gets real reps and real games.
      </p>
      <p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.6;">
        <strong>It&rsquo;s a full season.</strong> You&rsquo;d commit to all
        ${FALL_SEASON_WEEKS} weeks and pay for the season up front. That&rsquo;s what
        keeps a group together and keeps the round robin worth showing up for.
      </p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">
        <strong>Can&rsquo;t commit to all ${FALL_SEASON_WEEKS} weeks?</strong> There&rsquo;s a
        sub list. Tell us and we&rsquo;ll call you when a spot opens week to week.
      </p>
    </div>

    <p style="margin:0 0 20px 0;color:${c.text};font-size:15px;line-height:1.65;">
      Before we book the courts, we want to hear from you &mdash; whether the days work,
      which group you&rsquo;d be in, whether a full season is realistic, and what a season
      like this would be worth to you. It takes about a minute.
    </p>

    <p style="margin:0 0 24px 0;">
      <a href="${fallUrl}" style="${s.cta}">Tell us what works &rarr;</a>
    </p>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">No pressure, nothing to pay</p>
      <p style="margin:8px 0 0 0;color:${c.text};font-size:14px;line-height:1.6;">${FALL_NO_HOLD_NOTE}</p>
    </div>

    ${whatsappInviteHtml()}

    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        Coach Sam<br>
        Next Gen Pickleball Academy &middot; Link &amp; Dink
      </p>
      ${unsubBlock}
    </div>
  </div>
</body>
</html>`;
}

export function fallSurveyText(input: FallSurveyInput): string {
  const { firstName, variant, fallUrl, unsubscribeUrl } = input;

  const lines: string[] = [
    `Hey ${firstName} — would this fall work?`,
    "",
    `We're looking at ${FALL_SEASON_WEEKS} weeks at ${FALL_VENUE_SHORT}, Saturdays and Sundays, ${FALL_START_TIME}–${FALL_END_TIME}, running ${FALL_SEASON_LABEL}. Two programs, same window, so a family can come together and everybody plays.`,
    "",
  ];

  for (const p of programsInOrder(variant)) {
    lines.push(programCardText(p), "");
  }

  lines.push(
    "HOW IT WOULD WORK",
    `${SLOTS_PER_GROUP} spots per group, first come first serve. Small on purpose — everybody gets real reps and real games.`,
    `It's a full season. You'd commit to all ${FALL_SEASON_WEEKS} weeks and pay for the season up front. That's what keeps a group together and keeps the round robin worth showing up for.`,
    `Can't commit to all ${FALL_SEASON_WEEKS} weeks? There's a sub list. Tell us and we'll call you when a spot opens week to week.`,
    "",
    "Before we book the courts, we want to hear from you — whether the days work, which group you'd be in, whether a full season is realistic, and what a season like this would be worth to you. It takes about a minute.",
    "",
    `Tell us what works: ${fallUrl}`,
    "",
    "NO PRESSURE, NOTHING TO PAY",
    FALL_NO_HOLD_NOTE,
    "",
    whatsappInviteText(),
    "",
    "Coach Sam",
    "Next Gen Pickleball Academy · Link & Dink",
  );

  if (unsubscribeUrl) {
    lines.push("", `Unsubscribe: ${unsubscribeUrl}`);
  }

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
