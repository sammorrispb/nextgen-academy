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

Marketing / lead-gen website for **Next Gen Pickleball Academy** — youth pickleball (ages 6–16, strict — no exceptions, no under-6 on-ramp) in Montgomery County, MD. Drives parents to free evaluations and the Yellow Ball tournament track. **Policy changed 2026-06-18: every public group session now runs a court per level (Red/Orange/Green/Yellow) and welcomes all four — four spaces (one court) each.** (Previously group play was Green/Yellow only, with Red/Orange private-lessons-only.) Red and Orange Ball are still *also* offered as private lessons for kids who want 1:1 work before joining a group. All four recurring weekly evenings — Ridgeview Mon / Redland Tue ("Olney Tuesday Evening" before 2026-06-09) / Westland Wed / Shannon Thu (Green/Yellow only) — are auto-seeded by the `seed-tuesday-sessions` cron (`ensureWeeklyTemplates` in `src/lib/recurring-sessions.ts`), one row per level per week; the edit surface for venues/times/levels is `src/data/recurring-templates.ts`. **Weekend move (2026-07-21):** weeknight evenings were retired (didn't work for parents; collided with Link & Dink's weekday nights) and youth sessions moved to Sat/Sun at the two best-performing venues — Earle B. Wood MS (Saturdays) + Walter Johnson HS (Sundays), Red/Orange 6–7 PM and Green/Yellow 7–8 PM (one reserved tennis court per evening → two pickleball courts, a level each). The four weeknight templates are kept but `active: false` (so the seeder recognizes their already-seeded rows for row-family idempotency and never resurrects a Cancelled one); the weekend templates are `active: false` too because the first weekend block (Aug 2026) is **hand-seeded** in Notion — Sam is away Aug 8–16 and the block starts Aug 1, so the run has holes the weekly cron can't express. Flip the weekend templates to `active: true` to resume open-ended auto-seeding once the cadence runs gap-free. The post-eval email surfaces group sessions to Red/Orange families as an on-ramp alongside the private-lesson option.

Live at https://nextgenpbacademy.com (deployed on Vercel, auto-deploy from `main`).

## Deliverables go to Notion, not to a published artifact

**Standing preference (Sam, 2026-08-30): any document-shaped deliverable is a Notion
page.** Runbooks, playbooks, plans, reports, reviews, proposals, summaries meant to be
kept — write them into Notion with the Notion MCP tools so Sam can read them in the
Notion app and edit them with Claude later. A published HTML artifact is a dead end for
that: he cannot open it in Notion and cannot edit it in a later session.

- **How:** read `notion://docs/enhanced-markdown-spec` first (via `notion-fetch`) — Notion
  markdown has its own callout, table and toggle syntax, and guessing it produces a page
  that renders wrong. Give the page an icon and a one-line italic standfirst.
- **Still fine as an artifact:** something that is genuinely a *web page* — an app, a
  dashboard, an interactive tool, a chart that needs to run. Prose is a Notion page.
- Answering a question in chat is not a deliverable. This is about documents that outlive
  the conversation.

The same rule is in the other three repos' CLAUDE.md, each pointing at its own Notion
home. Filing is **by project**: L&D procedures → Link & Dink SOPs
(`fe1c6730149a4dc08b679fb5d4809bd0`), L&D technical/product decisions → the Tech Decisions
register via `/decision`, NGA marketing/ops → Next Gen Pickleball Academy HOME
(`210fa3ac27dc804d9877f8a77c48d40b`), coach handbook → NGA Coaching System
(`349fa3ac27dc8156953afa142c43435c`), Open Brain → the Open Brain hub
(`3ccfa3ac27dc81dd82b0d7c9b4da531c`), anything uncategorised → its Brain Dump inbox.

- **Where, in this repo:** under **Next Gen Pickleball Academy HOME**
  (`210fa3ac27dc804d9877f8a77c48d40b`). When nothing there obviously fits, ask rather
  than guessing.
- **Minor-data governance still binds a Notion page.** A document is an egress surface
  like any other: no child first names, no birth years, no roster detail, no allergy or
  emergency-contact text. Aggregates and policy only. The rule that a new egress
  destination for child fields is a hostile-review trigger does not stop applying because
  the destination is prose.

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
5. **Open Brain** ingest (`ingestToOpenBrain`, awaited — `void` was silently losing ~half of all leads to Vercel's post-response Promise drop; accepts email OR phone).

If any optional integration's env var is missing, that step logs a warning and is skipped — the response still succeeds as long as Resend works.

**A repeat inquiry is never a no-op (2026-08-30).** Dedup is still per PARENT, but "already on file" used to mean the route wrote NOTHING — no row created, no row updated — so a second child, a changed location and fresh parent notes were dropped while the admin email rendered them in full. The only tell was a `Notion CRM: already exists` line nobody reads. Both `/api/lead` and `/api/contact` now call `appendLeadInquiry()` (`src/lib/notion-lead-enrich.ts`) on the family's newest row and create a row only for kids `hasChildRow()` doesn't already match. `notionStatus` reports what happened (`updated existing`, `+ created N new child row(s)`). Pinned by `e2e/invariant-lead-dedup-no-drop.spec.ts`.

**The location radio's answer is no longer discarded.** `LeadForm`/`ContactForm` used to transmit `location` ONLY when the parent picked Frederick, so every Montgomery County family — the default and the common case — read "No preference" in the admin email and left Notion's `Location` empty. Both forms now send whichever option was chosen. NOTE: the CRM `Location` select still carries an older vocabulary (`Rockville` / `North Bethesda` / `Either`) that doesn't overlap `LEAD_LOCATIONS`; Notion auto-creates the new options on first write, but whether to migrate the old ones is an open operator decision.

### Email → CRM enrichment (`POST /api/lead-enrich`)
**Why it exists:** correspondence with a family was being captured but never reached the CRM. A nightly Gmail scrape (`daily_life_scrape`, launchd on Sam's Mac) lands threads in Open Brain as `thoughts`, and ~6 inquiries a month were additionally summarized into Open Brain `lead_activities` with exactly the detail a coach wants ("lives near Rockville", "privates before group") — but `contacts` has no `notion_page_id`, so none of it could be joined back to the Player CRM row. `Last Contact Date` was populated on 33 of 420 rows.

- **`Authorization: Bearer LEAD_ENRICH_SECRET`, fails CLOSED** — a wrong token OR an unset secret both 401, so the surface ships dark until deliberately enabled. Dedicated secret (not `NGA_ADMIN_SECRET`) to isolate blast radius, same posture as `ATTENDANCE_SECRET` / `SESSION_OPS_SECRET`.
- **Body:** `{ parentEmail | parentPhone, summary, messageId?, observedAt?, location?, landingPage?, dryRun? }`. `location` is allowlisted against `LEAD_LOCATIONS` so an email parse can't invent a Notion select option.
- **One engine, two callers.** The route calls the SAME `appendLeadInquiry` the form path uses, so an email-derived update and a form-derived update cannot drift.
- **Idempotent on `messageId`** — the appended line carries a `[gm:<id>]` marker and a message already present is a no-op, so re-running the scan is safe. No new Notion property needed.
- **Never writes `Status` or `Level`** (coach judgment — a label inferred from an email must not stick to a kid) and **never overwrites a non-empty `Location` / `Landing Page`** (an operator's value outranks anything derived).
- **An unmatched parent creates nothing.** Plenty of inbound mail is from people who were never a lead; the inbox must not be able to invent families.
- **Notion-only egress** — no Resend, no Open Brain, no analytics. The Player CRM is already a sanctioned child-PII destination so this adds no NEW destination, but it is a new WRITER: pinned by `e2e/invariant-lead-enrich-egress.spec.ts` + `e2e/invariant-lead-enrich-authz.spec.ts`.
- **Always `{"dryRun": true}` first** — returns the exact Notes line that would be appended and writes nothing.
- **The routine is cloud-scheduled, not a Vercel cron.** A cron would need Google OAuth credentials plus a refresh-token store in production — the tradeoff `docs/admin-reduction-roadmap.md` already declined for the calendar sync. It also runs whether or not Sam's Mac is awake, which the launchd scrape does not.
- **`Landing Page`** (rich_text) was added to the Player CRM for this. `appendLeadInquiry` is fail-soft on it anyway: a Notion rejection naming an OPTIONAL property (`Location` / `Landing Page`) retries once without it, so a missing column costs the attribution but never the Notes append — the same lesson as `createNotionPageSourceFailSoft`.

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

### Empty-state waitlist (`/api/waitlist` + `OpenNowOffers`)
The form that renders ONLY when there are zero open sessions — on `/schedule` and in
the home page's "This week" block (`UpcomingSessions.tsx`). Whenever the drop-in
schedule is dark (every `recurring-templates.ts` entry `active: false` since 2026-08-23)
this is the site's **primary conversion surface**, so treat it as a real funnel, not an
edge case.

- **Collects parent name + contact + area + child first name + age (6–16) + optional
  level** (Red/Orange/Green/Yellow, defaulting to "Not sure yet" — a level must never
  gate the door). Child fields approved by Sam 2026-08-28; the vocabulary mirrors
  `validate-crew-interest.ts`. Nothing beyond that — no last name, DOB, school, or
  medical.
- **The NGA Waitlist DB is a child-PII destination as of 2026-08-28.** Child fields go
  to Notion (the row) and Resend (the admin notification) ONLY. `/api/analytics` and
  the Open Brain ingest stay parent-only — both fire on this route, so this is the
  live edge of hostile-review item #4. Pinned by
  `e2e/invariant-waitlist-pii-egress.spec.ts`, which SETS the Open Brain env and
  asserts the payload is child-free rather than deleting the env so the helper
  self-skips (that would prove only that the call didn't happen).
- **Adding a child property means editing the Notion DB FIRST.** Notion 400s the whole
  create when a payload names a property the DB lacks, and
  `createNotionPageSourceFailSoft` retries ONLY Source-named rejections —
  `e2e/waitlist-source-failsoft.spec.ts` deliberately pins that other rejections stay
  visible, so don't widen it. A schema break loses the row but not the lead: the route
  emails regardless and reports `notionStatus` on the admin notification.
- **`OpenNowOffers` (`src/lib/open-now-offers.ts`, pure + date-injected)** renders what
  a parent can act on today, beside the form and in the confirmation email from the
  same helper so the two can't drift. Each card retires itself from its own data —
  fall on `NEXT_PUBLIC_FALL_REGISTRATION_OPEN` + the season's last Sunday, league on
  its `registrationDeadline`. **No seat counts** (they need a Notion read; a fabricated
  count is worse than none) and **no league price** (`checkout-league` 503s until its
  price env is set, so the card links the `/league` interest form).
- The confirmation email is the only message these families consented to receive —
  most decline marketing opt-in — so it carries the offers rather than a bare "we'll
  be in touch."

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
**Community WhatsApp invites lead the issue (2026-08-19).** Both groups render as a
quiet utility card (`whatsappGroupsTopHtml()` in `src/lib/email/signature.ts`) directly
under the hero, above every content block; the footer keeps only `phoneLineHtml()`.
It is a MOVE, not an addition — the same two links must never appear twice in one email,
so `weekly-newsletter.ts` and `newsletter-welcome.ts` are the only recipient-facing
templates that do NOT compose `signatureExtras*`. This also fixed a real defect: the
signature block used to be composed INSIDE the conditional "From Coach Sam" lead card,
so any week without an Approved Notion draft shipped HTML with no WhatsApp link at all
while the plain-text part had them. Pinned by `e2e/invariant-email-signature.spec.ts`
(rendered, not grepped) + the invite tests in `e2e/weekly-newsletter.spec.ts`.

**The fall season leads the issue while registration is open (2026-08-20).** The Aug 20
issue shipped with no fall block at all while `/fall` was live with all 16 seats unsold,
and it led instead with a camp that had ended that morning. The season block sits above
even the MVF tournament card and owns the subject line (`fallHasOpenSeats`) until both
groups fill — it is the one thing in the email a family can only buy once. It renders
from `fall-2026.ts` + `fall-season-2026.ts` (so it can't fall off the way an Approved
Notion row can), gated on the same `NEXT_PUBLIC_FALL_REGISTRATION_OPEN` flag `/fall`
reads plus the season's own last Sunday, so it retires itself. It quotes the real $225
(a live Stripe product — the no-quoting rule targets prices that don't exist yet). Seat
counts come from the live roster and fail SOFT: a null from `countFallRegistrations`
prints the group size, never a fabricated count.

**Two stale-content rules the same issue taught us.** (1) Camps come from
`upcomingCamps(todayIso)` — `startDate > today`, NOT `endDate >= today`, which kept a
camp in the issue on its own final morning. (2) The plan-ahead block (`laterSessions`,
formerly `summerSessions`) carries **season-neutral copy and no month filter**. "Summer
sessions are live" fed by a June/July/August filter pitched a summer promo in late
August and would have hidden every September date outright. A season word in a template
that ships every week is a bug with a delay on it.

On top of the open sessions, the Thursday cron (`/api/cron/weekly-newsletter`) now renders four new blocks (`src/lib/email/weekly-newsletter.ts`):
- **Forming crews now** — up to 5 Open polls from `fetchOpenPolls()`, each with day/time/location/level + Yes-vote progress label, linking to `/poll/<slug>`. Hidden when none.
- **Crew interest CTA** — always renders; copy adapts to whether polls are present ("None of these fit?" vs "Want a regular crew?").
- **Private lessons card** — routes to `/#contact-form` for parents whose kid isn't ready for group play. (Since the 2026-06-18 policy change, Red/Orange kids are welcome at the cron-seeded weekly evenings too — Ridgeview Mon / Redland Tue / Westland Wed run all four levels, Shannon Thu currently Green/Yellow per its template — so the card frames privates as *also*-available 1:1 work, not the only Red/Orange option.)
- **Bring the crew (referral)** — personalized `/newsletter?ref=<token>` link with the 50% off framing. Falls back to a generic forward ask if `REFERRAL_TOKEN_SECRET`/`NGA_ADMIN_SECRET` aren't configured.

### Eval-lead re-engagement (`POST /api/eval-reengagement`)
One-time (re-runnable) outreach inviting existing eval leads to opt into the newsletter. `?secret=$NGA_ADMIN_SECRET`-gated. Queries the lead CRM (`NOTION_DB_ID`), classifies every row with `src/lib/lead-segmentation.ts` (`classifyLead`), and sends the brand-reviewed `eval-reengagement` template (`src/lib/email/*`) only to the **ELIGIBLE** bucket — deduped by email, per-recipient via Resend (BCC admin). **The DD-derived rule lives in code here:** OFF-LIMITS = Source CourtReserve/Google Sheet, any CR-event history, DD-era season (Fall 2025 / Winter 2026), or DD/CR in notes; ELIGIBLE = clean own-marketing sources (Website / Lead Form / Facebook Ad / etc.); everything else (empty/Evaluation/Referral source) is AMBIGUOUS and **never mailed**. Always `{"dryRun": true}` first to verify the eligible count + recipient list before a live send. Pricing teased, not quoted; the email is an opt-in invite (no unsubscribe token — recipients join via `/newsletter`). **Opt-outs:** ticking the `Quarantine` checkbox on a lead's CRM row makes `classifyLead` return `off_limits` before any provenance check, suppressing that lead from BOTH lead-marketing senders (camp-outreach + eval-reengagement). See `docs/unsubscribe-runbook.md` for the full opt-out SOP (newsletter vs lead-CRM vs SMS).

### Lead-CRM permission pass (`POST /api/camp-outreach` + `GET /api/lead-consent`)
**Why it exists:** only ~17 of 257 CRM families were on the newsletter, because the Newsletter Subscribers DB is written ONLY by a self-signup at `/newsletter` (or a referral link) — no lead / checkout / camp / eval / waiver path ever creates a subscriber row. The Aug-2026 camp blast doubles as a permission pass: the camp is the reason to open it, the explicit consent choice is the reason to send it.

- **Suppression is per FAMILY, never per row.** `resolveFamilyBucket` (`src/lib/lead-family-bucket.ts`) folds every CRM row for one parent email into one decision, precedence `suppressed > dd_derived > eligible > ambiguous`. The CRM holds 405 rows for 257 families, so the old row-by-row loop mailed anyone with a single clean row — ignoring a `Quarantine` tick on a duplicate and leaking DD provenance (`joegadler@`, `markyuen@`, `laurenwheelerporter@` each hold a Website row next to a Google Sheet row).
- **Two suppression sources, both absolute:** the CRM `Quarantine` checkbox, and `Status = Unsubscribed` in the newsletter DB (`fetchUnsubscribedEmails`). An unsubscribe is a person saying stop, not a per-sender preference — before this, unsubscribing from the weekly newsletter left camp-outreach free to mail them. `fetchUnsubscribedEmails` **throws** on a query failure; a short suppression list re-mails opt-outs, so callers must fail the send.
- **`classifyLead` gained `offLimitsKind: "opt_out" | "dd_derived"`** (additive). Quarantine is checked FIRST, so an opt-out is never re-labelled as provenance — that discriminator is what makes widening to DD-derived safe.
- **`includeDdDerived`** (body flag or `?includeDdDerived=1`) mails DD/CourtReserve-derived families. Off by default; the no-DD-derived-sales rule stands unless an operator overrides it for one send (Sam's explicit call, 2026-08-05). It widens **provenance only** and can never un-suppress an opt-out — pinned by `e2e/invariant-ops-trigger-parity.spec.ts`.
- **The consent links** are action-bound HMAC tokens (`src/lib/lead-consent-token.ts`, `LEAD_CONSENT_SECRET` → falls back to `NGA_ADMIN_SECRET`): the action is signed INTO the payload (`"subscribe:<email>"` / `"optout:<email>"`), so a consent link can't be edited into an opt-out or vice versa. `GET /api/lead-consent?action=…&token=…` — `optout` ticks `Quarantine` on EVERY row the family owns AND flips any subscriber row to Unsubscribed; `subscribe` upserts an Active subscriber row (`subscribeLeadByEmail`, no welcome email — they're reading one). Both idempotent. GET because it's an email link; prefetch is safe for the same reason.
- **No dark patterns:** both choices render at equal weight and the opt-out repeats in the footer. If no signing secret is set the template degrades to the reply-"skip" opt-out rather than rendering dead links. Pinned by `e2e/camp-outreach.spec.ts`.
- **Always `{"dryRun": true}` first.** The dryRun body surfaces `suppressed_opted_out`, `dd_derived`, and `dd_derived_mailed` — the three numbers to eyeball before a live send. No sent-flag column; a repeated live run re-sends, so use `only` to retry failures.

### Camp conclusion follow-up (`POST /api/camp-followup`)
The post-camp thank-you to every family whose camper just finished a camp week: a Google-review ask (the one primary CTA, link from `NGA_GOOGLE_REVIEW_URL`), a copy-paste share blurb for neighborhood listservs / Facebook / WhatsApp groups, and a register link for the next camp on the calendar. `?secret=$NGA_ADMIN_SECRET`-gated, manual (no cron). Engine in `src/lib/camp-followup-run.ts` (route/lib split like camp-reminder): reads paid registrations for the concluded camp straight from Stripe (`collectPaidCampSessions`), dedupes to ONE email per parent (multi-kid families get "Ava & Max"), sends via Resend (BCC admin, replyTo `nextgenacademypb@gmail.com`) + a counts-only admin QA copy. Template `src/lib/email/camp-followup.ts`. Body (JSON, all optional): `slug` (defaults to the latest concluded camp per ET today), `dryRun`, `only` (re-run failures), `reviewUrl` (overrides the env var). **No sent-flag column — a repeated live run re-sends; always `{"dryRun": true}` first.** Live sends refuse until `NGA_GOOGLE_REVIEW_URL` (or `reviewUrl`) is set, so a broken review button never ships. The share blurb is pasted publicly, so it carries only the next camp's `publicArea` — never `exactLocation` (pinned by `e2e/camp-followup.spec.ts` + `e2e/invariant-camp-followup-egress.spec.ts`; child first names egress to Resend only, addressed to the parent).

### Fall 2026 season survey (`/fall` + `POST /api/fall-interest` + `POST /api/fall-survey`)
**SUPERSEDED IN PART (PR #280): `/fall` is now the season REGISTRATION page, not the demand-sizing survey.** A real Stripe price backs `/api/checkout-fall`, so on that surface the noindex posture and the no-price rule are both lifted and $225 (`FALL_SEASON_PRICE_USD` in `src/data/fall-season-2026.ts`) is quoted — the no-quoting rule targets prices that don't exist yet, and this one does. `FallInterestForm` retired with the conversion. The rest of this section (season config, the derived seat math, the `/api/fall-survey` broadcast) still stands; read "the form asks what a season is worth" below as history.

**Season shape decided 2026-08-14 (Sam); VENUE MOVED 2026-08-27:** **Sundays only at Walter Johnson High School (6400 Rock Spring Dr, Bethesda, MD 20814), Sept 20 – Oct 25 (6 Sundays) — Green Ball 1:00–2:30 PM, Yellow Ball 2:30–4:00 PM, rain dates Nov 1 + Nov 8.** Earle B. Wood MS became unavailable for these Sundays and the season moved with **9 seats already sold**; dates, times, groups, seat count and price are all unchanged, only the place. Every registered family was emailed the change plus a **full-refund offer** — the season sells non-refundable, but the terms changed after purchase and not by the family's choice (`POST /api/fall-venue-change`, see below). **Wood MS is NOT retired** — Saturday drop-ins and the August camp still run there, so never sweep Wood references out of `recurring-templates.ts`, `camps.ts`, `blog.ts`, or the SEO city pages along with a season move. This supersedes the Saturday+Sunday 5–7 PM concept the survey originally sized. The **Link & Dink adult round robin** stays on the survey as its own track (slot TBD; parents encouraged to join). **Green 8 / Yellow 10 slots (2026-08-29 — see the seat-count bullet below), first come first serve, full-season commitment paid up front, with a sub list for week-to-week.**

- **Season config is `src/data/fall-2026.ts`** — venue, the 6 Sunday ISO dates + `FALL_RAIN_DATES` (written out, never computed: date arithmetic on a UTC build server is the documented footgun), both program definitions, `FALL_YOUTH_BLOCKS` (the Green/Yellow Sunday split), `FALL_PLAYERS_PER_COURT` + `FALL_SLOTS_BY_GROUP`, and the price bands. The page, the form, the confirmation email, the broadcast, and the events feed all render from it; editing the season is a one-file change.
- **Seat counts are DERIVED, not typed, and are PER GROUP** (derived 2026-08-15; per-group 2026-08-29). NGA reserves `FALL_TENNIS_COURTS_PER_SESSION` (1) tennis court per Sunday — Green and Yellow run back-to-back, so one court covers 1–4 PM — and each group's seats fall out of `FALL_TENNIS_COURTS_PER_SESSION × PICKLEBALL_COURTS_PER_TENNIS_COURT × FALL_PLAYERS_PER_COURT[group]`. **`FALL_PLAYERS_PER_COURT` is the only dial: Green 4 (the site-wide standard), Yellow 5** (Sam, 2026-08-29 — bought against the SAME single booking rather than a second court), giving Green 8 and Yellow 10. It drifted before: this file advertised 9 while `fall-poll-2026.ts` sold 8. **To change a seat count, change the court booking or that one map — never `PLAYERS_PER_PICKLEBALL_COURT`**, which sizes drop-ins and every venue's `playerCapacity` and must stay 4. There is no longer a single "spots per group" number, so any caller asking for one must say which group it means (`fallSeasonSlotsFor(group)`); the checkout sold-out gate is per-group and pinned by `e2e/invariant-fall-seat-cap-per-group.spec.ts`, alongside `e2e/fall-court-capacity.spec.ts` for the derivation.
- **No public surface publishes a seat count or a per-court cap** (2026-08-29). Capacity is a booking decision that moves, so `/fall`, the home-page FAQ, `/schedule`, the SEO pages, the fall survey/poll/registration-link emails and the weekly newsletter all say "small groups" and show a status derived from seats REMAINING (`src/lib/seat-status.ts`: Spots open / Filling up / Last spot / Full), never `N of M`. An unknown roster count renders nothing rather than a guess. Coach surfaces (`/coach/fall-playbook`) still show the real numbers — coaches need them.
- **NOTHING IS BOOKABLE YET.** There is no Stripe product for a season. Per the standing rule, **no price is quoted anywhere** — the form *asks* what a season would be worth (`FALL_PRICE_BANDS`). `FALL_NO_HOLD_NOTE` is the one sentence that keeps the promise honest ("filling this out doesn't hold a spot"); it's reused verbatim by the page, the confirmation, and the broadcast so it can't drift. A dollar figure in either template is a test failure.
- **The form** — `/fall` (`robots: noindex`, same posture as `/poll/[slug]`: an email-campaign landing page for a season that may not run, and it must not compete with `/schedule` in search). `FallInterestForm` → `POST /api/fall-interest`: validate (`src/lib/validate-fall-interest.ts`, shared client+server) → rate-limit 5/hr → `upsertFallInterest` → Resend (admin notify + respondent confirmation, BCC admin) → Open Brain `nga_fall_interest`. The Notion write is **hard-fail (500)**, unlike crew-interest's fail-soft — the response *is* the payload, and a "got it" for a dropped answer would be a lie. `track` is multi-select (`youth` / `adult`); **branch fields are required only for the tracks picked**, so an adult answering about themselves is never asked for a child's name and no child field is written.
- **Storage** — NGA Fall Interest Notion DB (`NOTION_FALL_INTEREST_DB_ID`), helpers in `src/lib/notion-fall-interest.ts`. **Upsert keyed on lowercased email** (like `upsertPollResponse`) so one respondent is one row; `Status` is set on create only, so a re-submission never resets a row Sam already triaged.
- **The broadcast** — `POST /api/fall-survey?secret=$NGA_ADMIN_SECRET`, engine `src/lib/fall-survey-run.ts`, template `src/lib/email/fall-survey.ts` with a `variant` of `nga` (leads with the youth season) or `ld` (leads with the adult round robin). Both variants carry both programs. **Audience = newsletter subscribers (`fetchActiveSubscribers`) ∪ the eligible lead-CRM bucket (`fetchLeadOutreachRecipients(false)`)**, deduped on lowercased email — reusing the lead-CRM helper means `classifyLead` excludes quarantined, DD/CR-derived, and ambiguous rows for free. Newsletter recipients get a signed unsubscribe link; lead-CRM recipients don't (they're not on a list — same posture as eval-reengagement). Body: `{ variant?, dryRun?, subject?, only? }`. **No sent-flag column — a repeated live run re-sends; always `{"dryRun": true}` first** and use `only` to retry failures. Also fires from `/coach/ops` (`fallSurveyAction`) under `authorizeOpsSend` — any coach may preview, admin identity only may live-send.
- Pinned by `e2e/validate-fall-interest.spec.ts`, `e2e/fall-survey.spec.ts` (copy + the no-dollar-figure rule), `e2e/invariant-fall-survey-egress.spec.ts` (Notion+Resend only, dryRun sends nothing, secret gate fails closed, quarantined/DD/ambiguous rows never mailed, counts-only admin QA copy), and `e2e/invariant-fall-interest-pii-egress.spec.ts` (**required** — the Fall Interest DB is a new egress destination for child fields).
- **The L&D half of the campaign ships no code here.** The Link & Dink send goes out through the existing community-os newsletter pipeline (`ld.enqueue_issue` already targets every confirmed, non-suppressed `ld.subscribers` row and attaches `List-Unsubscribe`); Sam pastes the issue at `www.linkanddink.com/admin/issues/new`. See `docs/fall-2026-ld-newsletter-issue.md`.

### Fall 2026 Sunday season poll (`POST /api/fall-poll-outreach` + `GET|POST /api/fall-poll`)
The CONFIRMED season announcement + one-click poll to **active families only** — distinct from the `/fall` demand-sizing survey above. Sam set the terms 2026-08-14 (`src/data/fall-poll-2026.ts`): **6 Sundays Sept 20 – Oct 25 at Walter Johnson HS (moved from Wood MS 2026-08-27), Green 1:00–2:30 PM / Yellow 2:30–4:00 PM, Green 8 / Yellow 10 spots, $225 per player** — the template quotes the price but NOT the seat counts (they differ per group and move with the booking; it says "limited spots"), so this template DOES quote the price (a real operator-set number; the no-quoting rule targets prices that don't exist yet).

- **Audience = active families** (`fetchActiveFamilies` in `src/lib/notion-fall-poll.ts`): any Player-CRM row with Status = Active, folded per family on lowercased parent email; one `Quarantine` tick anywhere in the family suppresses every address it owns, and newsletter `Status = Unsubscribed` suppresses too (`fetchUnsubscribedEmails` — a failed opt-out query fails the run). Deliberately NOT `classifyLead`: DD-provenance never blocks mailing a currently-active customer.
- **Poll links are action-bound HMAC tokens** (`src/lib/fall-poll-token.ts`, `FALL_POLL_SECRET` → falls back to `NGA_ADMIN_SECRET`): the answer (`in`/`interested`/`out`) is signed into the payload. All three render at equal weight (no dark patterns); with no signing secret the template degrades to a reply-with-a-word ask.
- **GET renders a confirm page, POST records** — a deliberate departure from lead-consent's record-on-GET: a poll answer allocates one of 8 paid spots and mail scanners prefetch every link, so a scanner walking the links must not cast a vote. Scanners follow links, not forms. Latest confirmed answer wins (the "changed my mind" path).
- **Recording** stamps the `Fall 2026 Poll` select (In / Interested / Out) on EVERY row the family owns (`recordFallPollResponse`, same all-rows rule as `quarantineLeadByEmail`). The property must exist on the Player CRM — Notion auto-creates select options, never properties.
- **The blast** — `POST /api/fall-poll-outreach?secret=$NGA_ADMIN_SECRET`, engine `src/lib/fall-poll-run.ts`, template `src/lib/email/fall-poll-invite.ts` (carries the parent-WhatsApp invite block). Body: `{ dryRun?, linksOnly?, subject?, only? }`. `linksOnly` returns each family's three signed links without sending (manual-send escape hatch; minting stays server-side). **No sent-flag column — a repeated live run re-sends; always `{"dryRun": true}` first.** Counts-only admin QA copy after live sends.
- Pinned by `e2e/fall-poll.spec.ts` (token action-binding, template copy incl. the real terms) + `e2e/invariant-fall-poll-egress.spec.ts` (Notion+Resend only, dryRun/linksOnly send nothing, lead-only/quarantined/unsubscribed never mailed, GET never writes, secret gate fails closed).

### Fall 2026 venue-change notice (`POST /api/fall-venue-change`)
The one-shot notice to families who had **already paid** when the season moved from Earle B. Wood MS to Walter Johnson HS (2026-08-27, 9 seats sold). `?secret=$NGA_ADMIN_SECRET`-gated, manual (no cron). Engine `src/lib/fall-venue-change-run.ts`, template `src/lib/email/fall-venue-change.ts`. Body: `{ dryRun?, only? }`.

- **Audience = the fall registrations DB** (`NOTION_FALL_REGS_DB_ID`), `Status = Confirmed` only — deliberately NOT `classifyLead`/quarantine-filtered: this is service mail to a current customer about a thing they bought, not marketing. The Confirmed filter is applied **both** in the Notion query and again client-side, so a drifted server-side filter can't mail a refunded family a "your player's spot is held" note. Rows fold per lowercased parent email, so a two-kid family gets one email.
- **The refund offer is the point, not a courtesy.** The season sells non-refundable, but the venue changed *after* purchase and not by the family's choice, so that term isn't ours to lean on (Sam's call, 2026-08-27). The offer renders in its own card as body copy — never as a footnote below the sign-off — with no deadline, fee, or eligibility test attached. `e2e/fall-venue-change.spec.ts` pins the position and the absence of those conditions.
- **Reads parent fields only.** The registration row carries child first name, birth year, allergies and emergency contact; the engine never reads them and the copy says "your player", never a name. So this adds **no new child-PII egress surface** — pinned by `e2e/invariant-fall-venue-change-egress.spec.ts`, whose fixtures deliberately carry child data so the "must not forward" assertions mean something.
- **Read-only.** The engine never writes to Notion (pinned) — a refund, if a family takes it, is a separate deliberate act through the existing cancel path, not a side effect of the notice.
- **No sent-flag column — a repeated live run RE-SENDS; always `{"dryRun": true}` first** (the body reports `scanned_rows`, `confirmed_rows` and the recipient list) and use `only` to retry a partial run.

### Enrichment Collective after-school clubs (`src/data/enrichment-collective.ts`)
Fall 2026 "Coach Sam" clubs that **Enrichment Collective** runs in MCPS schools — Mon Greenwood (Brookeville) / Tue Candlewood (Derwood) / Wed Rosemary Hills (Silver Spring) / Thu Belmont (Olney) / Fri Olney ES (Olney). Partner-run like MVF: EC owns registration and payment, carries the general liability insurance, and collects the waivers and media releases, so **the NGA waiver gate does not apply** and no NGA Stripe path is involved. Sam is a 1099 contractor to EC.

- **Deliberately absent from every public surface** — not in `/api/events/feed`, not on `/schedule`, not in the sitemap, no page. These clubs meet weekly at named elementary schools; publishing a precise recurring time and place where identified young children gather is the risk `camps.ts` mitigates by hiding `exactLocation`, except here the venue *is* the school. Pinned by `e2e/invariant-events-feed-egress.spec.ts`.
- **The only consumer is the Google Calendar mirror**, which reads this file directly and emits **town-only** blocks (never `schoolName`). This is the one sync source that isn't the feed or Supabase — safe because the file is hand-maintained with explicit ISO dates and nothing to derive.
- **Age floor exception.** NGA's 6–16 rule is unchanged and every NGA form still starts at 6. The Wednesday club (Rosemary Hills) is a PreK–2 school, so it carries `ageMin: 5` for EC's intro format — scoped to this file exactly as `MVF_AGE_MIN = 8` narrows in its own. Never propagate `ageMin: 5` to an NGA surface.
- **Schedule is CONFIRMED (Stef's PDF, updated revision 2026-08-13).** All five clubs run mid-Sept → mid/late Nov with real session dates already reconciled against the MCPS 2026–27 calendar — the gaps in each club's date list are closures, so a "missing" week is not an error. The PDF also swapped the Derwood and Silver Spring clubs' weekdays vs. the July hold and added the fifth Friday club; the updated revision publishes every club's time (Mon/Tue/Thu/Fri 3:30–4:30 PM, Wed 4:00–5:00 PM — dismissal + 5–10 min), so no EC calendar block ships all-day any more. **Post-PDF change (2026-08-16, Sam):** the Friday club moved from Sherwood ES (Sandy Spring, 4:00–5:00) to Olney ES (Olney), 3:30–4:30 PM — same session dates; the `sandy-spring-fri` key is kept so calendar blocks update in place.

### Curriculum override layer (`/coach/fall-playbook` + `NOTION_CURRICULUM_DB_ID`)
**Stage 1 of `docs/curriculum-editing-proposal.md` (read path only).** Lets Sam fix a
coaching cue from his phone on a Sunday without a PR and a deploy — without losing the
safety net that made PR #297 work (he rewrote the Red serve rule, `e2e/session-curriculum.spec.ts`
went red, and the change became deliberate instead of silent).

**It is an override layer, not a migration.** `src/data/session-curriculum.ts` and
`src/data/fall-season-plan-2026.ts` stay the tested source of truth for DEFAULTS and are
UNCHANGED; the Notion DB holds only overridden strings. Their specs import the data
modules directly, so an override can never turn them green-when-they-should-be-red.

- **`src/lib/curriculum-merge.ts` (pure)** — `mergeCurriculum(defaults, overrides)` over a
  field registry. **Clone-on-write, always**: Next.js module singletons live across
  requests, so writing into `BALL_RULES` in place would make an override permanent,
  un-revertable and visible to every other request until redeploy. Field ids reuse the
  Copy Desk scheme — `rule.<color>.<prop>`, `block.<order>.cue.<i>`, `block.<order>.<prop>`,
  `captain.{duty,never,script,kit}.<i>`, `week.<n>.<prop>` — entity segments by natural key
  (colour, `order`, `week`), array positions **0-based**. Structural fields (`order`,
  `color`, `week`, `date`, `focusBlock`, the games/ritual slugs, `vocabulary`) are
  deliberately NOT overridable: `rulesForColor`/`focusBlockFor`/`gamesFor`/`ritualFor` all
  throw on a miss, so keeping them out is how "a run sheet never renders blank" is
  guaranteed by construction. An empty `Value` is a REVERT, not a blanking.
- **`src/lib/notion-curriculum.ts`** — read, ISR 300 (same 5-min convention as
  `notion-sessions`), discriminated `status: "ok" | "config_missing" | "query_failed"`.
  Never throws. **No server-side `Active` filter on purpose** — Notion 400s a filter naming
  a property the DB lacks, which would turn a missing column into `query_failed` for the
  whole read; a missing `Active` property therefore means active, and only an explicitly
  unticked box suppresses a row.
- **The page render is fail-soft and SILENT; `/api/cron/curriculum-health` is the loud
  half** (daily `0 14 * * *`). `config_missing` is the deliberate ships-dark state and does
  **not** alert. `curriculum_overrides_query_failed` and `curriculum_override_unknown_field`
  do — the latter is the one that earns its keep, since a typo'd `rule.red.serv` would
  otherwise sit in Notion doing nothing all season while the copy silently never changed.
- **The ball-rules SVG parses the rule prose.** `BallRulesPanel` derives the serve dots,
  the kitchen band and the scoring label by regex over `serve`/`scoring`/`kitchen`/`court`,
  so it is fed the MERGED rules (picture and text must never disagree) and an override to
  those four props redraws the diagram. Keep the existing wording shape.
- An overridden string carries a small **`edited` marker, `print:hidden`** — visible to a
  coach on screen, absent from the volunteer's printed captain card.
- **Ships dark:** `NOTION_CURRICULUM_DB_ID` unset ⇒ zero network calls and the page renders
  the code defaults (verified: prerendered visible text byte-identical to `main`).
- **No write surface in Stage 1** and no child or parent data — curriculum is coach text,
  so this sits outside the minor-PII egress surface. Stage 2 (`/coach/curriculum` editor)
  and Stage 3 (export-back-to-git) are deliberately not built.
- Pinned by `e2e/curriculum-merge.spec.ts` (merge semantics on synthetic defaults) +
  `e2e/invariant-curriculum-failsoft.spec.ts` (no mutation of the data modules, ships dark,
  fail-soft on every Notion failure mode, Notion-only read-only egress, alert posture).

### Unified events feed (`GET /api/events/feed`) + Google Calendar mirror
`/api/sessions/feed` covers Notion sessions only; camps, MVF classes, and the Fall 2026 season live in `src/data/*.ts`, so anything wanting "every NGA date" had to re-read TypeScript source — which is how Sam's Google Calendar drifted out of sync after the 2026-07-21 weekend move. `GET /api/events/feed` (`src/lib/events-feed.ts`, `revalidate = 300`, CORS `*`) unions all four into one shape, each item carrying a stable `key` (`nga-sess|nga-camp|mvf|nga-fall:<slug>:<date>`) that maps 1:1 onto a calendar block.

- **Sessions roll up to one venue-evening block.** Notion stores a row per ball color; four colors on one evening is one thing a human attends. The item spans the earliest start to the latest end.
- **Unpublished times ship all-day, never invented.** An event whose hour isn't published emits `allDay: true` with `(time TBD)` in the title. MVF classes no longer use that path (MVF published every Fall 2026 time when enrollment opened 2026-08-07), but the rule stands for any source that adds one — add the time to the data file and the next sync converts it in place.
- **MVF venues are per-program.** `MvfProgram.venue` is on each row because MVF moves the sessions: the Aug 27 intro is at Apple Ridge, Fall I at Watkins Mill, Fall II at North Creek. There is no single MVF venue constant.
- **Fall 2026 Sundays are confirmed items** (Green 1:00–2:30 PM + Yellow 2:30–4:00 PM = one 1–4 PM block per Sunday); only the two `FALL_RAIN_DATES` holds ship `tentative: true`.
- **Deliberately absent:** the MVF tournament (an L&D event owned by the `ld:` key namespace — emitting it here too would double-create it downstream) and `LEAGUE_SEASONS` (start/end dates only, no per-session dates, no times, unbooked venue).
- **Egress rules** — public and unauthenticated: camps emit `publicArea` NEVER `exactLocation`, sessions go through `publicLocation()`, no roster/ageStats, and no `registeredCount` at all. Pinned by `e2e/invariant-events-feed-egress.spec.ts`.
- **A Notion outage is not "zero sessions".** The route catches, still serves the file-backed half, and sets `_meta.sessionsUnavailable` so a downstream mirror doesn't delete every session event on a blip.

The calendar sync itself is **agent-side, not an API integration** (a Google Calendar API client would mean OAuth/service-account credentials and a refresh-token store in production for a mirror one person reads — `docs/admin-reduction-roadmap.md` deferred it for the same reason). The canonical algorithm — key convention, legacy-key adoption, reconcile loop, 20%-deletion cap, "never touch an unmarked event" — lives in **community-os `.claude/skills/calendar-sync/SKILL.md`** (invoke `/calendar-sync`), because half the events are Link & Dink; `skills/calendar-sync.md` here is the NGA side of the contract and community-os `docs/CALENDAR_SYNC.md` is the L&D side. A daily Routine runs it against `sam.morris2131@gmail.com`; run it on demand after editing any schedule.

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

The cron's ONLY write to the drafts DB is `stampDraftsSentAt` — it stamps `Sent At` on each row that shipped (PR #234). It never writes `Status` and never re-dates a row; `e2e/invariant-coach-inbox-authz.spec.ts` pins that the route source never mentions `setDraftStatus`. Every Approved row in the window ships (concatenated oldest-first) — so an operational announcement row and the Wednesday drafter row can both be Approved without one shadowing the other. To run ONLY one of them, leave the other Pending or flip it to Skip.

**A row that stops shipping is no longer silent (2026-08-05).** The 7-day `Drafted At` window is still the freshness guard, and a stale Approved row is still excluded — but that exclusion used to be invisible. The row "Weekend move + back-to-school camp (Aug 2026)" (`Drafted At` 2026-07-22) shipped once on 07-23, fell one day outside the 07-30 cutoff, and vanished from every issue after that while still reading `Approved`; nobody knew for two weeks. `fetchApprovedNewsletterDrafts()` now returns a `NewsletterDraftsResult` (drafts + `status` + `unreadablePageIds` + `strandedPageIds`) instead of a bare array, because five different outcomes used to collapse into `[]` and all reported `ok: true`. The cron turns each into a `withCronAlert` signature: `config_missing`, `newsletter_drafts_query_failed`, `newsletter_draft_unreadable` (a row that passed the filter but whose body wouldn't render — the lead block ships SHORT, not empty), and `approved_draft_did_not_ship`.

**`Expires At` is the intent marker for the stranded detector.** Rows stay Approved forever after a send, so "Status = Approved" describes the whole archive and can't distinguish "shipped, done" from "still meant to ship" — only an operator-set `Expires At` can. `buildStrandedDraftsQueryFilter` flags Approved + `Drafted At` before cutoff + `Expires At` set + `Expires At` not yet passed. Ordinary rows (no `Expires At`) never match, so a healthy week alerts about nothing, and a flagged row self-clears when it expires. **This is detection only — it does not change what ships**; `buildDraftsQueryFilter` is untouched and `Expires At` remains a narrowing leg. Consequence for operators: **anything that must ship for more than one week needs an `Expires At`**, or the detector cannot see it. To ship a stranded row, bump its `Drafted At` (setting `Expires At` alone will NOT bring it back); to silence it, flip Status to Skip. Alert bodies carry Notion page IDs only — never the `Week` title, which is free text. Pinned by `e2e/invariant-weekly-newsletter-drafts-visibility.spec.ts`.

**Durable content should not live here at all.** The drafts DB is for one-shot editorial. Anything with a multi-week shelf life belongs in a data-derived block — PR #265 moved camps to one sourced from `camps.ts` precisely so an upcoming camp can't fall off the issue. Reach for a derived block first; use an Approved row plus `Expires At` only when the content is genuinely one-off.
- **`GET /api/cron/scrape-news`** — schedule `0 11 * * *` UTC (= ~6am ET in EST / 7am EDT). Pulls youth-pickleball news candidates from Google News RSS (6 youth-targeted queries), USA Pickleball + PPA RSS feeds, and Reddit (r/Pickleball + r/youthsports `top.json?t=week`). Each candidate must mention both a pickleball term and a youth-context term (`youth`, `junior`, `kid`, `school`, `academy`, `camp`, `coach`, `clinic`, etc.); see `matchYouthPickleball()` in `src/lib/news-scraper.ts`. Dedup is by canonical URL (UTM/tracking params stripped, Google News redirector unwrapped via `canonicalizeUrl()`). New URLs land in the **NGA Youth Pickleball News DB** (`NOTION_NEWS_DB_ID`) with `Status = New` for Sam to triage to `Approved` (ships in the next Thursday newsletter), `Rejected` (filtered out next time it's seen), or left to age out. Skipped silently if the env var is missing — endpoint still runs as a dry-run reporting candidates count. Pure parsing helpers (URL canonicalization, keyword filter, dedup) are unit-tested in `e2e/news-scraper.spec.ts`.
- **`GET /api/cron/seed-tuesday-sessions`** — schedule `0 8 * * 1` UTC (Mon ~3–4am ET). Keeps **all four recurring weekly evenings** stocked (the path keeps its historical Tuesday name so the vercel.json entry and dashboards stay stable): for each ACTIVE template in `src/data/recurring-templates.ts` (Ridgeview Mon / Redland Tue / Westland Wed / Shannon Thu — Shannon Green/Yellow only, the rest all four levels; every evening 6:30–7:30 PM per MCPS permit #684275), ensures each of the next `WEEKS_AHEAD` (8) occurrences of its weekday has one row per level — a court each. Seeded dates are strictly FUTURE (min 1-day lead — a Monday run never seeds that same Monday). **Idempotent per template family** (a row whose title matches the template's titleBase or any `legacyTitlePrefixes` counts as present for its date+level, whatever its Status — a deliberately-cancelled evening/level is never resurrected, and a row hand-moved onto another evening's date can't suppress that evening's seed) and **fail-soft per row**, with a ~350ms Notion create throttle + one 429 retry. Misconfiguration alerts instead of no-opping green: missing `NOTION_API_KEY`/`NOTION_SESSIONS_DB_ID` → `config_missing`, an invalid template → `config_invalid`, an existing seeded row whose start time drifted from its template → one rolled-up `time_drift` entry (signal only — live rows are never auto-corrected). `?dryRun=1|true|yes` returns the would-create list with zero writes (any other value → 400, never a silent live run) — run it against prod before trusting a new template. Logic in `src/lib/recurring-sessions.ts` (`ensureWeeklyTemplates`; pure helpers `upcomingWeekday`, `buildTemplateRowProps`, `validateTemplate`, `parseDryRunParam` unit-tested in `e2e/recurring-sessions.spec.ts`). **The edit surface for venues/times/levels/active is `src/data/recurring-templates.ts`** — session locations are public (the hidden-location/reveal-cron system was retired 2026-06-05).


- **`GET /api/cron/curriculum-health`** — schedule `0 14 * * *` UTC (10am ET). The loud half
  of the curriculum override layer: re-runs the same override read + merge the playbook
  does and alerts on what a coach cannot see from the page — `curriculum_overrides_query_failed`
  (edits silently reverted to code defaults) and `curriculum_override_unknown_field` (a
  Field ID that resolves to nothing, so that edit never landed). An unset
  `NOTION_CURRICULUM_DB_ID` reports `dark: true` and alerts about NOTHING — shipping dark is
  the intended state, not a failure. No parent/child data.

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
- **Min tap target 48×48px** (WCAG 2.5.5). Primary CTAs ("Book a Free Evaluation", "Register") belong in the bottom thumb zone — there's a fixed `StickyMobileCTA` for mobile.
- **Schema.org JSON-LD** is required: `SportsActivityLocation` in the root layout, `FAQPage` + `Person` (per coach) on the home page, one `SportsEvent` per upcoming session on `/schedule`. Use the `<JsonLd />` component.
- **All program dates use `<time datetime="YYYY-MM-DD">`** and prices use `itemprop="price" content="N"` (numeric, no `$`). This is for AI/scheduler parsing — see BRAND_GUIDELINES "AI-PARSING OPTIMIZATION".
- **Yellow Ball is invite-only.** No public registration link, no `mailto:` CTAs — route all interest to `/yellowball/inquiry`. `verify-funnel.mjs` enforces this.
- **No third-party pixels.** GA4, Meta Pixel, `@vercel/analytics`, `gtag`, `fbq` are explicitly banned — `verify-funnel.mjs` greps for them.
- **A lead-capture row never dies for its attribution.** Every funnel write stamps a `Source` select from `attributedSource()`, and a Notion DB whose schema lacks that property 400s the WHOLE create — twice now a real family was lost this way (2026-06-13 drop-ins, 2026-08-25 waitlist). Create funnel rows through `createNotionPageSourceFailSoft()` (`src/lib/notion-utils.ts`), which retries once without `Source` and reports that it did; only a Source-named rejection is retried, so a genuinely broken write still surfaces. Adopted by `/api/waitlist` + `notion-dropins`; `/api/{contact,lead,schools-lead}` still POST raw (their DBs do have the property) — move them over when next editing.
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
- `NOTION_NEWSLETTER_DRAFTS_DB_ID` — NGA Newsletter Drafts DB (Coach-voice longform sections drafted Wednesday by the cloud drafter routine; Sam approves a row before Thu 6pm for the cron to inject as the "From Coach Sam" lead block). The weekly newsletter still ships without it (the lead block just hides), but as of 2026-08-05 an unset value raises a `config_missing` cron alert rather than no-opping green — a lead block that can never ship is a misconfiguration, not a preference. See the "Newsletter lead block — drafter pipeline" section above.
- `NOTION_CURRICULUM_DB_ID` — NGA Curriculum Overrides DB (one row per overridden
  curriculum string, read by `/coach/fall-playbook`). Optional. **UNSET = the override
  layer is dark** and the playbook renders the code defaults with no network call —
  reported as dark by the health cron, never as a misconfiguration (deliberately unlike
  `NOTION_NEWSLETTER_DRAFTS_DB_ID`, whose lead block is meant to ship). See the
  "Curriculum override layer" section above.
- `REFERRAL_TOKEN_SECRET` — HMAC signing key for `/newsletter?ref=<token>` links. Optional — falls back to `NGA_ADMIN_SECRET`. Distinct from `NEWSLETTER_UNSUB_SECRET` so a leaked unsub token can't be replayed as a referral and vice versa.
- `LEAD_CONSENT_SECRET` — HMAC signing key for the permission-pass links (`GET /api/lead-consent`). Optional — falls back to `NGA_ADMIN_SECRET`. Distinct from `NEWSLETTER_UNSUB_SECRET` / `REFERRAL_TOKEN_SECRET` so tokens can't be replayed across families. UNSET = camp-outreach degrades to the reply-"skip" opt-out instead of one-click links.
- `OPEN_BRAIN_INGEST_URL` + `LEAD_INGEST_TOKEN` — Open Brain ingest.
- `LEAD_ENRICH_SECRET` — Bearer secret for the email → CRM enrichment surface (`POST /api/lead-enrich`). Lets the mail-scan routine append what a parent told us over email onto their Player CRM row, through the same writer the lead form uses. Distinct from `NGA_ADMIN_SECRET` to isolate blast radius. Unset = the route fails closed (401) and the surface ships dark.
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
