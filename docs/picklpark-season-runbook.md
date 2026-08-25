# Pickl Park Saturday Season — go-live + ops runbook (Fall 2026)

The season surface ships DARK: `/picklpark` shows the closed state and
`/api/checkout-picklpark` 503s until the env trio below is set. Nothing here
requires a deploy after the code lands — going live is operator steps only.

## The season

6 Saturdays, **Oct 3 – Nov 7 2026** at The Pickl Park, 355 Ballenger Center Dr,
Frederick, MD 21703. Green Ball 1:00–2:00 PM, Yellow Ball 2:00–3:00 PM. 2
pickleball courts, 8 kids per group, **$175/player** full-season commitment.
Makeup date **Nov 14**. Config: `src/data/picklpark-2026.ts` (edit surface for
dates/blocks/courts) + `src/data/picklpark-season-2026.ts` (price/slug).

## Go-live checklist (in this order)

1. **Create the Stripe product FIRST** — NGA Stripe `acct_1TU4iSBpXOfTC961`:
   a "Pickl Park Saturday Season (Fall 2026)" product with a one-time **$175**
   price. The $175 on the page is only honest once this exists.
2. **Create the "NGA Pickl Park Registrations" Notion DB** — duplicate the Fall
   Regs DB schema exactly (properties listed in `.env.example` next to
   `NOTION_FALL_REGS_DB_ID`). Never reuse the Fall Regs DB itself — capacity is
   scoped by Group alone, so sharing would cross-count the two seasons' seats.
   Share it with the NGA Notion integration.
3. **Set Vercel env** (production): `STRIPE_PICKLPARK_SEASON_PRICE_ID`,
   `NOTION_PICKLPARK_REGS_DB_ID`, then `NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN=true`.
4. **Book the courts** under the standing Pickl Park arrangement: 2 courts,
   Saturdays 1–3 PM, Oct 3 – Nov 7, plus a hold on Nov 14. ($30/hr/court →
   $120/week, $720 season; full fill grosses $2,800.) To sell more seats, book
   a third court — `PICKLPARK_SLOTS_PER_GROUP` derives from the booking.
5. **Smoke test** (Stripe test mode or a $175 live + refund): checkout redirect,
   the waiver-gate 409 → inline sign → resume, webhook roster row in the new
   DB, parent confirmation email, `/picklpark/success`.
6. **Run `/calendar-sync`** — the feed's `nga-pp:saturday:<date>` items land on
   Sam's calendar; the Nov 14 hold ships `[TENTATIVE]`.
7. **Announce**: the weekly NGA newsletter has no derived Pickl Park block yet —
   use an Approved Newsletter Drafts row **with `Expires At` set** (multi-week
   content rule), or build the derived block mirroring the fall one later.

## Standing decisions / open calls

- **Halloween (Oct 31)** is currently a season Saturday (1–3 PM, before
  trick-or-treat). To skip it instead: in `picklpark-2026.ts` move
  `2026-10-31` out of `PICKLPARK_SATURDAYS` and `2026-11-14` in — decide
  BEFORE the first confirmation email ships, since every email lists the dates.
- **Refunds**: parent withdrawal → none (stated at point of sale); NGA-cancelled
  → prorated over the 6 Saturdays. Admin path:
  `POST /api/cancel-picklpark-registration?secret=$NGA_ADMIN_SECRET` — always
  `{"dryRun": true}` first. Out-of-band Stripe refunds reconcile via the
  `charge.refunded` webhook leg (partial refunds page Sam and touch nothing).
- **Sub list**: no code — same reply-or-text flow as the Wood season; the
  sold-out 409 copy already points parents there.

## The L&D side (community-os, separate PR)

The adult **Tuesday league** at the same venue (6–8 PM, Sept 29 – Nov 3,
$300/team, same-partner) lives in community-os — seed script + runbook at
`apps/p3/scripts/pickl-park-tuesday-league-fall-2026-seed/`. Cross-promote once
both are live (a "parents — you play too" link on `/picklpark` pointing at the
league page mirrors the fall page's pattern).
