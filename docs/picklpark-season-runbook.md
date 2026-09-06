# Pickl Park Saturday — go-live + ops runbook (Fall 2026)

Two products share one Saturday and one court booking in Frederick:

| Time | What | Sells through | State |
|---|---|---|---|
| 2:00–3:00 PM | **Open Court** — all levels, ages 6–16, $20 drop-in | `/schedule` (the normal drop-in stack) | **LIVE** — Sep 12/19/26 seeded 2026-08-31; cron extends weekly |
| 3:00–4:00 PM | **Red & Orange Ball** season | `/picklpark` | **OPEN** from the 2026-09-05 merge — flag is now a kill switch |
| 4:00–5:00 PM | **Green & Yellow Ball** season | `/picklpark` | **OPEN** (same) |

**2026-09-05 (Sam): the season moved up two weeks — Sep 19 – Oct 24, makeup hold
Oct 31 — and sells from the site as the second fall option beside the Walter
Johnson Sunday season** (`/fall` and `/picklpark` cross-link while both are
open). Each hour is 30 minutes of coached drills, then 30 minutes of game play.
Registration is **open by default** through the last Saturday;
`NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN` is a **kill switch** (unset or `true`
= open, any other value — use `false` — closes the form on every surface), no
longer a launch flag. `/api/checkout-picklpark` still 503s if the Stripe price
env is missing; it is set in prod. The earlier posture (ship dark, hold the flag
until after the first Open Court) is history below, kept because the reasoning
about the cold market still holds — the one Open Court on Sep 12 is now the only
on-ramp before the season starts.

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

6 Saturdays, **Sep 19 – Oct 24 2026** at The Pickl Park, 355 Ballenger Center Dr,
Frederick, MD 21703. Red & Orange Ball 3:00–4:00 PM, Green & Yellow Ball
4:00–5:00 PM — each hour **30 minutes of coached drills, then 30 minutes of game
play** (`PICKLPARK_SESSION_FORMAT`). 2 pickleball courts, **$225/player**
full-season commitment. One held date **Oct 31** (Halloween; a makeup there ends
at 5, before trick-or-treat — swap in Nov 7 if you'd rather). Config:
`src/data/picklpark-2026.ts` (edit surface for dates/blocks/courts/format) +
`src/data/picklpark-season-2026.ts` (price/slug). Was Oct 3 – Nov 7 with a Nov 14
hold until 2026-09-05.

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
2. **Book the courts**: 2 courts, Saturdays **2–5 PM**, Sep 12 → Oct 24, plus a
   hold on Oct 31. Three hours × 2 courts × 6 weeks = 36 court-hours for the
   season, plus 2 court-hours a week for Open Court. **Reconcile the dates with
   Amar first:** the court-time proposal sent to him lists the Next Gen Saturdays
   as Sep 26 – Oct 31, and the plan before 2026-09-05 was Oct 3 – Nov 7 — neither
   matches the Sep 19 – Oct 24 (+ Oct 31 hold) the site now sells. The booking
   has to cover Sep 19 and Sep 26 as season Saturdays, not just Open Court.
3. ~~**Notion — Sessions DB**: add **`All Levels`** to the `Level` select.~~
   **DONE 2026-08-31.** The four colour options were preserved. Still to do:
   add `Frederick` to the Player CRM `Location` select and `The Pickl Park` to
   `Site`. **Step 8 confirmed both are real gaps, not theory** — the smoke
   test's Player CRM row came back with `Site` empty, because `matchSite()`
   (`src/lib/notion-player-sync.ts`) has no Pickl Park entry and correctly
   declines to guess: an unknown select value would 400 the whole write and take
   the `Last Attended` update with it. Cosmetic today, worth fixing before the
   season fills.
4. ~~**Smoke-test the seeder**~~ **DONE 2026-08-31** — dry-run reported
   `wouldCreate: 7`, one row per Saturday, never four. **Sep 12 / 19 / 26 are
   hand-seeded and live** (verified in `/api/sessions/feed`); their titles are
   codepoint-identical to `${titleBase} — ${level}`, so the Monday cron adds
   Oct 3 → Oct 24 and skips them. Re-run any time with:
   `GET /api/cron/seed-tuesday-sessions?dryRun=1` — expect one
   `Pickl Park Saturday Open Court — All Levels` row per Saturday from Sep 12,
   **one row per date, never four**. Any other `dryRun` value 400s rather than
   running live.
5. ~~**Create the Stripe product**~~ **DONE 2026-08-31** on NGA Stripe
   `acct_1TU4iSBpXOfTC961` (livemode): product `prod_VArmZ4zV7oq0rD`,
   one-time $225 price **`price_1UAW31BpXOfTC961acgj7Fqe`** — verified
   `unit_amount: 22500`, `type: one_time`, `tax_behavior: exclusive`, and NOT
   attached to the Fall season product.
6. ~~**Create the "NGA Pickl Park Registrations" Notion DB**~~ **DONE
   2026-08-31** under NGA HOME: **`febf59e72797405995a9606d677fc9f6`**. All 15
   Fall Regs properties mirrored; `Group` options are `Red/Orange` and
   `Green/Yellow`. Never reuse the Fall Regs DB itself — capacity is scoped by
   Group alone, so sharing would cross-count the two seasons' seats.
   Shared with the **"Player DB"** integration 2026-08-31 (Sam) — without that
   the webhook 404s on the first real registration while everything else looks
   correct. Not verifiable from code: with registration closed nothing reads the
   DB, and `countPicklParkRegistrations` fails soft to `null` either way. The
   check at go-live is below.
7. ~~**Set Vercel env** (production)~~ **DONE 2026-08-31** — both values are live:

   ```
   STRIPE_PICKLPARK_SEASON_PRICE_ID=price_1UAW31BpXOfTC961acgj7Fqe
   NOTION_PICKLPARK_REGS_DB_ID=febf59e72797405995a9606d677fc9f6
   ```

   **`NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN` — leave it UNSET; unset now means
   OPEN.** The 2026-08-31 plan held this flag until after the first Open Court so
   the season would never sell cold. Sam's 2026-09-05 call (list the season as a
   fall option with sign-ups, starting Sep 19) superseded that: the code merged
   that day opens registration by default through the last Saturday, and the
   flag became a kill switch — set it to `false` (any value other than blank or
   `true`) for a no-go, a sell-out, or to pull the form early; a `NEXT_PUBLIC_`
   var is inlined at build time, so a redeploy follows the change. The cold-market
   risk did not go away — it moved to the go/no-go call at T−72h (Sep 16).
7b. **Cheap pre-check now that registration is open.** With registration open,
    `/picklpark` calls `countPicklParkRegistrations` per band. A readable DB
    returns 0 and each group card shows **"Spots open"**; an unreadable one
    returns `null` and the card shows **no seat status at all**. Blank status on
    a brand-new season means the integration cannot see the DB — not that it is
    full. Step 8 has already answered this definitively; keep 7b as the
    zero-cost confirmation after any later env or integration change.
8. ~~**Smoke test the season**~~ **DONE 2026-08-31 — PASSED.** Run live rather
   than in test mode, at **$0** via a single-use 100%-off promo code restricted
   to the season product (`prod_VArmZ4zV7oq0rD`), so no money moved and the
   coupon retired itself. All five legs fired: checkout redirect → roster row in
   `febf59e72797405995a9606d677fc9f6` with all 13 properties mapped → Player CRM
   row created → Open Brain `nga_picklpark_registration` activity → parent
   confirmation + admin notification emails → `/picklpark/success`. **This, not
   step 7b, is what proves the "Player DB" integration can see and write the new
   database**, and that the webhook's `kind: picklpark` discriminator routes to
   `handlePicklParkCheckout` rather than the drop-in path. All test artefacts
   were then reversed (roster row `Cancelled`, player row `Inactive`, OB activity
   deleted).

   Two artefacts of a **$0** run look like defects and are not: **Amount Paid
   reads $0.00** (the webhook records `amount_total`, i.e. post-discount) and
   the **Stripe Payment Intent ID is blank** (Stripe mints no PaymentIntent for a
   $0 checkout). The second leaves a real gap — **the `charge.refunded`
   reconciliation leg was NOT exercised**, because no charge existed to refund.
   Everything upstream of it is covered; test that leg against the first genuine
   paid registration, or with a $225 live + refund if you want it proven sooner.
9. **Run `/calendar-sync` after the 2026-09-05 merge deploys** — the
   `nga-pp:saturday:<date>` season blocks on the calendar still carry the old
   Oct 3 – Nov 14 dates; the feed now emits Sep 19 – Oct 24 plus the Oct 31
   hold, so the sync creates the two September blocks, updates the shared
   October ones, and deletes Nov 7 / Nov 14. (The earlier retime from the 1–3 PM
   Green & Yellow shape to 3–5 PM is folded into the same pass.) Open Court is
   picked up separately as an ordinary session row. The sync reads the LIVE
   feed, so running it before the deploy re-asserts the old dates.
10. **Announce**: the weekly NGA newsletter has no derived Pickl Park block yet —
    use an Approved Newsletter Drafts row **with `Expires At` set** (multi-week
    content rule), or build the derived block mirroring the fall one later.

## Standing decisions / open calls

- **Go/no-go minimum: 8 paid across both bands (4 each), decided at T−72h.** At
  $225 with 2 courts, the courts alone break even around 5 paid; with a real
  coaching wage and the Frederick drive it is nearer 10. Below the minimum,
  cancel and refund in full with a personal call — the same discipline the L&D
  block runs on. It does not limp.
- **Halloween (Oct 31)** is the held MAKEUP date since the 2026-09-05 move, not a
  season Saturday (a makeup there would end at 5, before trick-or-treat). To hold
  Nov 7 instead: in `picklpark-2026.ts` swap `PICKLPARK_MAKEUP_DATES` — decide
  BEFORE the first confirmation email ships, since every email names the makeup
  date.
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
