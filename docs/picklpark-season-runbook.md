# Pickl Park Saturday — go-live + ops runbook (Fall 2026)

Two products share one Saturday and one court booking in Frederick:

| Time | What | Sells through | State |
|---|---|---|---|
| 2:00–3:00 PM | **Open Court** — all levels, ages 6–16, $20 drop-in | `/schedule` (the normal drop-in stack) | seeded by cron, first session **Sep 12** |
| 3:00–4:00 PM | **Red & Orange Ball** season | `/picklpark` | ships DARK |
| 4:00–5:00 PM | **Green & Yellow Ball** season | `/picklpark` | ships DARK |

The season surface ships DARK: `/picklpark` shows the closed state and
`/api/checkout-picklpark` 503s until the env trio below is set. Nothing here
requires a deploy after the code lands — going live is operator steps only.

## Why the Open Court hour exists, and why it runs first

Frederick is a cold market. The Player CRM holds 422 rows across 272 families
and **not one of them is a Frederick family** — no list, no evaluations, so
nobody has been placed on the colour ladder. Selling a six-week up-front
commitment into that is the hardest possible first ask: the Montgomery County
season, sold to 272 known families with a newsletter and a poll behind it, took
9 of 18 seats.

So Open Court is the on-ramp, not a companion product. A parent books a single
$20 drop-in, Coach Sam sees the kid play, the family lands in the CRM with a
real level attached, and the season sells to a warm list instead of a cold one.
It runs **before** the season blocks so a first-time family can stay and watch
the thing they'd be buying.

It needs no new machinery — an Open Court row is an ordinary Sessions-DB row,
so it inherits the waiver gate, the roster, the reminder and post-session
crons, coach check-in, attendance and the cancel/refund paths for free.

## The season

6 Saturdays, **Oct 3 – Nov 7 2026** at The Pickl Park, 355 Ballenger Center Dr,
Frederick, MD 21703. Red & Orange Ball 3:00–4:00 PM, Green & Yellow Ball
4:00–5:00 PM. 2 pickleball courts, **$225/player** full-season commitment. One
held date **Nov 14**. Config: `src/data/picklpark-2026.ts` (edit surface for
dates/blocks/courts) + `src/data/picklpark-season-2026.ts` (price/slug).

**Bands, not single colours.** With no evaluations in this market, a four-way
split would ask parents to self-select a level they can't know. Two bands is
the same call MVF and the weekend drop-in templates already make.

**$225 matches Montgomery County, and buys a shorter block** — 6 × 60 min here
against Walter Johnson's 6 × 90. What closes that gap is the venue: this season
is **indoors**, so all six Saturdays run, while the outdoor season holds two
rain dates precisely because it might not. `PICKLPARK_INDOOR_NOTE` carries that
sentence to the page and the confirmation email; a surface that quotes the
price without it is selling the shorter hour and none of the reason.

## Go-live checklist (in this order)

1. **Settle the Saturday rate with Amar — before anything else.** The
   court-time proposal names four cells (Mon–Wed 10–12, Tue–Thu 6–8); **Saturday
   afternoon is not one of them**, and that page's own rule is that an unnamed
   cell defaults to the higher neighbour. Name Saturday 2–5 PM in the same
   conversation as the others (and the pending 12–3 ladder cell), or pay $30 by
   default on the one programme where the margin is thinnest. **Also ask for a
   co-marketing send to the Pickl Park member list** — with zero CRM presence in
   Frederick, that list is the best lead source available.
2. **Book the courts**: 2 courts, Saturdays **2–5 PM**, Sep 12 → Nov 7, plus a
   hold on Nov 14. Three hours × 2 courts × 6 weeks = 36 court-hours for the
   season, plus 2 court-hours a week for Open Court.
3. **Notion — Sessions DB**: add **`All Levels`** to the `Level` select. (Notion
   auto-creates select *options* on write, but adding it by hand keeps the
   board views tidy.) Add `Frederick` to the Player CRM `Location` select and
   `The Pickl Park` to `Site`.
4. **Smoke-test the seeder** *before* trusting it:
   `GET /api/cron/seed-tuesday-sessions?dryRun=1` — expect one
   `Pickl Park Saturday Open Court — All Levels` row per Saturday from Sep 12,
   **one row per date, never four**. Any other `dryRun` value 400s rather than
   running live.
5. **Create the Stripe product** — NGA Stripe `acct_1TU4iSBpXOfTC961`: a
   "Pickl Park Saturday Season (Fall 2026)" product with a one-time **$225**
   price. The $225 on the page is only honest once this exists.
6. **Create the "NGA Pickl Park Registrations" Notion DB** — duplicate the Fall
   Regs DB schema exactly (properties listed in `.env.example` next to
   `NOTION_FALL_REGS_DB_ID`), with `Group` options **`Red/Orange`** and
   **`Green/Yellow`**. Never reuse the Fall Regs DB itself — capacity is scoped
   by Group alone, so sharing would cross-count the two seasons' seats. Share it
   with the NGA Notion integration.
7. **Set Vercel env** (production): `STRIPE_PICKLPARK_SEASON_PRICE_ID`,
   `NOTION_PICKLPARK_REGS_DB_ID`, then
   `NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN=true`.
8. **Smoke test the season** (Stripe test mode or a $225 live + refund):
   checkout redirect, the waiver-gate 409 → inline sign → resume, webhook roster
   row in the new DB, parent confirmation email, `/picklpark/success`.
9. **Run `/calendar-sync`** — the seven existing Saturday holds are at the OLD
   1–3 PM Green & Yellow shape and are now wrong. The sync retimes the
   `nga-pp:saturday:<date>` season blocks to 3–5 PM and picks up Open Court
   separately as an ordinary session row.
10. **Announce**: the weekly NGA newsletter has no derived Pickl Park block yet —
    use an Approved Newsletter Drafts row **with `Expires At` set** (multi-week
    content rule), or build the derived block mirroring the fall one later.

## Standing decisions / open calls

- **Go/no-go minimum: 8 paid across both bands (4 each), decided at T−72h.** At
  $225 with 2 courts, the courts alone break even around 5 paid; with a real
  coaching wage and the Frederick drive it is nearer 10. Below the minimum,
  cancel and refund in full with a personal call — the same discipline the L&D
  block runs on. It does not limp.
- **Halloween (Oct 31)** is currently a season Saturday (ends at 5, before
  trick-or-treat). To skip it instead: in `picklpark-2026.ts` move `2026-10-31`
  out of `PICKLPARK_SATURDAYS` and `2026-11-14` in — decide BEFORE the first
  confirmation email ships, since every email lists the dates.
- **Seat counts are per band and DERIVED** (`PICKLPARK_SLOTS_BY_GROUP`). Both
  bands hold 2 courts × 4 = 8 today. To change one, edit
  `PICKLPARK_PLAYERS_PER_COURT` or book another court — never
  `PLAYERS_PER_PICKLEBALL_COURT`, which sizes every drop-in site-wide. **No
  public surface publishes the number**; `seat-status.ts` renders Spots
  open / Filling up / Last spot / Full from seats remaining.
- **Refunds**: parent withdrawal → none (stated at point of sale); NGA-cancelled
  → prorated over the 6 Saturdays. Admin path:
  `POST /api/cancel-picklpark-registration?secret=$NGA_ADMIN_SECRET` — always
  `{"dryRun": true}` first. Out-of-band Stripe refunds reconcile via the
  `charge.refunded` webhook leg (partial refunds page Sam and touch nothing).
- **Sub list**: no code — same reply-or-text flow as the Wood season; the
  sold-out 409 copy already points parents there. Open Court doubles as the sub
  pool, since those families have already played.
- **SEO posture is unchanged.** No Frederick city page, `SERVICE_AREAS` and
  `NGA_POSTAL_ADDRESS` stay Montgomery County. This is a venue addition, not a
  market expansion — and an SEO page would not fill an October season anyway.

## The L&D side (community-os, separate PR)

The adult **Tuesday league** at the same venue (6–8 PM, Sept 29 – Nov 3,
$300/team, same-partner) lives in community-os — seed script + runbook at
`apps/p3/scripts/pickl-park-tuesday-league-fall-2026-seed/`. Cross-promote once
both are live (a "parents — you play too" link on `/picklpark` pointing at the
league page mirrors the fall page's pattern).
