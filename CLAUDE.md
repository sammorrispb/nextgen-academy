# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Values & Growth Mindset (read first — these drive every decision)

Next Gen exists to grow young players, so a **growth mindset** isn't just our coaching
philosophy — it's how we build the site too. Kids develop through effort, encouragement,
and getting another rep, not through being labeled; the product follows the same rule.
Every level (Red/Orange/Green/Yellow) is a step on one ladder, never a ceiling, and the
"welcomes all four" group-session policy is that belief in code. When something misses —
a broken funnel, a low-converting page, a cron that didn't fire — treat it as the next
rep, not a verdict: default to "not yet," ship a slice, measure, improve. The long-term
vision is judged the same way: does this help kids and families *grow* over time?

Five values steer the judgment calls the rules below can't make for us:

- **Inclusion** — Every kid 6–16 of every level is welcome; pricing is teased gently so
  cost never gates the door, and the all-levels on-ramp means no child is turned away for
  being "not ready." Copy invites, never intimidates.
- **Ethics** — These are minors. The COPPA-aligned minor-data governance below is
  non-negotiable: parents control everything, comms go to parents (never kids), collect
  the minimum, honest pricing (no quoting a price that doesn't exist yet), no dark
  patterns, no DD/CR re-introduction.
- **Skills** — The whole point is real skill development for kids — and for this codebase:
  prefer the durable approach, leave the tree more maintainable than you found it.
- **Excellence** — `npm run build` green is the floor, not the bar. Invariant tests
  first on payments / auth / minor-PII; protect the Slop-Free Zones; ship correct, not
  just shippable (EASE = Excellence).
- **Attitude** — Coach-voice everywhere: warm, encouraging, generous, low-ego. Assume
  good faith, document the *why*, and leave the next session better off.

When a decision isn't covered by a rule below, choose the path that best honors these
values and the growth-mindset lens — and for anything touching payments, auth, or minor
PII, run it through the IPAV loop.

## What This Is
**NOTE (2026-05-01):** This site was decoupled from Dill Dinkers / CourtReserve on 2026-05-01. No DD/CR references should be re-introduced.
**2026-05-02:** Hub coupling fully removed (funnel POSTs, inbound_leads forward, the legacy Hub URL helper, and the /api/funnel-track proxy are all gone).

Marketing / lead-gen website for **Next Gen Pickleball Academy** — youth pickleball (ages 6–16, strict — no exceptions, no under-6 on-ramp) in Montgomery County, MD. Drives parents to free evaluations and the Yellow Ball tournament track. **Policy changed 2026-06-18: every public group session now runs a court per level (Red/Orange/Green/Yellow) and welcomes all four — four spaces (one court) each.** (Previously group play was Green/Yellow only, with Red/Orange private-lessons-only.) Red and Orange Ball are still *also* offered as private lessons for kids who want 1:1 work before joining a group. All four recurring weekly evenings — Ridgeview Mon / Redland Tue ("Olney Tuesday Evening" before 2026-06-09) / Westland Wed / Shannon Thu (Green/Yellow only) — are auto-seeded by the `seed-tuesday-sessions` cron (`ensureWeeklyTemplates` in `src/lib/recurring-sessions.ts`), one row per level per week; the edit surface for venues/times/levels is `src/data/recurring-templates.ts` (nothing is seeded by hand anymore). The post-eval email surfaces group sessions to Red/Orange families as an on-ramp alongside the private-lesson option.

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
4. **Decode referral**: if the form payload carries `ref` (captured from `/newsletter?ref=<token>`), `verifyReferralToken()` decodes the referrer's email. Self-referrals are silently dropped. A fresh `Referral Token` is signed over the new subscriber's email and stamped on the row.
5. **Notion dedup-and-create** into the NGA Newsletter Subscribers DB (`NOTION_NEWSLETTER_DB_ID`): query by Email; if found, skip create; else create with Parent Name (title), Email, Child Age (number), Status=Active, Marketing Opt-In=true, Welcome Sent=false, `Referral Token`, `Referred By`, `Referral Rewarded`=false, `Coupons Issued`=0. Skipped gracefully if env vars missing.
6. **Resend**: welcome email to the subscriber (template `src/lib/email/newsletter-welcome.ts`, bcc admin, replyTo `nextgenacademypb@gmail.com`) carrying the personalized forward link + `/crew` CTA + a short admin notification. Flips `Welcome Sent`=true after a successful send; suppresses the welcome only if dedup found an already-welcomed row.
7. **Open Brain** ingest (`source: "nga_newsletter_signup"`, includes `referred_by` in metadata), awaited.

**Pricing copy is teased, not quoted.** Neither the page nor the welcome email carries hard prices ($25/monthly). The only live price is the single $20 drop-in (`STRIPE_DROPIN_PRICE_ID`), shown on `/schedule`. The welcome email references the referral perk ("you both get 50% off your next drop-in") as a percentage rather than a dollar amount, so a parent never reads a base price that isn't real yet. Keep it that way until a real $25/monthly product exists in Stripe.

### Eval confirmation (`POST /api/eval-confirmation`)
**Always send the templated eval confirmation through this endpoint — never hand-build the email.** Free evaluations are booked manually (a parent inquires, Sam picks a time), so there's no Stripe webhook to fire the confirmation. This `?secret=$NGA_ADMIN_SECRET`-gated endpoint is the single source of truth for that send: it renders `src/lib/email/eval-confirmation.ts` (shared `brand.ts` chrome, EASE = Excellence), builds the `.ics` via `buildDropInIcs()` (`src/lib/email/ics.ts`), sends via Resend (`from` noreply@, **BCC** `nextgenacademypb@gmail.com`, replyTo `nextgenacademypb@gmail.com`) with the `.ics` attached, then stamps `Eval Date` on the lead's NGA Player CRM row (`src/lib/notion-eval.ts`, fail-soft — a Notion miss never fails a delivered email).

Body (JSON): `parentEmail`, `childFirst`, `date` (`YYYY-MM-DD`), `startTime`/`endTime` (`"10:00 AM"`), `location` (all required); `parentFirst`, `coachName` (defaults "Coach Sam"), `dryRun` (optional). Validates all required fields up front (400 with `errors[]` on bad input) so a malformed call never half-sends. `dryRun: true` (or `?dryRun=1`) returns the rendered subject + plain-text preview without sending. Template/subject/text logic is unit-tested in `e2e/eval-confirmation.spec.ts` (pure functions, no dev server). Pure-function specs run with `npx playwright test e2e/eval-confirmation.spec.ts --project=desktop`.

Note: the endpoint does NOT create the coach's Google Calendar event — that's still an operator/agent step (the parent's calendar is covered by the attached `.ics`). Always `dryRun` first to eyeball the copy before a live send.

### Crew Interest (`/crew` + `/api/crew-interest`)
**The no-active-poll fallback.** If a parent's preferred slot doesn't match any Crew Poll Sam is currently running, they fill out the Crew Interest form instead. Sam reviews the Notion DB and decides whether to spin up a new poll for the day/level mix coming through. Surfaces: a dedicated `/crew` landing page (`src/app/crew/page.tsx`) rendering `src/components/CrewInterestForm.tsx`, plus a "None of these fit? / Want a regular crew?" callout in every weekly newsletter.

Fields: parent name, email, optional phone, child first name + age + level (Red/Orange/Green/Yellow), optional **skill sub-level** (Low/Mid/High — refines matching only, never a gate), preferred days (multi-select Mon–Sun), preferred time (free-form), optional location + friends-wanted + notes. Validated by `src/lib/validate-crew-interest.ts`.

`POST /api/crew-interest`:
1. Validate → 400; rate-limit by IP (5/hr) → 429.
2. **Notion write** into NGA Crew Interest DB (`NOTION_CREW_INTEREST_DB_ID`) with Status=New. Fails soft (logs + continues so the welcome email still sends).
3. **Resend**: admin notification (`sam.morris2131@gmail.com`, CC `nextgenacademypb@gmail.com`) + parent confirmation (`src/lib/email/crew-interest-welcome.ts`, BCC admin).
4. **Open Brain** ingest (`source: "nga_crew_interest"`).

The welcome email (and the 7-day follow-up below) surface **matching open sessions** — `matchSessionsForPreferences()` in `src/lib/crew-matching.ts` filters the Sessions DB to Open-with-a-seat rows at the kid's level on a preferred weekday in an overlapping area. Fail-soft: a Notion miss just shows the generic `/schedule` CTA.

Never publishes anything publicly — Sam owns whether the submission becomes a Crew Poll.

**Follow-up automation — `GET /api/cron/crew-followup`** (Bearer `CRON_SECRET`, schedule `0 15 * * *` UTC). Reads still-actionable rows (Status New/Reviewed; routed families — Polled/Closed — are never re-touched) via `fetchActionableCrewInterest()`. Stage logic is pure (`src/lib/crew-followup.ts`): **day 3+** → one internal digest to Sam (`sam.morris2131@gmail.com`, CC admin) listing each waiting family with its strongest candidate crew (`findCandidateMatches`: same color + age ±3 + ≥1 shared day + area overlap; sub-level only ranks) and the count of open sessions that fit — flips `Nudge Sent`. **Day 7+** → a parent re-engagement email (`src/lib/email/crew-followup-parent.ts`, BCC admin) with the matching open sessions — flips `Reengagement Sent` + `Nudge Sent`. Re-engage wins when both are due (cron-gap first touch). Egresses only to Notion + Resend; recipients are parent/admin only. Idempotency columns `Nudge Sent` / `Reengagement Sent` live on the Crew Interest DB. Pinned by `e2e/invariant-crew-followup-egress.spec.ts` (+ `e2e/invariant-crew-interest-pii-egress.spec.ts` for the sub-level field's egress).

### Newsletter referral payout (Stripe webhook branch)
Every newsletter subscriber gets an HMAC-signed `Referral Token` at signup (`src/lib/referral-token.ts`, signing key `REFERRAL_TOKEN_SECRET` → falls back to `NGA_ADMIN_SECRET`). Both the weekly newsletter and the welcome email surface it as a personalized `?ref=<token>` link on `/newsletter`. When a friend signs up via that link, their row gets `Referred By` set to the referrer's email.

**Reward fires on the friend's first paid drop-in** (not at signup). In `src/app/api/stripe/webhook/route.ts`, the `checkout.session.completed` fan-out includes `processReferralReward(session)` (`src/lib/referral-rewards.ts`), which:
1. Looks up the friend's subscriber row by `customer_email`.
2. No-ops if there's no `Referred By` or `Referral Rewarded` is already true (idempotent on webhook retries).
3. Looks up the referrer row by the `Referred By` email. If the referrer isn't (or no longer is) a subscriber, flips `Referral Rewarded`=true on the friend's row and skips the payout (prevents retry storms on lapsed referrers).
4. Mints two Stripe coupons (50% off, `duration: "once"`, `max_redemptions: 1`) and matching auto-generated promotion codes — one per recipient.
5. Emails both parents (`src/lib/email/referral-friend-reward.ts`, `src/lib/email/referral-referrer-reward.ts`, BCC admin).
6. Flips `Referral Rewarded`=true on the friend's row and increments `Coupons Issued` on both rows.

Promo codes work at checkout because `/api/checkout/route.ts` already passes `allow_promotion_codes: true` to Stripe Checkout. No `STRIPE_REFERRAL_PRICE_ID` env var is needed — the coupon mints inline. Failure of any step is logged + swallowed so a Notion blip never blocks the user's success page or triggers a Stripe webhook retry storm.

### Weekly newsletter blocks (per issue)
On top of the open sessions, the Thursday cron (`/api/cron/weekly-newsletter`) now renders four new blocks (`src/lib/email/weekly-newsletter.ts`):
- **Forming crews now** — up to 5 Open polls from `fetchOpenPolls()`, each with day/time/location/level + Yes-vote progress label, linking to `/poll/<slug>`. Hidden when none.
- **Crew interest CTA** — always renders; copy adapts to whether polls are present ("None of these fit?" vs "Want a regular crew?").
- **Private lessons card** — routes to `/#contact-form` for parents whose kid isn't ready for group play. (Since the 2026-06-18 policy change, Red/Orange kids are welcome at the cron-seeded weekly evenings too — Ridgeview Mon / Redland Tue / Westland Wed run all four levels, Shannon Thu currently Green/Yellow per its template — so the card frames privates as *also*-available 1:1 work, not the only Red/Orange option.)
- **Bring the crew (referral)** — personalized `/newsletter?ref=<token>` link with the 50% off framing. Falls back to a generic forward ask if `REFERRAL_TOKEN_SECRET`/`NGA_ADMIN_SECRET` aren't configured.

### Eval-lead re-engagement (`POST /api/eval-reengagement`)
One-time (re-runnable) outreach inviting existing eval leads to opt into the newsletter. `?secret=$NGA_ADMIN_SECRET`-gated. Queries the lead CRM (`NOTION_DB_ID`), classifies every row with `src/lib/lead-segmentation.ts` (`classifyLead`), and sends the brand-reviewed `eval-reengagement` template (`src/lib/email/*`) only to the **ELIGIBLE** bucket — deduped by email, per-recipient via Resend (BCC admin). **The DD-derived rule lives in code here:** OFF-LIMITS = Source CourtReserve/Google Sheet, any CR-event history, DD-era season (Fall 2025 / Winter 2026), or DD/CR in notes; ELIGIBLE = clean own-marketing sources (Website / Lead Form / Facebook Ad / etc.); everything else (empty/Evaluation/Referral source) is AMBIGUOUS and **never mailed**. Always `{"dryRun": true}` first to verify the eligible count + recipient list before a live send. Pricing teased, not quoted; the email is an opt-in invite (no unsubscribe token — recipients join via `/newsletter`). **Opt-outs:** ticking the `Quarantine` checkbox on a lead's CRM row makes `classifyLead` return `off_limits` before any provenance check, suppressing that lead from BOTH lead-marketing senders (camp-outreach + eval-reengagement). See `docs/unsubscribe-runbook.md` for the full opt-out SOP (newsletter vs lead-CRM vs SMS).

### Drop-in registration flow (`/schedule` + Stripe)
Pricing is **$20 per 1-hour slot, drop-in only — no subscription, no refunds**. Sessions split into Early and Late slots — pick one or both (two slots = 2 × $20 until the planned $35 two-hour bundle ships). Each session opens for registration **30 days ahead** and caps at 4 players per pickleball court.

Source of truth for the public class schedule is the **NGA Sessions Schedule** Notion DB (`NOTION_SESSIONS_DB_ID`). Sam edits it (or a connected Google Sheet); the site reads it via `src/lib/notion-sessions.ts` with 5-min ISR.

User flow:
1. Parent visits `/schedule`, picks one open session.
2. Form → `POST /api/checkout` creates a Stripe Checkout Session ($20, qty 1) on NGA Stripe `acct_1TU4iSBpXOfTC961` with metadata `{parent, child, sessionId}`.
3. Parent pays in Stripe Checkout, lands on `/schedule/success`.
4. `/api/stripe/webhook` (signed by `STRIPE_WEBHOOK_SECRET`) on `checkout.session.completed`:
   - Sends real-time email to `nextgenacademypb@gmail.com` via Resend.
   - Increments `Registered count` on the Notion session row, flips `Status` to "Full" if at capacity.
   - Inserts a row into the NGA Drop-in Registrations Notion DB (`NOTION_DROPINS_DB_ID`) with status "Confirmed".

The pre-2026-05-05 monthly subscription / blocks-cron model has been retired. Do not reintroduce per-month "blocks", `remindersSent[]`, or the `/api/cron/block-reminders` route.

### One-time waiver (`/waiver` + `/waiver/sign` + pre-checkout gate)
**Replaced the old per-event waiver checkbox (2026-06).** A parent now e-signs ONE liability/media waiver — it's stored to their profile (a dedicated Notion DB) and emailed to them, and is required before their child's first **paid** event.

- **Waiver text** is a single source of truth in `src/data/waiver.ts` (`WAIVER_VERSION`, `WAIVER_SECTIONS`); the static `/waiver` page, the `/waiver/sign` page, and the confirmation email all render from it. Bump `WAIVER_VERSION` whenever the copy changes — it's stamped on every signed row.
- **Signing**: `/waiver/sign` → `WaiverSignForm` → `POST /api/waiver-sign` (validate → rate-limit → guard `RESEND_API_KEY` → Notion dedup-by-email then create → Resend confirmation carrying the FULL waiver text, BCC admin → Open Brain `nga_waiver_signed`). Typed-legal-name signature + "I agree"; records name, signed-at, version, and signer IP. Idempotent: a re-sign no-ops (dedup by email). The waiver is **parent-scoped — no child fields are ever written**, so it stays off the minor-PII egress surface.
- **Storage**: NGA Waivers Notion DB (`NOTION_WAIVERS_DB_ID`), one row per parent keyed on Parent Email (phone fallback). Helpers in `src/lib/notion-waivers.ts` (`findWaiverByEmail`, `createWaiver`, `hasWaiverOnFile`).
- **The gate**: all four paid checkout routes (`/api/checkout`, `/api/checkout-camp`, `/api/checkout-league`, `/api/checkout-cluster`) call `hasWaiverOnFile(email, phone)` BEFORE creating the Stripe session. No waiver → `409 { code: "waiver_required", signUrl }`; the register forms catch this and redirect to `/waiver/sign` (prefilled), then the parent returns to re-register. `src/lib/waiver-gate.ts` standardizes the 409 contract. **Fail-open when `NOTION_WAIVERS_DB_ID` is unset or on a transient Notion error** (never blocks revenue); fail-closed once configured. Pinned by `e2e/invariant-waiver-gate.spec.ts` + `e2e/invariant-waiver-egress.spec.ts`. Existing-family policy: required at next registration (no backfill).

### Drop-in comms — scheduled jobs

Vercel crons live in `vercel.json`. Auth = `Authorization: Bearer $CRON_SECRET` (Vercel auto-injects when invoking the scheduled job; manual `curl` needs the same header). All cron endpoints live under `/api/cron/*`. Per-template copy rules live in `BRAND_GUIDELINES.md` → `COMMS TEMPLATES`.

- **`GET /api/cron/dropin-reminder`** — schedule `0 17 * * *` UTC (= 1pm ET in EDT / noon ET in EST; ~one-hour drift across the DST changeover is accepted). Queries the NGA Drop-in Registrations DB for rows where `Session Date = tomorrow (America/New_York)` and `Status = Confirmed` and `Reminder Sent = false`. Sends a Coach-voice email to each parent (BCC `nextgenacademypb@gmail.com`) and an opt-in SMS where `SMS Consent = true`. Flips `Reminder Sent` to true after a successful email send.
- **`GET /api/cron/dropin-post-session`** — schedule `0 13 * * *` UTC (= 9am EDT / 8am EST). Email-only (no SMS — borderline-promotional, would need a separate marketing opt-in). Queries for rows where `Session Date = yesterday (America/New_York)` and `Status = Confirmed` and `Post Session Sent = false`. Sends a Coach-voice "thanks for showing up + book the next slot" recap (EASE = Skills, single arrowed CTA → `/schedule`). Footer carries a "reply 'skip' to stop" politeness cue for the borderline-promotional concern. Flips `Post Session Sent` to true after send.
- **`GET /api/cron/weekly-newsletter`** — schedule `0 22 * * 4` UTC (= Thu ~6pm ET). The automated NGA parent newsletter. Reads Open sessions in the next 9 days from the Sessions DB + all `Status = Active` rows in the NGA Newsletter Subscribers DB (`NOTION_NEWSLETTER_DB_ID`) + up to 4 `Status = Approved` rows from the NGA Youth Pickleball News DB (`NOTION_NEWS_DB_ID`) + ALL `Status = Approved` rows from the NGA Newsletter Drafts DB (`NOTION_NEWSLETTER_DRAFTS_DB_ID`, Drafted At within last 7 days, oldest first), renders the `weekly-newsletter` template (`src/lib/email/weekly-newsletter.ts`), and sends one personalized email per subscriber via Resend (each carries a signed one-click unsubscribe link → `GET /api/newsletter/unsubscribe`, which flips the row to `Unsubscribed`). After a successful broadcast it flips the included news rows from `Approved` to `Used` so they don't re-appear next week — the snapshot used for the send is the same one flipped, so anything Sam approves mid-broadcast stays queued for next week. Newsletter-drafts rows stay Approved after send (the 7-day window naturally excludes them next week); Sam can flip a row to Skip to suppress future cron picks of it. Also sends a QA/archive copy to `nextgenacademypb@gmail.com`. **Coach tip rotates from a pre-approved bank** (`src/lib/newsletter-tips.ts`) — an unattended cron can't write fresh copy. **Newsletter-drafts lead block fills the same "fresh editorial copy" need** but only from rows Sam has explicitly Approved (the Wednesday drafter row and/or any operational-announcement row added by hand or by an agent) — the Tuesday/Wednesday cloud routines write Pending rows, Sam reviews, the cron picks up only Approved. Nothing ships un-reviewed. If no Open sessions, sends a tip-only issue. **Pricing is teased, not quoted** (drives to `/schedule`). Per the standing rule, the template copy + tip bank pass `/brand-review-nga` whenever they change; per-week dynamic content (session data, Sam-approved news headlines, Sam-approved drafter sections) is all gated by Sam approval, so there's no fabrication risk. Unsubscribe tokens sign with `NEWSLETTER_UNSUB_SECRET` (falls back to `NGA_ADMIN_SECRET`).

### Newsletter lead block — drafter pipeline (Tue/Wed cloud routines → Notion → cron pickup)
The Thursday newsletter optionally includes a "From Coach Sam this week" lead block between the Coach Tip and the existing news-cards block. Source: an Approved row in the **NGA Newsletter Drafts** Notion DB (`NOTION_NEWSLETTER_DRAFTS_DB_ID`). Pipeline runs entirely outside this repo:

1. **Tue 8am ET — NGA News Radar (cloud routine `trig_011PQmfHNdiTgPud4v4kqxHG`)** scrapes youth/junior pickleball news (MoCo-first, DMV-adjacent) via WebSearch + WebFetch and posts a sourced markdown report to Notion under "NGA News Radar — Weekly Issues" (page_id `36cfa3ac-27dc-810e-a6a7-c7d96ac44224`).
2. **Wed 8am ET — NGA Newsletter Drafter (cloud routine `trig_01CS13QeZxuCndRhB3mUJRNB`)** clones this repo for the live `BRAND_GUIDELINES.md`, reads the latest radar page, picks 1–3 strongest items, drafts Coach-voice sections (80–180 words each, sentence-case headlines, inline source credit, parent/kid tone split), self-reviews against the brand guide, and writes a new row to the NGA Newsletter Drafts DB with `Status = Pending`. The row's page body contains ONLY the section markdown (the cron's source of truth); the `Notes` rich-text property holds operator commentary + brand-review state + dropped items + verifications.
3. **Wed/Thu before 6pm ET — Sam reviews** in Notion. To greenlight, he flips `Status` from `Pending` to `Approved` on the row. Edits to the page body in Notion are picked up by the cron on next render (last-writer-wins, no commit needed).
4. **Thu 6pm ET — cron picks up.** `fetchApprovedNewsletterDrafts()` (plural) in `src/lib/notion-newsletter-drafts.ts` queries the DB for ALL `Status = Approved` rows with `Drafted At` within the last 7 days (oldest first) and, for each, fetches the row's child blocks via the Notion REST API, and converts them to email-safe HTML (heading_2/3, paragraph, divider, bulleted_list_item, numbered_list_item — with bold/italic/code/link rich-text). The per-row HTML is concatenated with a thin divider into the `newsletterLeadHtml` field of `WeeklyNewsletterInput`; the template renders it inside an accent-lime card under the "From Coach Sam this week" eyebrow. Fails soft on any Notion error so the cron still ships the rest of the email.

The cron NEVER writes back to the drafts DB. The 7-day window is the only freshness guard — a stale Approved row from earlier than 7 days ago is silently ignored on next Thursday's send. Every Approved row in the window ships (concatenated oldest-first) — so an operational announcement row and the Wednesday drafter row can both be Approved without one shadowing the other. To run ONLY one of them, leave the other Pending or flip it to Skip.
- **`GET /api/cron/scrape-news`** — schedule `0 11 * * *` UTC (= ~6am ET in EST / 7am EDT). Pulls youth-pickleball news candidates from Google News RSS (6 youth-targeted queries), USA Pickleball + PPA RSS feeds, and Reddit (r/Pickleball + r/youthsports `top.json?t=week`). Each candidate must mention both a pickleball term and a youth-context term (`youth`, `junior`, `kid`, `school`, `academy`, `camp`, `coach`, `clinic`, etc.); see `matchYouthPickleball()` in `src/lib/news-scraper.ts`. Dedup is by canonical URL (UTM/tracking params stripped, Google News redirector unwrapped via `canonicalizeUrl()`). New URLs land in the **NGA Youth Pickleball News DB** (`NOTION_NEWS_DB_ID`) with `Status = New` for Sam to triage to `Approved` (ships in the next Thursday newsletter), `Rejected` (filtered out next time it's seen), or left to age out. Skipped silently if the env var is missing — endpoint still runs as a dry-run reporting candidates count. Pure parsing helpers (URL canonicalization, keyword filter, dedup) are unit-tested in `e2e/news-scraper.spec.ts`.
- **`GET /api/cron/seed-tuesday-sessions`** — schedule `0 8 * * 1` UTC (Mon ~3–4am ET). Keeps **all four recurring weekly evenings** stocked (the path keeps its historical Tuesday name so the vercel.json entry and dashboards stay stable): for each ACTIVE template in `src/data/recurring-templates.ts` (Ridgeview Mon / Redland Tue / Westland Wed / Shannon Thu — Shannon Green/Yellow only, the rest all four levels; every evening 6:30–7:30 PM per MCPS permit #684275), ensures each of the next `WEEKS_AHEAD` (8) occurrences of its weekday has one row per level — a court each. Seeded dates are strictly FUTURE (min 1-day lead — a Monday run never seeds that same Monday). **Idempotent per template family** (a row whose title matches the template's titleBase or any `legacyTitlePrefixes` counts as present for its date+level, whatever its Status — a deliberately-cancelled evening/level is never resurrected, and a row hand-moved onto another evening's date can't suppress that evening's seed) and **fail-soft per row**, with a ~350ms Notion create throttle + one 429 retry. Misconfiguration alerts instead of no-opping green: missing `NOTION_API_KEY`/`NOTION_SESSIONS_DB_ID` → `config_missing`, an invalid template → `config_invalid`, an existing seeded row whose start time drifted from its template → one rolled-up `time_drift` entry (signal only — live rows are never auto-corrected). `?dryRun=1|true|yes` returns the would-create list with zero writes (any other value → 400, never a silent live run) — run it against prod before trusting a new template. Logic in `src/lib/recurring-sessions.ts` (`ensureWeeklyTemplates`; pure helpers `upcomingWeekday`, `buildTemplateRowProps`, `validateTemplate`, `parseDryRunParam` unit-tested in `e2e/recurring-sessions.spec.ts`). **The edit surface for venues/times/levels/active is `src/data/recurring-templates.ts`** — session locations are public (the hidden-location/reveal-cron system was retired 2026-06-05).

- **`GET /api/cron/reconcile-cancelled-sessions`** — schedule `0 */2 * * *` UTC (every 2 hours). Closes the gap where a session marked `Cancelled` **by hand in Notion** (the common weather pull) fires NO refunds and NO parent comms — only the coach "Cancel session, notify all" button (`executeSessionCancel`) moves the money. Sweeps the Sessions DB for **upcoming** Cancelled rows (today ET → +`REGISTRATION_WINDOW_DAYS`; never past, so it can't retroactively refund a session marked Cancelled for bookkeeping) via `fetchCancelledSessionsInWindow()`, and for any row whose Confirmed roster still has an un-refunded registrant (`sessionNeedsCancelFanout`), fires the SAME idempotent `executeSessionCancel` engine (Stripe refund + Coach-voice cancellation email/opt-in SMS + `Cancellation Notified` flag). Self-healing: once everyone is refunded + notified, later ticks read the roster and skip — no duplicate refund or email. Parent email reason comes from an optional Sessions DB `Cancel Reason` select (weather/venue/low-enrollment/other; defaults to `other`) + optional `Cancel Note` rich-text. Pure act/skip + reason helpers in `src/lib/reconcile-cancelled.ts`, unit-tested in `e2e/reconcile-cancelled.spec.ts`. NOTE: marking a session Cancelled in Notion still does NOT auto-fire until the next 2-hour tick — for an instant pull use the coach button.

- **`GET /api/cron/camp-checklist-reminder`** — schedule `0 11 * * *` UTC (= 7am ET in EDT; summer camps run on EDT). The 7am-on-camp-days coach nudge: emails the coach allowlist (`COACH_ALLOWED_EMAILS`, falling back to `nextgenacademypb@gmail.com`) a link to `/coach/camp-checklist` so the supply + setup run-of-show is one tap away before drop-off. No parent/child data — coaches only, so it sits outside the minor-PII egress surface. `campsRunningOn(todayET, CAMPS)` (pure, reuses `campDays()` in `src/data/camps.ts`) resolves the day's camp(s) from the scheduled Mon–Thu mornings and **no-ops** on every other day — including the makeup/rain Friday, which the cron can't know actually runs. Logic in `src/lib/camp-checklist-reminder.ts` (`runCampChecklistReminder`); email in `src/lib/email/camp-checklist-reminder.ts`; pure helpers + template unit-tested in `e2e/camp-checklist-reminder.spec.ts`. Always `?dryRun=1` (optional `&date=YYYY-MM-DD` to test a specific camp day) before relying on it.

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
- **Day-of check-in** — per-row Here/No-show toggle on `/coach/[slug]` → `markAttendanceAction` writes the `Attendance` select and fires `ingestToOpenBrain({ source: "nga_attendance" })` keyed on parent email/phone, so each check-in lands as an activity on the player's Open Brain profile (the profile system of record). Tapping the active state again clears it. The full fan-out (Notion write + OB activity + player-stat recompute) lives in `src/lib/attendance.ts` (`applyAttendance`) so the agent-callable `POST /api/coach/attendance` (Bearer `ATTENDANCE_SECRET`, idempotent, PII-free ack) fires the identical triggers instead of a raw Notion write dropping them. The action keeps OB fire-and-forget; the route awaits it for Vercel durability.
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
- `NOTION_WAIVERS_DB_ID` — NGA Waivers DB (`8ff69033-db0b-4d96-a8df-ead6b6ac7682`); one signed one-time waiver per parent. Read by the pre-checkout waiver gate. UNSET = gate fails open (checkout never blocked); set it to enforce.
- `STRIPE_SECRET_KEY` — NGA Stripe acct `acct_1TU4iSBpXOfTC961`.
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret.
- `STRIPE_DROPIN_PRICE_ID` — price ID for the single $20 NGA Drop-in slot product.
- `NOTION_CREW_INTEREST_DB_ID` — NGA Crew Interest DB (the no-active-poll fallback form). Optional — endpoint logs + continues if unset.
- `NOTION_NEWS_DB_ID` — NGA Youth Pickleball News DB (scraped news queue Sam triages for the weekly newsletter). Optional — scraper runs as a dry-run if unset, weekly newsletter just hides the news block.
- `NOTION_NEWSLETTER_DRAFTS_DB_ID` — NGA Newsletter Drafts DB (Coach-voice longform sections drafted Wednesday by the cloud drafter routine; Sam approves a row before Thu 6pm for the cron to inject as the "From Coach Sam" lead block). Optional — weekly newsletter just hides the lead block if unset. See the "Newsletter lead block — drafter pipeline" section above.
- `REFERRAL_TOKEN_SECRET` — HMAC signing key for `/newsletter?ref=<token>` links. Optional — falls back to `NGA_ADMIN_SECRET`. Distinct from `NEWSLETTER_UNSUB_SECRET` so a leaked unsub token can't be replayed as a referral and vice versa.
- `OPEN_BRAIN_INGEST_URL` + `LEAD_INGEST_TOKEN` — Open Brain ingest.
- `ATTENDANCE_SECRET` — Bearer secret for the agent-callable attendance check-in (`POST /api/coach/attendance`), giving an out-of-band caller the same fan-out as the coach toggle (Notion write + OB activity + profile recompute). Distinct from `NGA_ADMIN_SECRET` to isolate blast radius. Unset = the route fails closed (401).
- `SESSION_OPS_SECRET` — Bearer secret for agent-callable session ops. `POST /api/admin/sessions/{cancel,reschedule}` accept EITHER the admin `nga_admin` cookie (UI) OR `Authorization: Bearer SESSION_OPS_SECRET` (agent/cron) via `authorizeSessionOps()` (`src/lib/session-ops-auth.ts`). Both paths hit the same route → same engine (`executeSessionCancel` / `executeSessionReschedule`), so an agent fires the identical trigger fan-out (refunds / parent comms / Notion re-date + flag resets) the editor does — pinned by `e2e/invariant-admin-session-ops-parity.spec.ts`. Distinct from `NGA_ADMIN_SECRET` to isolate this refund-capable surface. Unset = the Bearer path fails closed (401); the cookie/UI path still works.

## Testing Standards
- **`npm run build` must pass with zero errors before every push.** Minimum bar.
- Test behaviour, not implementation — Playwright specs in `e2e/` assert what the page renders / what the API returns.
- Tag mobile-only / desktop-only tests by checking `testInfo.project.name` and calling `test.skip()` (see `homepage.spec.ts`).
- Validate any form input (XSS / injection) before persisting or echoing back.

## Minor-Data Governance (COPPA-aligned)
NGA serves children ages 6–16; parents are the account holders and control everything until 18. Rules that bind every change:

- **Child-PII inventory & flow.** Child fields (first name, birth year — never more) flow exactly one path on registration: Stripe checkout metadata → `/api/stripe/webhook` → Notion roster row (+ Player CRM sync) + admin/parent email. The Notion row holds parent contact + child fields together; there is no separate child record. Any NEW egress destination for child fields is a hostile-review trigger (see `docs/hostile-reviewer.md`) and is pinned by `e2e/invariant-child-pii-egress.spec.ts`.
- **Comms go to parents, never minors.** Email/SMS recipients are parent or admin addresses only. SMS additionally requires TCPA consent: `sendSms()` hard-refuses without `consent: true`, and consent flips only on the exact string `"true"` from checkout metadata (`e2e/invariant-consent-gating.spec.ts`). The verbatim opt-in language is stored on the row for audit defense.
- **Child data is reachable only through parent-scoped or coach-scoped auth.** Parent scope = HMAC tokens binding exactly one registration (`src/lib/cancel-token.ts`). Coach scope = signed session cookie + `COACH_ALLOWED_EMAILS` allowlist, composed in `coach/(authed)/layout.tsx`. Both gates fail closed and are pinned by `e2e/invariant-cancel-token-scope.spec.ts` and `e2e/invariant-coach-session-scope.spec.ts`.
- **Don't collect more.** No DOB (birth year only), no school, no medical fields (except the documented camp-safety exception below), no photos of minors without `Display Consent`. Adding any new child field requires Sam's explicit approval first.
- **Camp safety exception (allergies + emergency contact).** Camp registration (`/api/checkout-camp`) collects two fields beyond the first-name + birth-year baseline — a free-text **allergies/medical** note and an **emergency contact** name + phone — both required for safe day-of supervision of a child at an in-person camp. They travel the same single path as other child fields (Stripe checkout metadata → webhook → Notion roster + parent/admin email) and are **never persisted to a separate child record**. They surface only on **auth-gated coach camp-roster views** (`/coach/camps/*`), read live from Stripe and **print-only — no file export** (v1). Allergies are capped at 480 chars at checkout; the roster flags possible truncation. This is the only sanctioned expansion of child fields; any *further* field still requires Sam's explicit approval.

## Slop-Free Zones (no edits without separate explicit approval)
Tests OBSERVE these files; they never modify them. Any change here goes through the IPAV loop (below) with its own approval:

- **Payments:** `src/app/api/stripe/webhook/route.ts`, all `api/checkout*` + `api/commit/*` + `api/cancel-*` routes, `src/lib/{stripe,refund-amount,cancel-camp,cancel-dropin,cluster-refund}.ts`, `api/cron/crew-autoreserve` (off-session charges).
- **Auth/tokens:** `src/lib/{coach-auth,coach-allowlist,admin-auth,admin-allowlist}.ts`, all 5 HMAC token libs (`cancel-token`, `commit-token`, `newsletter-token`, `referral-token`, `session-cancel-token`), the 4 auth-session routes (`admin|coach/auth/verify`, logout).
- **Minor PII:** `src/lib/{notion-player-sync,notion-player-lookup,player-profiles,notion-dropins,notion-eval,registrant-match,roster-mailto,attendance}.ts`, `api/admin/sessions/registrants`, `api/coach/attendance`, coach roster/player pages, the 3 eval routes.

Full inventory + risk log: `docs/source-inventory.md`.

## Production Class Ladder (per module)
**production** (full invariant-test coverage, fail-closed, alerting): drop-in funnel (schedule/checkout/webhook/cancel/crons), camps, crew autoreserve, weekly newsletter, coach + admin portals.
**hardened** (gated + observed, lighter coverage): eval endpoints, notion-session-webhook, referral rewards.
**prototype** (deliberately dark or staged; don't gold-plate): league (ships 503 until price env), clusters (staged pilot), coach polls/crew machinery.
**show pony** (static; zero test investment): SEO city pages, schools/yellowball lead forms. (The waiver is no longer a static show-pony — the one-time e-sign flow + pre-checkout gate are invariant-tested; see "One-time waiver".)
Promotion up the ladder requires: invariant tests first, then the hostile-review checklist, then Sam's sign-off.

## Working Loop: Investigate → Propose → Approve → Validate (IPAV)
Default for ANY change touching payments, auth/tokens, or minor PII (and recommended everywhere):
1. **Investigate** — read the real code/inventory; verify claims against the tree, not memory.
2. **Propose** — plan with files, invariants at risk, and rollback; present before writing code.
3. **Approve** — Sam's explicit go. Approval gates are HARD STOPS; approval in one scope doesn't extend to the next.
4. **Validate** — invariant tests written/extended FIRST (fail before, pass after — see `skills/add-invariant-test.md`), full `npm run test:pure` + lint + build green, mutation-check new specs, log the decision in `agent-log.md` (Situation · Decision · Risk · Change).

## Reference Files
- `BRAND_GUIDELINES.md` — single source of truth for colors, typography, component naming (BEM `card__title` etc.), thumb-zone rules, copywriting do/don't lists. Read this before any visual change.


## Git Safety
- Never run `git reset --hard` without first checking for uncommitted work in parallel sessions/worktrees
- Prefer `git stash` or branch-based recovery

## Date Handling
- Never use `new Date(y, m, d)` for date-only values — it breaks on UTC build servers
- Use ISO date strings or date-fns with explicit timezone handling

## Deployment Verification
- After merging any PR, verify the change is live in production via curl/browser before declaring done
- For migrations, confirm schema applied in prod Supabase
- For cron jobs, smoke-test the endpoint

## Session End Protocol
- Always save learnings to Open Brain (OB) at session end via MCP, with SQL fallback if MCP transport is unhealthy
- Persist key decisions, friction points, and resolved bugs as searchable thoughts
