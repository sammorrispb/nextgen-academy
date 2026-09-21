# NGA website conversion build — 2026-09-21

What shipped in this change set (all uncommitted until this doc was written; nothing live on Vercel yet).

## New products

### One-hour lessons — `/lessons`

- Two products at **$60/hr** (one-time): private 1:1 (`STRIPE_PRIVATE_LESSON_PRICE_ID`) and small-group (`STRIPE_GROUP_LESSON_PRICE_ID`) — the group $60 is the **total for the group**, split between the players.
- Checkout API: `POST /api/checkout-lesson` → creates a Stripe Checkout Session with `kind=lesson` metadata (product key, parent/player details, availability, allergies, coaching notes, SMS consent, waiver).
- Validation: `src/lib/validate-lesson.ts`. Form: `src/components/LessonPurchaseForm.tsx`.
- Fail-closed: if neither Stripe price ID is set, `/lessons` shows a text-Coach-Sam fallback instead of the purchase form, and the API returns 503.
- Success page: `/lessons/success`.
- **Group pricing basis — CONFIRMED by Sam 2026-09-21: $60 TOTAL per group per hour, split between the players** (not $60 per player). `STRIPE_GROUP_LESSON_PRICE_ID` must be a one-time $60.00 price charged quantity 1 regardless of group size; do not activate group checkout until that price exists. The purchase form collects the player count (2–8) and shows the live per-player split; the API writes `group_players` into the checkout-session metadata and the payment-intent description so staff see the split.

### Monday Girls 11U drop-in — `/monday-girls`

- One Monday session, 6:00–7:00 PM, **$35**, one-time (`STRIPE_MONDAY_GIRLS_DROPIN_PRICE_ID`).
- Checkout API: `POST /api/checkout-monday-girls-dropin` → Stripe Checkout Session with `kind=monday-girls-dropin` metadata.
- Validation: `src/lib/validate-monday-girls-dropin.ts`. Form: `src/components/MondayGirlsDropinForm.tsx`.
- The drop-in section stays dark until the price env var exists; the API 503s without it.
- **Known gap (fix before production): drop-in purchases are not persisted to a roster.** The API counts the season roster for the initial seat check, but the webhook does not write a drop-in attendance record, so per-Monday capacity can't be enforced across multiple drop-in buys. Fix with durable Stripe-session idempotency (the existing `NGA Processed Stripe Events DB` ledger) and a per-Monday drop-in count (season regs + drop-ins for that date). The current "at-most-once" comment in the webhook is wrong — Stripe retries events.

## Legal pages

- `/privacy` and `/terms` created; linked in the footer next to the copyright line.

## Analytics

- `src/components/Analytics.tsx` (mounted in `src/app/layout.tsx`): environment-gated GA4 (`NEXT_PUBLIC_GA4_MEASUREMENT_ID`) and Meta Pixel (`NEXT_PUBLIC_META_PIXEL_ID`). No IDs configured yet — scripts stay out until Sam supplies them.
- `src/lib/funnelClient.ts`: funnel events now mirror to GA4/Meta when configured. **The mirror call must run before the `navigator.sendBeacon` early return** — verify this ordering in review.

## Homepage & navigation

- New intent chooser below the hero (`src/components/IntentChooser.tsx`):
  - New to pickleball → free evaluation / lessons
  - Looking to play → leagues / MVF Session 2
  - Looking to improve → lessons
- Navbar slimmed to six links: Start Here, Lessons, Leagues, MVF Classes, Schedule, About.
- Primary evaluation CTAs (Hero, HowItWorks, LevelCard, Footer) now point at `/free-evaluation/book`.

## MVF Session 2

- Featured on the homepage and the top of the MVF page (`src/components/MvfSessionTwoFeature.tsx`).
- Oct 15 – Nov 19, 2026 · 6 Thursdays · Red/Orange 5:30–6:30 PM · Green/Yellow 6:30–7:30 PM · $90 resident / $100 non-resident · registration links out to MVF ActiveCommunities.
- Consider date-gating after Nov 19, 2026.

## Contact standardization

- `src/data/site.ts` already carried `nextgenacademypb@gmail.com` and `301-325-4731`; remaining public surfaces updated to them.
- `PICKLPARK_LEAGUE_COACH_EMAIL` now uses the academy email (was `sam.morris2131@gmail.com`). Internal notification recipients were deliberately left alone.

## Copy corrections (city landing pages)

- Fall season runs **Sunday afternoons** (Green 1:00–2:30, Yellow 2:30–4:00) at Walter Johnson HS — "Sunday-evening" copy corrected.
- Earle B. Wood Saturday-evening sessions are past seasons (templates are `active: false`; the 2026-08-27 venue move put the whole fall season at WJ) — claims reworded to past tense with a pointer to the schedule page. Monday Girls still runs at Earle B. Wood (Mondays 6–7 PM).

## New environment variables (see `.env.example`)

- `STRIPE_PRIVATE_LESSON_PRICE_ID`, `STRIPE_GROUP_LESSON_PRICE_ID`
- `STRIPE_MONDAY_GIRLS_DROPIN_PRICE_ID`
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_META_PIXEL_ID`

## Sitemap

- Added `/lessons`, `/privacy`, `/terms`.

## Webhook handlers added

- `src/app/api/stripe/webhook/route.ts` dispatches `kind=monday-girls-dropin` and `kind=lesson`: admin + parent confirmations via Resend, Open Brain lead ingest. Neither adds to an operational roster.

## Tests

- `e2e/homepage.spec.ts` updated for the new nav/eval CTAs; sitemap specs pass. New-product tests (lessons fail-closed/live, drop-in validation, legal links, analytics gating) are still to add.
