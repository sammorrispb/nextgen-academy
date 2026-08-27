# Fall 2026 Sunday Season — curriculum, comms, and court captains

Companion to `docs/picklpark-season-runbook.md` (that one covers go-live and
money; this one covers what happens on court and what parents hear). The season
is already **live and selling** — this is the delivery side.

## The season

6 Sundays, **Sept 20 – Oct 25 2026** at Earle B. Wood Middle School, Rockville.
Green Ball 1:00–2:30 PM, Yellow Ball 2:30–4:00 PM. One reserved tennis court =
2 pickleball courts = **8 seats per group**, $225 per player, full season paid up
front. Rain dates held **Nov 1 + Nov 8**.

Config lives in `src/data/fall-2026.ts` (dates, venue, blocks, seat math) and
`src/data/fall-season-2026.ts` (price, slug). Don't re-type either here.

## What this shipped

| Thing | Where | Edit surface |
|---|---|---|
| Curriculum — Skill Stack, cues, drills, formations, rotations, games, ball rules, age dials | `src/data/session-curriculum.ts` | this file only |
| The six-week plan | `src/data/fall-season-plan-2026.ts` | this file only |
| Coach + captain playbook (printable) | `/coach/fall-playbook` | renders from the two above |
| Parent primer — "how the season works" | `src/lib/email/fall-season-how-it-works.ts` | |
| Weekly note (preview + recap variants) | `src/lib/email/fall-season-week-note.ts` | |
| Court-captain ask | `src/lib/email/fall-season-captain-ask.ts` | |
| Invariants | `e2e/session-curriculum.spec.ts`, `e2e/fall-season-plan.spec.ts`, `e2e/fall-season-comms.spec.ts` | |

The curriculum file is **not season-scoped**. Pickl Park Saturdays, camps,
drop-ins and the school clubs run the same spine — `SESSION_ARC_60` is there for
the 60-minute formats. Editing a drill changes every surface that renders it.

## The two axes (the thing to not collapse)

**Ball color sets the RULES.** Serve count, kitchen on/off, two-bounce, court
size, scoring. **Age band sets the DIALS.** Block length, rally target, language,
game length, how much the kid-coach role carries.

They are independent. A twelve-year-old on day one plays **Orange rules at the
13U dial**. A strong nine-year-old plays **Green rules at the 9U dial**. Every
time these get merged into one ladder, somebody ends up bored or drowning.

The serve ladder and the Red format are both deliberate, and both are commented
in place:

- **Serves go 2 / 2 / 1 / 1.** Red and Orange get two attempts because at those
  levels the serve is still a skill being built and a second swing is the
  low-stakes rep. At Red the second attempt may be taken from **anywhere**, not
  just behind the baseline, so a kid who cannot yet clear the net from depth
  still gets the rally started. Green and Yellow return to one — tournament
  standard.
- **Red has no kitchen and no two-bounce.** Straight from Play-and-Stay: cutting
  a rule out of a six-year-old's working memory buys attention for tracking the
  ball. Both come back at Orange and never leave. Red therefore plays a **full
  court with everything live** — a real format, not a leftover.

**Changed 2026-08-27 (Sam).** Red previously took ONE serve that could not fault
at all (the receiver just fed), on half a court, scored with cooperative rally
targets and no winner named. Sam revised it after reading the rules back in the
copy desk: Red is now two serves with a real fault, full court, rally scoring to
15. Orange and Green also moved from rally scoring to **side-out** scoring
(Orange to 11 win by 1; Green to 11 win by 1 for rotating games). Side-out games
run longer than rally-scored ones — **watch the round-robin block against the
90-minute clock for the first couple of Sundays** and adjust the arc if it
overruns.

Change either in `BALL_RULES` and nowhere else — no other file hardcodes a serve
count or a kitchen rule. `e2e/session-curriculum.spec.ts` pins the current
ladder and Red's no-kitchen format, so the next change to either has to be
deliberate rather than silent.

## Known drift — age bands

`src/data/leagues.ts` and `docs/youth-pickleball-league-blueprint.md` carry an
older **four-band** split (7U/10U/14U/16U), designed for a fixed-roster league
that hasn't launched. The curriculum runs on Sam's current **five bands**
(7U/9U/11U/13U/16U).

This is deliberate, not an oversight: they answer different questions (who's on
court together vs. how the coach dials a block). **Reconcile `leagues.ts` when
that league actually ships.** Don't silently edit one to match the other.

## Running a Sunday

`/coach/fall-playbook` prints the whole thing. The short version:

- **T-15 min** — captains set up. Nets, caddies, cones, water.
- **Arrival rally (7 min)** — kids hit the moment they walk on. Coach works the
  parents.
- **Skill Stack (36 min)** — six blocks, six minutes each, captain-run. Coach
  floats, gives feedback by name.
- **Pickup + water (4 min)** — the only break, and it's a job.
- **Modified games (14 min)** — two games repping today's focus.
- **Round robin (18 min)** — rotating partners, captain calls it.
- **Jailbreak (5 min)**, then **cleanup (3 min)**.

Two rules that never bend: start the ritual when 5 minutes remain (skip under 3
minutes or under 4 kids), and **cut the ritual, never the cleanup**.

## Court captains — before the first Sunday

One parent volunteer per court. They run the clock, rotation, score and balls;
they do **not** coach.

**These are open items, and the first two gate the role:**

1. **Background check / SafeSport-equivalent vetting.** Budget ~$25–50 per
   adult, one-time, reusable across seasons (already scoped in
   `docs/youth-pickleball-league-launch-readiness.md` §P0.4). Pick a vendor and
   keep records. Until a volunteer clears, they work **only in the coach's
   direct line of sight** — the captain ask email says this out loud so nobody
   is surprised later.
2. **Two-deep leadership as an operating rule.** Never one adult alone with
   kids. On a public court with a sole coach this is already a gap; captains are
   the mitigation, so a Sunday with zero captains means the coach is solo and
   the rule is broken.
3. **First-aid/CPR + a per-venue emergency action plan** for Wood MS. Also
   already on the P1 list.
4. **Recruit.** Send the captain ask, take whatever Sundays people offer — one
   is a real contribution.
5. **Send each captain their run sheet the day before.** Print
   `/coach/fall-playbook` (section 07 is the captain card) or the whole thing.

## Parent comms — the cadence

| When | Template | Variant |
|---|---|---|
| Now (≈3 weeks out) | `fall-season-how-it-works` | — |
| Same send or shortly after | `fall-season-captain-ask` | — |
| Each Saturday | `fall-season-week-note` | `preview` |
| Each Sunday evening | `fall-season-week-note` | `recap` |
| By noon on a washout | *(no template yet — see below)* | |

Every body is a **pure builder** — subject, HTML, and plain text, no send path.
They render from the season plan, so the six weeks in the email and the six weeks
on the run sheet cannot drift.

**There is deliberately no send route yet.** Wiring one means a roster read from
`NOTION_FALL_REGS_DB_ID`, dedup to one email per parent, `dryRun`/`only`, a
counts-only admin QA copy, and — because child first names would egress to
Resend — a new `e2e/invariant-*-egress.spec.ts`. That's the same shape as
`camp-followup-run.ts` and is the obvious next step; it just isn't this change.
Until then these render by hand for nine families.

Rules that bind whatever sends them: BCC (never CC) `nextgenacademypb@gmail.com`,
`replyTo` `nextgenacademypb@gmail.com`, `from` noreply@. **Always `dryRun`
first.**

### Why none of them quote a price

The family already paid $225 and the confirmation email owns that number. A
second dollar figure in a post-purchase email is noise at best and a
contradiction at worst. Pinned in `e2e/fall-season-comms.spec.ts` — a `$` and a
digit in any of the three templates fails the build.

## If a Sunday washes out

Call it **by noon** and email either way; the primer promises that, so silence
reads as "it's on." A washed-out Sunday moves to Nov 1, then Nov 8. **The weeks
slide, they never reorder** — week 4 stays week 4 on a later date, because each
week is built on the one before it.

The refund path is unchanged: parent withdrawal → none (stated at point of sale);
NGA-cancelled beyond the rain dates → prorated. See
`src/lib/fall-refund-policy.ts` and `POST /api/cancel-fall-registration`.

## Verification

```bash
npm run build                 # must be zero-error
npm run lint
npm run test:pure             # includes the three new specs
node scripts/verify-funnel.mjs
```

`/coach/fall-playbook` is `noindex` and publicly reachable by URL — same posture
as `/coach/camp-checklist`. It carries no roster, no child name, and no parent
contact, so it sits outside the minor-PII egress surface. Keep it that way: if
this page ever needs a roster, it needs the coach auth gate and an egress spec
first.
