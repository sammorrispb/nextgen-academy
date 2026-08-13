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
| MVF classes (venues, times, brackets, registration links) | `src/data/mvf.ts` | `/calendar-sync` |
| Fall 2026 season dates | `src/data/fall-2026.ts` | `/calendar-sync` |
| Enrichment Collective clubs (incl. Stef's confirmed dates) | `src/data/enrichment-collective.ts` | `/calendar-sync` |

## Rules that bind any change to the feed

- **Camps emit `publicArea`, never `exactLocation`.** Camp venues are hidden by
  child-safety policy. The feed is public and unauthenticated.
- **No child PII and no seat counts.** Both pinned by
  `e2e/invariant-events-feed-egress.spec.ts` — extend it, don't weaken it, when
  adding a source (see `skills/add-invariant-test.md`).
- **Never invent a time.** An event whose hour isn't published ships
  `allDay: true` with `(time TBD)` in the title. No MVF class uses that path any
  more — MVF published every Fall 2026 time when enrollment opened 2026-08-07 —
  and as of 2026-08-13 no EC club does either (every club time is published) —
  but the rule outlives any one season's data.
- **MVF venues are per-program, not per-file.** Only the Aug 27 intro is at
  Apple Ridge; Fall I is at Watkins Mill and Fall II is at North Creek. Each
  fall session is also two separate MVF activities (Red/Orange 5:30 PM,
  Green/Yellow 6:30 PM), so a session is two calendar blocks per Thursday.
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
- **Enrichment Collective after-school clubs** — these DO sync to the calendar,
  but deliberately never to the feed. See below.

## Enrichment Collective — calendar-only, on purpose

`src/data/enrichment-collective.ts` holds the fall 2026 "Coach Sam" clubs that
Enrichment Collective runs in MCPS schools. The calendar sync reads that file
**directly** from the repo checkout; it is the one source that isn't the feed or
Supabase.

That exception is deliberate. EC clubs meet weekly at named elementary schools,
so publishing a precise recurring time and place where identified young children
gather is the risk `camps.ts` already mitigates by hiding `exactLocation` —
except here the venue *is* the school. So the whole program stays off
`/api/events/feed`, off `/schedule`, and off the sitemap, and the calendar blocks
carry the **town only**, never a school name.

`e2e/invariant-events-feed-egress.spec.ts` enforces the exclusion, so it survives
someone later "helpfully" adding EC to the feed.

Reading a TypeScript file at sync time is normally the fragility this whole feed
exists to remove. It's safe *here* because the file is hand-maintained with
explicit ISO date arrays and one fixed time per club — there is nothing to
derive, only to read. If EC ever needs computing (recurrence rules, per-school
variation), promote it to the feed pattern with a private access path rather
than parsing harder.

The schedule is CONFIRMED (Stef's Fall 2026 schedule PDF, updated revision
2026-08-13): five clubs, Mon Brookeville / Tue Derwood / Wed Silver Spring /
Thu Olney (Belmont) / Fri Sandy Spring, with real MCPS-reconciled session
dates — the gaps in each club's date list are school closures, so a "missing"
week is not an error. Every club now has a published time (Mon/Tue/Thu
3:30–4:30 PM, Wed/Fri 4:00–5:00 PM), so no EC block ships all-day any more —
but the never-invent-a-time rule stands for any future club without one.
