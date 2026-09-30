import { upcomingMvfPrograms, isMvfProgramInProgress, mvfClassesRemaining, MVF_AGE_MIN, MVF_AGE_MAX, type MvfProgram } from "@/data/mvf";
import {
  MVF_JUNIOR_TOURNAMENT_DATE_ISO, MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL, MVF_JUNIOR_TOURNAMENT_VENUE,
  RESIDENT_PRICE_USD, NONRESIDENT_PRICE_USD,
} from "@/data/mvf-junior-tournament-2026";
import { MONDAY_GIRLS_MONDAYS, MONDAY_GIRLS_TIME_LABEL, MONDAY_GIRLS_AGE_MIN, MONDAY_GIRLS_AGE_MAX, MONDAY_GIRLS_VENUE_SHORT } from "@/data/monday-girls-2026";
import { appendUtm } from "./email/utm";

export interface NewsletterProgram {
  key?: string;
  enrolling?: boolean;
  title: string;
  body: string;
  url?: string;
  linkLabel?: string;
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
    const times = session.map(p => `${p.levelLabel.split(" / ").join(" Ball / ")} Ball ${p.timeLabel} ET`).join("; ");
    const venues = [...new Set(session.map(p => p.venue.center))].join(" / ");
    const prices = first.prices.map(price => `$${price.usd} ${price.label}`).join(" / ");
    programs.push({
      key: `mvf-${first.key.replace(/-(beginner|advanced)$/, "")}`,
      enrolling: !underway,
      title: `Montgomery Village — ${name}${underway ? " (underway)" : " — enrolling now"}`,
      body: `${underway ? `The session is already underway, with ${mvfClassesRemaining(first, today)} of ${first.classCount} Thursdays still to come.` : `Your player can start with ${first.classCount} Thursdays of coached practice and games.`} ${first.dateLabel}. ${times}. Ages ${MVF_AGE_MIN}–${MVF_AGE_MAX} at ${venues}. ${underway ? "Before registering, ask MVF about joining the remaining classes and the current fee." : `${prices} for all ${first.classCount} classes. Register and pay through MVF.`} Check the current venue with MVF before heading out.`,
      url: link("/montgomery-village-youth-pickleball", underway ? "mvf-underway" : "mvf-enrollment"),
      linkLabel: underway ? "View remaining MVF classes" : "View MVF classes and register",
    });
  }
  if (today <= MVF_JUNIOR_TOURNAMENT_DATE_ISO) programs.push({
    title: "Montgomery Village junior tournament",
    body: `${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL} ET at ${MVF_JUNIOR_TOURNAMENT_VENUE}. 10U and 14U divisions, with rotating partners and at least four games per player. From $${RESIDENT_PRICE_USD} per player: $${RESIDENT_PRICE_USD} for Montgomery Village residents, $${NONRESIDENT_PRICE_USD} for non-residents. Register through Next Gen.`,
    url: link("/mvf-junior-tournament", "mvf-tournament"), linkLabel: "View tournament details",
  });
  if (MONDAY_GIRLS_MONDAYS.some(date => date >= today)) programs.push({
    title: "Monday girls beginner group — Rockville",
    body: `Mondays ${MONDAY_GIRLS_TIME_LABEL} ET at ${MONDAY_GIRLS_VENUE_SHORT} in Rockville. Girls ages ${MONDAY_GIRLS_AGE_MIN}–${MONDAY_GIRLS_AGE_MAX}, from beginners to advanced beginners, build confidence through coached practice and games together. See the remaining dates and current registration options.`,
    url: link("/monday-girls", "monday-girls"), linkLabel: "View the girls group",
  });
  // Sam requested these interest checks on 2026-09-28. They have no paid
  // registration or confirmed winter calendar. Review before the target
  // November opening rather than mailing an unconfirmed launch forever.
  if (today >= "2026-09-28" && today <= "2026-11-08") programs.push({
    key: "winter-interest",
    title: "Winter league interest — Montgomery Village and Frederick",
    body: "Planning ahead for your player? We're working toward indoor winter leagues at Lake Marion Community Center through MVF and The Pickl Park in Frederick. The proposed Green Ball and Yellow Ball format pairs coached practice with games where partners rotate. Dates, times and host agreements are still being finalized; registration is not open. Reply with ‘winter’ and your preferred location to express interest.",
  });
  if (today >= "2026-09-28" && today <= "2026-10-25") programs.push({
    title: "Interest check: Sunday Orange Ball drills",
    body: "Would Sundays 12:00–1:00 PM ET at Walter Johnson High School work for your player? We're checking interest in a weekly Orange Ball drill session for players building more consistent rallies. Reply with ‘Orange Ball’ if you're interested. This is an interest check; the session and start date are not confirmed.",
  });
  return programs;
}
