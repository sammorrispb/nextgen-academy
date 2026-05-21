# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is
**NOTE (2026-05-01):** This site was decoupled from Dill Dinkers / CourtReserve on 2026-05-01. No DD/CR references should be re-introduced.
**2026-05-02:** Hub coupling fully removed (funnel POSTs, inbound_leads forward, the legacy Hub URL helper, and the /api/funnel-track proxy are all gone).

Marketing / lead-gen website for **Next Gen Pickleball Academy** — youth pickleball (ages 8–16) in Montgomery County, MD. Drives parents to free evaluations and the Yellow Ball tournament track. Public group sessions are Green or Yellow Ball only; Red and Orange Ball are private-lessons-only.

Live at https://nextgenpbacademy.com (deployed on Vercel, auto-deploy from `main`).

## Ecosystem
Part of Sam Morris's pickleball platform. Other repos this site talks to:
- **Open Brain** (`sammorrispb/open-brain`) — semantic CRM; receives `ingestToOpenBrain` POSTs.
- Cross-family nav links use `familySiteUrl()` helpers that stamp UTMs + `ld_pid`.

## Stack
- **Next.js 16** (App Router, TypeScript, React 19, Turbopack)
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Fonts:** Montserrat (headings), Inter (body), Roboto Mono (numbers/dates) — loaded via `next/font/google` in `src/app/layout.tsx`
- **Email:** Resend (`resend` SDK)
- **Tests:** Playwright (`@playwright/test`) — desktop + mobile projects
- **Path alias:** `@/*` → `src/*`

## Common Commands
```bash
npm run dev       # local dev server (http://localhost:3000)
npm run build     # production build — must pass with zero errors before push
npm run lint      # ESLint (eslint-config-next + core-web-vitals + typescript)
npm start         # serve the production build

# Playwright (no npm script — run directly)
npx playwright test                          # all e2e tests, both projects
npx playwright test --project=desktop        # desktop only (1280×800)
npx playwright test --project=mobile         # mobile only (375×812)
npx playwright test e2e/homepage.spec.ts -g "FAQ"   # single test by name
# baseURL is http://localhost:3000 — start `npm run dev` in another terminal first

# Funnel wiring sanity check (validates HMAC signing + ensures no analytics
# pixels / Yellow Ball mailto: links / urls.ts regressions crept back in)
node scripts/verify-funnel.mjs
```

## Architecture

### Pages (App Router)
All pages render against the dark theme set in `layout.tsx` (`bg-ngpa-navy`).

- `/` (`src/app/page.tsx`) — Home. Single long page with anchor sections: `#levels`, `#ease`, `#testimonials`, `#about`, `#contact-form`, `#faq`, `#contact`. Old top-level routes (`/programs`, `/about`, `/contact`, `/faq`) are 301-redirected to anchors via `next.config.ts`.
- `/schedule` — Static placeholder. Locations rotate seasonally; visitors are routed to the lead form.
- `/free-evaluation` — Dedicated lead-gen landing page (was `/free-trial`, redirected).
- `/yellowball/inquiry` — Separate inquiry form for the tournament track (Yellow Ball is invite-only — no public registration).
- `/montgomery-county-youth-pickleball` — SEO landing page targeting local search.

### Content vs. Live Data
All content is static under `src/data/*.ts`. There is no live data fetch — the site previously pulled CourtReserve event lists, but that integration was removed 2026-05-01.

### Lead flow (`/api/lead`, `/api/yellowball-lead`)
A single lead submission fans out to multiple destinations. Order in `src/app/api/lead/route.ts`:
1. **Rate limit** by IP (in-memory map, 5 req/hr — resets on deploy).
2. **Validate** with `src/lib/validate-lead.ts`.
3. **Notion CRM** dedup-and-create (`NOTION_DB_ID = "1e5e34c258384c6cb5f3e846543ecfc7"`). Skipped if `NOTION_API_KEY` missing.
4. **Resend** emails: admin notification to `sam.morris2131@gmail.com` (cc `nextgenacademypb@gmail.com`) + parent confirmation if email provided.
5. **Open Brain** ingest (`ingestToOpenBrain`, fire-and-forget, requires email — phone-only leads are skipped here and backfilled later).

If any optional integration's env var is missing, that step logs a warning and is skipped — the response still succeeds as long as Resend works.

### Newsletter signup (`/newsletter` + `/api/newsletter`)
Free, top-of-funnel offer: a cold parent says yes to the free thing first; price and referral come later (in the welcome email). Surfaces: a dedicated `/newsletter` landing page (`src/app/newsletter/page.tsx`) and an embedded `#newsletter` section on the home page (between `#contact-form` and `#faq`). Both render `src/components/NewsletterForm.tsx` (parent name + email + child age; validated by `src/lib/validate-newsletter.ts`). "Newsletter" links live in the navbar (`links` array) and the footer "Explore" list.

`POST /api/newsletter` (`src/app/api/newsletter/route.ts`) mirrors `/api/waitlist`:
1. Validate (parentName/email/childAge) → 400 `{ error, errors }`.
2. Rate-limit by IP (5/hr, in-memory) → 429.
3. Guard `RESEND_API_KEY` (500 if missing — the welcome email is the core value).
4. **Notion dedup-and-create** into the NGA Newsletter Subscribers DB (`NOTION_NEWSLETTER_DB_ID`): query by Email; if found, skip create; else create with Parent Name (title), Email, Child Age (number), Status=Active, Marketing Opt-In=true, Welcome Sent=false. Skipped gracefully if env vars missing.
5. **Resend**: welcome email to the subscriber (template `src/lib/email/newsletter-welcome.ts`, bcc admin, replyTo `nextgenacademypb@gmail.com`) + a short admin notification. Flips `Welcome Sent`=true after a successful send; suppresses the welcome only if dedup found an already-welcomed row.
6. **Open Brain** ingest (`source: "nga_newsletter_signup"`), awaited.

**Pricing copy is teased, not quoted.** Neither the page nor the welcome email carries hard prices ($25/$40/monthly). The only live price is the single $40 drop-in (`STRIPE_DROPIN_PRICE_ID`), shown on `/schedule`. The welcome email references "crew pricing and bring-a-friend perks" qualitatively + a CTA to `/schedule`, so a parent never reads a number that isn't real yet. Keep it that way until a real $25/monthly product exists in Stripe.

### Drop-in registration flow (`/schedule` + Stripe)
Pricing is **$40 per 1-hour slot, drop-in only — no subscription, no refunds** ($80 for both slots in a session). Sessions split into Early and Late slots. Each session opens for registration **30 days ahead** and caps at 4 players per pickleball court.

Source of truth for the public class schedule is the **NGA Sessions Schedule** Notion DB (`NOTION_SESSIONS_DB_ID`). Sam edits it (or a connected Google Sheet); the site reads it via `src/lib/notion-sessions.ts` with 5-min ISR.

User flow:
1. Parent visits `/schedule`, picks one open session.
2. Form → `POST /api/checkout` creates a Stripe Checkout Session ($40, qty 1) on NGA Stripe `acct_1TU4iSBpXOfTC961` with metadata `{parent, child, sessionId}`.
3. Parent pays in Stripe Checkout, lands on `/schedule/success`.
4. `/api/stripe/webhook` (signed by `STRIPE_WEBHOOK_SECRET`) on `checkout.session.completed`:
   - Sends real-time email to `nextgenacademypb@gmail.com` via Resend.
   - Increments `Registered count` on the Notion session row, flips `Status` to "Full" if at capacity.
   - Inserts a row into the NGA Drop-in Registrations Notion DB (`NOTION_DROPINS_DB_ID`) with status "Confirmed".

The pre-2026-05-05 monthly subscription / blocks-cron model has been retired. Do not reintroduce per-month "blocks", `remindersSent[]`, or the `/api/cron/block-reminders` route.

### Drop-in comms — scheduled jobs

Vercel crons live in `vercel.json`. Auth = `Authorization: Bearer $CRON_SECRET` (Vercel auto-injects when invoking the scheduled job; manual `curl` needs the same header). All cron endpoints live under `/api/cron/*`. Per-template copy rules live in `BRAND_GUIDELINES.md` → `COMMS TEMPLATES`.

- **`GET /api/cron/dropin-reminder`** — schedule `0 17 * * *` UTC (= 1pm ET in EDT / noon ET in EST; ~one-hour drift across the DST changeover is accepted). Queries the NGA Drop-in Registrations DB for rows where `Session Date = tomorrow (America/New_York)` and `Status = Confirmed` and `Reminder Sent = false`. Sends a Coach-voice email to each parent (BCC `nextgenacademypb@gmail.com`) and an opt-in SMS where `SMS Consent = true`. Flips `Reminder Sent` to true after a successful email send.
- **`GET /api/cron/dropin-post-session`** — schedule `0 13 * * *` UTC (= 9am EDT / 8am EST). Email-only (no SMS — borderline-promotional, would need a separate marketing opt-in). Queries for rows where `Session Date = yesterday (America/New_York)` and `Status = Confirmed` and `Post Session Sent = false`. Sends a Coach-voice "thanks for showing up + book the next slot" recap (EASE = Skills, single arrowed CTA → `/schedule`). Footer carries a "reply 'skip' to stop" politeness cue for the borderline-promotional concern. Flips `Post Session Sent` to true after send.

### Drop-in comms — coach-triggered (no cron)

- **`cancelSessionAction({ sessionRowId, sessionTitle, sessionDate, sessionStartTime, reason, note? })`** — Next.js server action in `src/app/coach/(authed)/[slug]/actions.ts`. Fired from the **Cancel session, notify all** button on `/coach/[slug]`. Coach-auth-gated. For each Confirmed drop-in: issues a Stripe refund (idempotent on "already refunded"), sends a Coach-voice broadcast email (BCC admin) with a `reason` variant (weather / venue / low-enrollment / other) + optional note, sends opt-in SMS where consented, and flips `Cancellation Notified`. The flag suppresses the per-row cancel-confirmation that `cancelDropIn()` would otherwise send when the `charge.refunded` webhook fires, so parents get exactly one cancellation comms per session-wide pull. The `charge.refunded` webhook flips each drop-in row Status to `Refunded`. The action then flips the session row Status to `Cancelled` and revalidates `/schedule`, `/coach`, `/coach/[slug]`. If any refund fails outright, the session row stays Open so Sam can re-fire.

### Drop-in cancel — per-row paths + auto-comms

All four per-row cancel paths run through `cancelDropIn(checkoutSessionId, status)` in `src/lib/cancel-dropin.ts`:
1. **Stripe `charge.refunded` webhook** (`/api/stripe/webhook`) — auto-fires when a refund posts in Stripe (whether from the coach-triggered broadcast, admin curl, or a Stripe Dashboard click).
2. **Coach cancel / refund** (PR #62) — `cancelRegistrationAction` server action on `/coach/[slug]`. Offers no-refund cancel, full refund, or custom partial refund: it calls `stripe.refunds.create({ payment_intent, amount? })` (amount validated by `resolveRefundCents()` in `src/lib/refund-amount.ts`), then `cancelDropIn(id, "Refunded", refundedUsd)`. Flipping the row to Refunded + `Cancellation Notified` first makes the `charge.refunded` webhook this same refund fires a no-op — exactly one email, with the partial amount shown correctly.
3. **Parent self-serve** (PR #65) — signed cancel link in confirmation email → `/schedule/cancel`.
4. **Admin curl** (PR #60) — `POST /api/cancel-registration?secret=$NGA_ADMIN_SECRET`.

`cancelDropIn()` flips the Notion Status, decrements the session's Registered count (if previously Confirmed), and sends a Coach-voice **cancel-confirmation** to the parent (HTML email + opt-in SMS) with two micro-variants — "Refunded" (refund cue + $X back) vs "Cancelled" (community framing + non-refundable disclosure). Suppressed if `Cancellation Notified` is already true (means the session-wide broadcast covered them). Flag flips after a successful email send. Comms failure is logged-and-swallowed so it never blocks the cancel itself.

The NGA Drop-in Registrations DB has three boolean idempotency columns the comms surfaces own: `Reminder Sent`, `Post Session Sent`, `Cancellation Notified`. Helper: `markDropInFlag(pageId, flag)` in `src/lib/notion-dropins.ts`. It also has an `Attendance` select (`Present`/`No-show`, blank = not recorded) set by `setDropInAttendance()`. The NGA Sessions Schedule DB owns the `Status` column flipped by `setSessionStatus()` in `src/lib/notion-sessions.ts`.

### Coach dashboard — attendance check-in + family profiles
- **Day-of check-in** — per-row Here/No-show toggle on `/coach/[slug]` → `markAttendanceAction` writes the `Attendance` select and fires `ingestToOpenBrain({ source: "nga_attendance" })` keyed on parent email/phone, so each check-in lands as an activity on the player's Open Brain profile (the profile system of record). Tapping the active state again clears it.
- **Family/player profiles** — `/coach/players` (directory) + `/coach/players/[key]` (profile). Assembled from the Notion drop-in rows (transactional source of truth for sessions/payments/refunds/attendance); OB is the semantic mirror. Keyed per family on parent email (phone fallback), with per-child sections. Pure aggregation + key encode/decode in `src/lib/player-profiles.ts` (`buildFamilyProfile`, `encodeParentKey`); Notion reads via `fetchDropInsByParent` / `fetchAllDropInsInRange`. Partial-refund caveat: a Refunded row counts as a full refund in the rollup (Notion stores only the original amount paid; Stripe is the precise ledger).
- **`"use server"` gotcha** — action files (`actions.ts`) may only export async functions, so pure/sync helpers (`resolveRefundCents`, `buildFamilyProfile`, key codecs) live in plain libs and are unit-tested directly (`e2e/refund-amount.spec.ts`, `e2e/player-profiles.spec.ts`). Pure-function specs run without a dev server: `npx playwright test e2e/<file>.spec.ts --project=desktop`.

### URL helpers (`src/lib/urls.ts`)
Always route outbound links through these — they handle UTM/`ref` stamping consistently:
- `familySiteUrl(dest, path)` → cross-family link with full UTM block + `ld_pid` cookie value.
- `getRefSource(pathname)` → maps page paths to specific `marketing_ref` values.

## Conventions
- **Theme is dark, not light.** Backgrounds alternate `bg-ngpa-navy` and `bg-ngpa-black`; cards use `bg-ngpa-panel` / `bg-ngpa-slate`. The brand colors (`ngpa-lime #AADC00`, `ngpa-cyan`, etc.) are dark-surface only — `ngpa-lime` on white fails WCAG. See `BRAND_GUIDELINES.md` for the full palette and rules.
- **Skill colors are `ngpa-skill-{red,orange,green,yellow}`** (`#FF4040`, `#FF8C00`, `#00C853`, `#FFD600`). Always use Red / Orange / Green / Yellow as labels — never synonyms like "Beginner" / "Pro".
- **Tailwind utilities only**, no inline styles. Mobile-first; iPhone SE (375px) is the minimum supported viewport.
- **Min tap target 48×48px** (WCAG 2.5.5). Primary CTAs ("Get a Free Evaluation", "Register") belong in the bottom thumb zone — there's a fixed `StickyMobileCTA` for mobile.
- **Schema.org JSON-LD** is required: `SportsActivityLocation` in the root layout, `FAQPage` + `Person` (per coach) on the home page, one `SportsEvent` per upcoming session on `/schedule`. Use the `<JsonLd />` component.
- **All program dates use `<time datetime="YYYY-MM-DD">`** and prices use `itemprop="price" content="N"` (numeric, no `$`). This is for AI/scheduler parsing — see BRAND_GUIDELINES "AI-PARSING OPTIMIZATION".
- **Yellow Ball is invite-only.** No public registration link, no `mailto:` CTAs — route all interest to `/yellowball/inquiry`. `verify-funnel.mjs` enforces this.
- **No third-party pixels.** GA4, Meta Pixel, `@vercel/analytics`, `gtag`, `fbq` are explicitly banned — `verify-funnel.mjs` greps for them.
- Don't add comments that describe what code does. Add a comment only when the *why* isn't obvious (e.g. the CR API shape unwrap, the `remindersSent[]` git-as-audit-trail decision).

## Environment Variables
See `.env.example`. Categories:
- `RESEND_API_KEY` — required for any lead form / Stripe webhook email to succeed.
- `NOTION_API_KEY` — required for the public schedule and webhook DB writes.
- `NOTION_SESSIONS_DB_ID` — NGA Sessions Schedule database ID (`3eed8a91-f328-4b63-a4aa-b890f133a80a`).
- `NOTION_DROPINS_DB_ID` — NGA Drop-in Registrations database ID (`557f01d8-e4c6-47d9-a67b-f0817dd8724f`).
- `STRIPE_SECRET_KEY` — NGA Stripe acct `acct_1TU4iSBpXOfTC961`.
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret.
- `STRIPE_DROPIN_PRICE_ID` — price ID for the single $40 NGA Drop-in slot product.
- `OPEN_BRAIN_INGEST_URL` + `LEAD_INGEST_TOKEN` — Open Brain ingest.

## Testing Standards
- **`npm run build` must pass with zero errors before every push.** Minimum bar.
- Test behaviour, not implementation — Playwright specs in `e2e/` assert what the page renders / what the API returns.
- Tag mobile-only / desktop-only tests by checking `testInfo.project.name` and calling `test.skip()` (see `homepage.spec.ts`).
- Validate any form input (XSS / injection) before persisting or echoing back.

## Reference Files
- `BRAND_GUIDELINES.md` — single source of truth for colors, typography, component naming (BEM `card__title` etc.), thumb-zone rules, copywriting do/don't lists. Read this before any visual change.
