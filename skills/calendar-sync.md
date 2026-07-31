# Skill: Keep Google Calendar in sync with the schedules

Sam's Google Calendar (`sam.morris2131@gmail.com`) is a **derived view** of the
live schedules — never a source of truth. Run the sync after editing any of
them, and a daily Routine runs it unattended.

**The canonical, invokable skill lives in the community-os repo:**
`.claude/skills/calendar-sync/SKILL.md` (invoke as `/calendar-sync`). It spans
both businesses because half the events are Link & Dink. This file is the NGA
side of the contract; `community-os/docs/CALENDAR_SYNC.md` is the L&D side.

## What this repo owes the sync

One endpoint:

```
GET https://nextgenpbacademy.com/api/events/feed
```

Built by `src/lib/events-feed.ts` from four sources — Notion sessions, `CAMPS`,
`MVF_PROGRAMS`, and the Fall 2026 dates. Every item carries a stable `key` of
the form `<namespace>:<slug>:<YYYY-MM-DD>`, which is what the sync writes into
the calendar event description to claim ownership of it.

## Editing a schedule → what to re-run

| Change | File / system | After |
|---|---|---|
| Weekly venues, times, levels | `src/data/recurring-templates.ts` | `/calendar-sync` |
| A one-off session, or a cancellation | NGA Sessions Notion DB | `/calendar-sync` |
| Camp weeks | `src/data/camps.ts` | `/calendar-sync` |
| MVF classes (incl. adding the published fall times) | `src/data/mvf.ts` | `/calendar-sync` |
| Fall 2026 season dates | `src/data/fall-2026.ts` | `/calendar-sync` |

## Rules that bind any change to the feed

- **Camps emit `publicArea`, never `exactLocation`.** Camp venues are hidden by
  child-safety policy. The feed is public and unauthenticated.
- **No child PII and no seat counts.** Both pinned by
  `e2e/invariant-events-feed-egress.spec.ts` — extend it, don't weaken it, when
  adding a source (see `skills/add-invariant-test.md`).
- **Never invent a time.** An event whose hour isn't published ships
  `allDay: true` with `(time TBD)` in the title. This is why the 12 MVF fall
  classes are all-day: `MVF_PROGRAMS.timeLabel` is `null` until the MVF Fall Rec
  Guide publishes.
- **Keys must stay stable.** A key is a promise to the calendar that this item is
  the same real-world event as last run. Changing key derivation orphans every
  event built from the old scheme — the sync's adoption step softens that, but
  don't rely on it.
- **A Notion outage is not "zero sessions".** The route flags
  `_meta.sessionsUnavailable` so the sync doesn't read an outage as a mass
  cancellation and delete every session event.

## Deliberately not in the feed

- **The MVF tournament** — it's a Link & Dink event (`MVF_TOURNAMENT.url` points
  at the L&D event page) and belongs to the `ld:` key namespace. Emitting it here
  too would double-create it.
- **League seasons** (`src/data/leagues.ts`) — a start and end date, but no
  per-session dates, no times, and `exactLocation` is empty (venue not booked).
  There is nothing schedulable yet.
- **Enrichment Collective** after-school clubs — no confirmed schools, dates, or
  times exist. Nothing to sync.
