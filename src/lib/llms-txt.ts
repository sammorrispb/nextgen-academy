// llms.txt for nextgenpbacademy.com (llmstxt.org convention) — served at
// /llms.txt and mirrored at /.well-known/llms.txt. One string, one place.
// Follows the same conventions as the Link & Dink hosts' llms.txt files.
//
// NOTHING SEASON-SPECIFIC IS TYPED HERE. Every date, venue, age band and
// level below is interpolated from the season data files, because this is the
// THIRD surface to publish the same facts (after the page and the events
// feed) and a hand-typed third copy is a fact that can only go stale. When a
// season moves, its data file is the one edit; this file follows.
//
// The routes are `force-static`, so this string is baked at build time and
// refreshes on deploy. That is fine for structure and stale for a finished
// season — hence `activeSeasonLines()`, which drops a season from the listing
// once its last date has passed rather than advertising a season that is over.
// Same lesson `upcomingMvfPrograms` carries: a date in a data file is not a
// filter, and a season that ships every week rots the moment nothing prunes it.
//
// WHICH SURFACES TAKE MONEY IS LOAD-BEARING, not a detail. Three programs are
// registered and paid for OFF this site (Pickl Park via podplay, MVF via
// ActiveCommunities), and three more (/league, /clusters, /crew) have NO
// registration at all — they are interest lists. An assistant that tells a
// parent to "sign up on nextgenpbacademy.com" for any of those six has
// invented a checkout that does not exist, which is the fabrication the ground
// rules below exist to stop. Each entry states who takes the money.

import { FALL_PUBLIC_AREA, FALL_SEASON_LABEL, FALL_SUNDAYS, FALL_VENUE_SHORT, FALL_YOUTH_BLOCKS } from "@/data/fall-2026";
import { MVF_AGE_MAX, MVF_AGE_MIN } from "@/data/mvf";
import {
  PICKLPARK_PUBLIC_AREA,
  PICKLPARK_SATURDAYS,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_VENUE_SHORT,
} from "@/data/picklpark-2026";
import { PICKLPARK_LEAGUES } from "@/data/picklpark-leagues-2026";

/** "Green 1:00 PM–2:30 PM, Yellow 2:30 PM–4:00 PM" — derived, never typed. */
const FALL_BLOCKS_LINE = FALL_YOUTH_BLOCKS.map(
  (b) => `${b.level} ${b.startTime}–${b.endTime}`,
).join(", ");

/** "Kid's Drill and Play (Ages 8–13, 2:00–3:00 PM); Youth League (…)" */
const PICKLPARK_LEAGUES_LINE = PICKLPARK_LEAGUES.map(
  (l) => `${l.title} (${l.ageLabel}, ${l.timeLabel})`,
).join("; ");

/**
 * Wrap one bullet to the file's ~78-column house style, continuation lines
 * indented two spaces. The evergreen entries below are hand-wrapped; the
 * season and partner entries are interpolated from data files whose values
 * change length, so they are wrapped here instead of being re-flowed by hand
 * every time a venue is renamed. Splits on spaces only — never inside a URL,
 * which is why an over-long word is allowed to overhang rather than break.
 */
export function wrapEntry(text: string, width = 78): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      // Every line after the first is a continuation, including this one —
      // deriving the indent from `lines.length` BEFORE the push left the first
      // wrapped line flush and only indented from the second onward.
      line = `  ${word}`;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/** Last date of a season, for the past-season prune below. */
function lastDate(dates: readonly string[]): string {
  return dates[dates.length - 1];
}

/** Interpolated, so the age band can never drift from the MVF data file. */
const MVF_ENTRY = wrapEntry(
  `- https://nextgenpbacademy.com/montgomery-village-youth-pickleball — Youth ` +
    `pickleball classes with the Montgomery Village Foundation, ages ` +
    `${MVF_AGE_MIN}–${MVF_AGE_MAX}, at MVF courts in Montgomery Village, MD. ` +
    `Six-week Thursday sessions split into Red/Orange and Green/Yellow ` +
    `brackets, each its own MVF activity. REGISTRATION AND PAYMENT ARE MVF'S, ` +
    `through their ActiveCommunities portal — the page deep-links each ` +
    `activity. Fees are MVF's, and they rise 10% three days before a ` +
    `session's first class.`,
);

interface SeasonEntry {
  /** The season's final date (ISO date-only, ET). Past this, it is dropped. */
  endsOn: string;
  line: string;
}

const SEASON_ENTRIES: readonly SeasonEntry[] = [
  {
    endsOn: lastDate(FALL_SUNDAYS),
    line:
      `- https://nextgenpbacademy.com/fall — Youth Fall Season: six Sundays at ` +
      `${FALL_VENUE_SHORT} in ${FALL_PUBLIC_AREA}, ${FALL_SEASON_LABEL} ` +
      `(${FALL_BLOCKS_LINE}). Registration and payment are ON THIS SITE.`,
  },
  {
    endsOn: lastDate(PICKLPARK_SATURDAYS),
    line:
      `- https://nextgenpbacademy.com/picklpark — Two six-week Saturday leagues at ` +
      `${PICKLPARK_VENUE_SHORT} in ${PICKLPARK_PUBLIC_AREA}, ${PICKLPARK_SEASON_LABEL}: ` +
      `${PICKLPARK_LEAGUES_LINE}. Indoors, so every week runs. Next Gen coaches ` +
      `these; REGISTRATION AND PAYMENT ARE THE PICKL PARK'S, not this site — the ` +
      `page links out to their listing for each league.`,
  },
];

/**
 * Season lines still worth publishing as of `todayIso` (ET). A season stays
 * listed through its final date — an in-progress season still takes
 * registrations — and is dropped the day after.
 */
export function activeSeasonLines(
  todayIso: string,
  entries: readonly SeasonEntry[] = SEASON_ENTRIES,
): string[] {
  return entries
    .filter((e) => e.endsOn >= todayIso)
    .map((e) => wrapEntry(e.line));
}

export function buildLlmsTxt(todayIso: string): string {
  const seasons = activeSeasonLines(todayIso);
  const seasonBlock = seasons.length
    ? `\n## Seasons currently running\n\n${seasons.join("\n")}\n`
    : "";

  return `# Next Gen Pickleball Academy — nextgenpbacademy.com

> Youth pickleball academy for kids ages 6–16 in Montgomery County, MD.
> Free 30-minute evaluations, small-group drop-in sessions, private
> lessons, summer camps, seasonal leagues, and the invite-only Yellow Ball
> tournament track.

This file follows the llms.txt convention (https://llmstxt.org/). It lists the
agent-consumable surface of this host.

## Ground rules (load-bearing, not marketing)

- Never fabricate sessions, venues, prices, or availability — the feed below is
  the only source of truth for the live schedule. Empty state beats invented data.
- Never tell a family to register on this site for a program this file marks as
  registered elsewhere, and never imply a program marked "interest list" has a
  signup — neither checkout exists. Send them to the page and let it route them.
- Children never appear in any public surface: the sessions feed carries
  aggregate counts and session metadata only, no player or family data.
- All communication goes to parents. Registration and evaluation booking are
  parent actions.
- Ages 6–16, strict. Placement is by skill (Red / Orange / Green / Yellow ball),
  decided at a free evaluation — never by age alone.

## Read endpoints (public, no auth)

- \`GET https://nextgenpbacademy.com/api/sessions/feed\` — Upcoming NGA youth
  drop-in sessions. Each entry: title, date, time, venue, level (Red / Orange /
  Green / Yellow), status, registered count, and capacity. Aggregate data only —
  no child PII. Cached ~5 minutes. The same sessions also appear on the
  cross-brand combined board at https://www.linkanddink.com/api/schedule/feed.
- \`GET https://nextgenpbacademy.com/api/events/feed\` — Every dated NGA item on
  one calendar: drop-in sessions, season Saturdays and Sundays, and each
  partner class expanded week by week.
${seasonBlock}
## Partner programs (Next Gen coaches; someone else registers)

${MVF_ENTRY}

## Key pages

- https://nextgenpbacademy.com/ — Home: programs, coaches, FAQ, lead form.
- https://nextgenpbacademy.com/schedule — Live session schedule + drop-in
  registration (Stripe checkout, which is where the price is shown; a one-time
  parent waiver is required before the first paid session).
- https://nextgenpbacademy.com/free-evaluation — Book a free 30-minute skill
  evaluation (the standard entry point for new families).
- https://nextgenpbacademy.com/levels — The Red / Orange / Green / Yellow ball
  ladder: what each color means and how a player moves up. Placement is by
  skill, never age.
- https://nextgenpbacademy.com/camp — Summer camps.
- https://nextgenpbacademy.com/newsletter — Free weekly parent newsletter.
- https://nextgenpbacademy.com/blog — Coach-written guides for parents (safety,
  the Red/Orange/Green/Yellow youth progression, where kids play in MoCo, what
  a first session looks like).
- https://nextgenpbacademy.com/montgomery-county-youth-pickleball — Service-area
  overview for Montgomery County, MD.
- https://nextgenpbacademy.com/schools — For schools, rec centers and camps:
  NGA coaches travel to the site for clinics, weekly residencies or camp weeks.
  An organization enquiry, not a family one.
- https://nextgenpbacademy.com/yellowball/inquiry — Yellow Ball tournament track
  is invite-only; route ALL interest here (no public registration exists).

## Interest lists — NO registration exists for these

- https://nextgenpbacademy.com/league — The planned fixed-roster Next Gen
  league. Not yet open: the page collects interest so NGA knows which age
  divisions to run first. Do not describe it as enrollable.
- https://nextgenpbacademy.com/clusters — Four planned regional teams
  (Down-County, Up-County, East-County, Mid-County). Interest list only.
- https://nextgenpbacademy.com/crew — For a family whose schedule fits none of
  the open sessions: NGA gathers players at the same level and day, then invites
  them once there are enough. A request to be matched, not a booking.

## Contact

- Email: nextgenacademypb@gmail.com
- Phone/text: 301-325-4731

## Family of sites

- https://www.linkanddink.com — Link & Dink, free adult pickleball community in
  MoCo (its llms.txt lists the full L&D agent surface).
- https://sammorrispb.com — Coach Sam Morris, adult private lessons.
`;
}

/** Today (America/New_York) as YYYY-MM-DD — the repo's todayET() pattern. */
function llmsTodayET(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

/**
 * The document as the live host serves it. Baked at build by the two
 * `force-static` routes, so its season pruning is deploy-fresh rather than
 * request-fresh — the reason `buildLlmsTxt` takes the date rather than reading
 * the clock, and the reason the specs call that instead of this.
 */
export const LLMS_TXT = buildLlmsTxt(llmsTodayET());
