// llms.txt for nextgenpbacademy.com (llmstxt.org convention) — served at
// /llms.txt and mirrored at /.well-known/llms.txt. One string, one place.
// Follows the same conventions as the Link & Dink hosts' llms.txt files.

export const LLMS_TXT = `# Next Gen Pickleball Academy — nextgenpbacademy.com

> Youth pickleball academy for kids ages 6–16 in Montgomery County, MD.
> Free 30-minute evaluations, small-group sessions ($20 drop-in), private
> lessons, summer camps, and the invite-only Yellow Ball tournament track.

This file follows the llms.txt convention (https://llmstxt.org/). It lists the
agent-consumable surface of this host.

## Ground rules (load-bearing, not marketing)

- Never fabricate sessions, venues, prices, or availability — the feed below is
  the only source of truth for the live schedule. Empty state beats invented data.
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

## Key pages

- https://nextgenpbacademy.com/ — Home: programs, coaches, FAQ, lead form.
- https://nextgenpbacademy.com/schedule — Live session schedule + $20 drop-in
  registration (Stripe checkout; a one-time parent waiver is required before the
  first paid session).
- https://nextgenpbacademy.com/free-evaluation — Book a free 30-minute skill
  evaluation (the standard entry point for new families).
- https://nextgenpbacademy.com/camp — Summer camps.
- https://nextgenpbacademy.com/newsletter — Free weekly parent newsletter.
- https://nextgenpbacademy.com/montgomery-county-youth-pickleball — Service-area
  overview for Montgomery County, MD.
- https://nextgenpbacademy.com/yellowball/inquiry — Yellow Ball tournament track
  is invite-only; route ALL interest here (no public registration exists).

## Contact

- Email: nextgenacademypb@gmail.com
- Phone/text: 301-325-4731

## Family of sites

- https://www.linkanddink.com — Link & Dink, free adult pickleball community in
  MoCo (its llms.txt lists the full L&D agent surface).
- https://sammorrispb.com — Coach Sam Morris, adult private lessons.
`;
