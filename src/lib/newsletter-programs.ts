import { upcomingMvfPrograms, isMvfProgramInProgress, mvfClassesRemaining, MVF_AGE_MIN, MVF_AGE_MAX, type MvfProgram } from "@/data/mvf";
import {
  MVF_JUNIOR_TOURNAMENT_DATE_ISO, MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL, MVF_JUNIOR_TOURNAMENT_WHERE_LINE, RAIN_OR_SHINE_TEXT,
  RESIDENT_PRICE_USD, NONRESIDENT_PRICE_USD,
} from "@/data/mvf-junior-tournament-2026";
import { MONDAY_GIRLS_MONDAYS, MONDAY_GIRLS_TIME_LABEL, MONDAY_GIRLS_AGE_MIN, MONDAY_GIRLS_AGE_MAX, MONDAY_GIRLS_VENUE_SHORT } from "@/data/monday-girls-2026";
import { appendUtm } from "./email/utm";

/**
 * Which part of the issue a program belongs in. Parents and the assistants that
 * summarize mail for them both look for "the part about my player": a family
 * already enrolled wants its remaining dates, a new family wants what it can
 * join, and anything unconfirmed belongs under what is coming next.
 */
export type NewsletterProgramSection = "enrolled" | "join" | "next";

export interface NewsletterProgram {
  key?: string;
  section: NewsletterProgramSection;
  title: string;
  body: string;
  url?: string;
  linkLabel?: string;
  /**
   * One dated sentence for the issue's "At a glance" list, plus a few words for
   * the subject line. Omitted for programs that should not lead the issue.
   */
  glance?: { text: string; short: string };
}

/** "Thu, Nov 19" from an ISO date-only string, read in UTC so no zone can shift it. */
function shortDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

export function newsletterPrograms(today: string, origin: string, campaign: string): NewsletterProgram[] {
  const programs: NewsletterProgram[] = [];
  const link = (path: string, content: string) => appendUtm(`${origin}${path}`, content, campaign);
  const mvf = upcomingMvfPrograms(today);
  const sessions = new Map<string, MvfProgram[]>();
  for (const program of mvf) {
    const sessionKey = `${program.startDate}:${program.endDate}`;
    sessions.set(sessionKey, [...(sessions.get(sessionKey) ?? []), program]);
  }
  const ordered = [...sessions.values()].sort((a, b) =>
    Number(isMvfProgramInProgress(a[0], today)) - Number(isMvfProgramInProgress(b[0], today)) ||
    a[0].startDate.localeCompare(b[0].startDate));
  for (const session of ordered) {
    const first = session[0];
    const underway = isMvfProgramInProgress(first, today);
    const name = first.title.split(" — ")[0];
    const remaining = mvfClassesRemaining(first, today);
    const times = session.map(p => `${p.levelLabel.split(" / ").join(" Ball / ")} Ball ${p.timeLabel} ET`).join("; ");
    const venues = [...new Set(session.map(p => p.venue.center))].join(" / ");
    const prices = first.prices.map(price => `$${price.usd} ${price.label}`).join(" / ");
    programs.push({
      key: `mvf-${first.key.replace(/-(beginner|advanced)$/, "")}`,
      section: underway ? "enrolled" : "join",
      title: `Montgomery Village: ${name}${underway ? " (underway)" : ", enrolling now"}`,
      body: `${underway ? `The session is already underway, with ${remaining} of ${first.classCount} Thursdays still to come.` : `Your player can start with ${first.classCount} Thursdays of coached practice and games.`} ${first.dateLabel}. ${times}. Ages ${MVF_AGE_MIN}–${MVF_AGE_MAX} at ${venues}. ${underway ? "Before registering, ask MVF about joining the remaining classes and the current fee." : `${prices} for all ${first.classCount} classes. Register and pay through MVF.`} Check the current venue with MVF before heading out.`,
      url: link("/montgomery-village-youth-pickleball", underway ? "mvf-underway" : "mvf-enrollment"),
      linkLabel: underway ? "View remaining MVF classes" : "View MVF classes and register",
      glance: underway
        ? {
          text: `Montgomery Village Thursday classes: ${remaining} of ${first.classCount} left, last class ${shortDay(first.endDate)}.`,
          short: `${remaining} MVF ${remaining === 1 ? "Thursday" : "Thursdays"} left`,
        }
        : { text: `Montgomery Village ${name} is enrolling now and starts ${shortDay(first.startDate)}.`, short: "MVF classes enrolling" },
    });
  }
  if (today <= MVF_JUNIOR_TOURNAMENT_DATE_ISO) programs.push({
    key: "mvf-junior-tournament",
    section: "join",
    title: "Montgomery Village junior tournament",
    body: `${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL} ET at ${MVF_JUNIOR_TOURNAMENT_WHERE_LINE} ${RAIN_OR_SHINE_TEXT} 10U and 14U divisions, with rotating partners and at least four games per player. From $${RESIDENT_PRICE_USD} per player: $${RESIDENT_PRICE_USD} for Montgomery Village residents, $${NONRESIDENT_PRICE_USD} for non-residents. Register through Next Gen.`,
    url: link("/mvf-junior-tournament", "mvf-tournament"), linkLabel: "View tournament details",
    glance: {
      text: `Junior tournament (10U and 14U): ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL} in Montgomery Village. Register through Next Gen.`,
      short: `junior tournament ${shortDay(MVF_JUNIOR_TOURNAMENT_DATE_ISO).replace(/^\w+, /, "")}`,
    },
  });
  const girlsRemaining = MONDAY_GIRLS_MONDAYS.filter(date => date >= today);
  if (girlsRemaining.length) programs.push({
    section: today >= MONDAY_GIRLS_MONDAYS[0] ? "enrolled" : "join",
    title: "Monday girls beginner group, Rockville",
    body: `Mondays ${MONDAY_GIRLS_TIME_LABEL} ET at ${MONDAY_GIRLS_VENUE_SHORT} in Rockville. Girls ages ${MONDAY_GIRLS_AGE_MIN}–${MONDAY_GIRLS_AGE_MAX}, from beginners to advanced beginners, build confidence through coached practice and games together. See the remaining dates and current registration options.`,
    url: link("/monday-girls", "monday-girls"), linkLabel: "View the girls group",
    glance: {
      text: `Monday girls group in Rockville: ${girlsRemaining.length} ${girlsRemaining.length === 1 ? "Monday" : "Mondays"} left, ${MONDAY_GIRLS_TIME_LABEL} ET, last one ${shortDay(girlsRemaining[girlsRemaining.length - 1])}.`,
      short: "Monday girls group",
    },
  });
  // Sam requested these interest checks on 2026-09-28. They have no paid
  // registration or confirmed winter calendar. Retired on 2026-10-18: Sam ended
  // the MVF and Pickl Park partnerships after Fall, so neither winter league
  // this card names will run.
  if (today >= "2026-09-28" && today <= "2026-10-17") programs.push({
    key: "winter-interest",
    section: "next",
    title: "Winter league interest: Montgomery Village and Frederick",
    body: "Planning ahead for your player? We're working toward indoor winter leagues at Lake Marion Community Center through MVF and The Pickl Park in Frederick. The proposed Green Ball and Yellow Ball format pairs coached practice with games where partners rotate. Dates, times and host agreements are still being finalized; registration is not open. Reply with ‘winter’ and your preferred location to express interest.",
  });
  // The replacement (Sam, 2026-10-23): say winter is coming without naming a
  // venue, a date or a price until the winter program is confirmed. Retire or
  // replace this once it is; an unconfirmed promise must not run forever.
  if (today >= "2026-10-18" && today <= "2026-11-30") programs.push({
    key: "winter-interest",
    section: "next",
    title: "Winter: details coming soon",
    body: "We're setting up indoor winter play for Next Gen players. Location, dates and registration will be in this email as soon as they are confirmed; nothing is open yet. Want to hear first? Reply with ‘winter’.",
    glance: { text: "Winter: indoor plans are being finalized. Details here once confirmed; reply ‘winter’ to hear first.", short: "winter details soon" },
  });
  if (today >= "2026-09-28" && today <= "2026-10-25") programs.push({
    section: "next",
    title: "Interest check: Sunday Orange Ball drills",
    body: "Would Sundays 12:00–1:00 PM ET at Walter Johnson High School work for your player? We're checking interest in a weekly Orange Ball drill session for players building more consistent rallies. Reply with ‘Orange Ball’ if you're interested. This is an interest check; the session and start date are not confirmed.",
  });
  return programs;
}
