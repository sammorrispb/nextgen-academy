import { upcomingMvfPrograms } from "@/data/mvf";
import {
  MVF_JUNIOR_TOURNAMENT_DATE_ISO, MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL, MVF_JUNIOR_TOURNAMENT_VENUE,
} from "@/data/mvf-junior-tournament-2026";
import { MONDAY_GIRLS_MONDAYS, MONDAY_GIRLS_TIME_LABEL, MONDAY_GIRLS_AGE_MIN, MONDAY_GIRLS_AGE_MAX, MONDAY_GIRLS_VENUE_SHORT } from "@/data/monday-girls-2026";
import { appendUtm } from "./email/utm";

export interface NewsletterProgram {
  title: string;
  body: string;
  url?: string;
  linkLabel?: string;
}

export function newsletterPrograms(today: string, origin: string, campaign: string): NewsletterProgram[] {
  const programs: NewsletterProgram[] = [];
  const link = (path: string, content: string) => appendUtm(`${origin}${path}`, content, campaign);
  const mvf = upcomingMvfPrograms(today);
  if (mvf.length) {
    const dates = [...new Set(mvf.map(p => p.dateLabel))].join("; ");
    const times = [...new Set(mvf.map(p => `${p.levelLabel.split(" / ").join(" Ball / ")} Ball ${p.timeLabel} ET`))].join("; ");
    const venues = [...new Set(mvf.map(p => p.venue.center))].join(" / ");
    programs.push({
      title: "Montgomery Village classes — fall and late fall",
      body: `Your player can keep building with a weekly Thursday class. ${dates}. ${times}. Ages 8–16 at ${venues}. Register and pay through MVF; check the current venue with MVF before heading out.`,
      url: link("/montgomery-village-youth-pickleball", "mvf-classes"), linkLabel: "View MVF classes",
    });
  }
  if (today <= MVF_JUNIOR_TOURNAMENT_DATE_ISO) programs.push({
    title: "Montgomery Village junior tournament",
    body: `${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL} ET at ${MVF_JUNIOR_TOURNAMENT_VENUE}. 10U and 14U divisions, with rotating partners and at least four games per player. Your player gets to put their practice into games with new partners.`,
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
    title: "Winter league interest — Montgomery Village and Frederick",
    body: "Planning ahead for your player? We're working toward indoor winter leagues at Lake Marion Community Center through MVF and The Pickl Park in Frederick. The proposed Green Ball and Yellow Ball format pairs coached practice with games where partners rotate. Dates, times and host agreements are still being finalized; registration is not open. Reply with ‘winter’ and your preferred location to express interest.",
  });
  if (today >= "2026-09-28" && today <= "2026-10-25") programs.push({
    title: "Interest check: Sunday Orange Ball drills",
    body: "Would Sundays 12:00–1:00 PM ET at Walter Johnson High School work for your player? We're checking interest in a weekly Orange Ball drill session for players building more consistent rallies. Reply with ‘Orange Ball’ if you're interested. This is an interest check; the session and start date are not confirmed.",
  });
  return programs;
}
