# Pickl Park Saturday — go-live + ops runbook (Fall 2026)

Two products share one Saturday and one court booking in Frederick:

| Time | What | Sells through | State |
|---|---|---|---|
| 2:00–3:00 PM | **Open Court** — all levels, ages 6–16, $20 drop-in | `/schedule` (the normal drop-in stack) | **LIVE** — Sep 12/19/26 seeded 2026-08-31; cron extends weekly |
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

   **`NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN` is still deliberately UNSET —
   hold it until after the first Open Court (~Sep 12–19)**, Sam's call
   2026-08-31. The first two alone are safe: the page keeps its closed state and
   no form renders, so nobody can reach checkout. Opening before any Open Court
   has run would sell cold, which is the outcome the Open Court hour exists to
   avoid.
7b. **Cheap pre-check once the flag flips.** With registration open,
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
