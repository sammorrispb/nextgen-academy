# NGA Source Inventory

> Audited at `a591bbd` (origin/main, 2026-06-12). Counts derived at audit time from `git ls-tree` — re-derive, never trust these as constants. Companion docs: `docs/hostile-reviewer.md`, `agent-log.md`, CLAUDE.md § Minor-data governance.

**Totals @ a591bbd:** 41 pages · 40 route.ts (36 under /api + 4 auth-session) · 8 crons · 96 lib files (74 top-level + 22 email/) · 49 e2e specs (41 pure / 7 browser / 1 live smoke) · 47 components.

**Stack reality:** Next.js (Vercel) + Stripe + **Notion as the only database** (no Supabase, no SQL). Auth = signed session cookies (coach/admin, magic-link issued) + HMAC tokens for one-shot parent/coach actions. Email = Resend; SMS = Twilio.

## Classification definitions

- **MOUSE-CATCHER** — wired to money or production traffic: Stripe checkout/webhook, Notion roster writes, scheduled sends to real recipients.
- **SHOW PONY** — static/lead-form surfaces with no money or PII-write wiring. Zero test investment.
- **PROTOTYPE** — deliberately dark or staged (e.g., league ships 503 until its price env exists).

## 1. Pages (41)

| path | type | last-commit | purpose | conf |
|---|---|---|---|---|
| src/app/page.tsx | page | 2026-06-10 | homepage — hero, levels, upcoming sessions, lead capture | high |
| src/app/youth-pickleball-{bethesda,gaithersburg,germantown,north-bethesda,olney,potomac,rockville,silver-spring}/page.tsx | page ×8 | 2026-05-24 | SEO city landing pages, one shared CityLanding template | high |
| src/app/montgomery-county-youth-pickleball/page.tsx | page | 2026-06-06 | county-level SEO pillar page | high |
| src/app/schedule/page.tsx | page | 2026-06-10 | public drop-in schedule (Notion-fed) | high |
| src/app/schedule/[slug]/page.tsx | page | 2026-06-11 | per-session detail + registration (deep-linked from emails — KEEP) | high |
| src/app/schedule/success/page.tsx | page | 2026-06-11 | post-checkout confirmation | high |
| src/app/schedule/cancel/page.tsx | page | 2026-05-19 | token-gated self-serve cancellation | high |
| src/app/camp/page.tsx + [slug] + success | page ×3 | 2026-06-03 | summer camp listing, detail, confirmation | high |
| src/app/clusters/page.tsx + [area] | page ×2 | 2026-06-09 | area-cluster program landing + per-area checkout | high |
| src/app/league/page.tsx + success | page ×2 | 2026-06-08 | youth league landing (ships dark sans price env) | high |
| src/app/crew/page.tsx | page | 2026-06-09 | NGA Crew interest capture | high |
| src/app/commit/[token]/page.tsx + success | page ×2 | 2026-05-30 | token-verified crew commitment + card-on-file checkout | high |
| src/app/poll/[slug]/page.tsx | page | 2026-05-24 | public crew scheduling-poll vote | high |
| src/app/free-evaluation/page.tsx | page | 2026-05-30 | free eval funnel entry | high |
| src/app/newsletter/page.tsx | page | 2026-05-24 | newsletter signup | high |
| src/app/schools/page.tsx | page | 2026-05-24 | school-program lead capture | high |
| src/app/waiver/page.tsx | page | 2026-06-27 | static waiver text (renders src/data/waiver.ts) + sign CTA | low |
| src/app/waiver/sign/page.tsx | page | 2026-06-27 | one-time waiver e-sign page | med |
| src/app/api/waiver-sign/route.ts | route | 2026-06-27 | writes signed waiver → Notion + emails parent copy (parent-scoped, no child PII) | high |
| src/lib/notion-waivers.ts | lib | 2026-06-27 | NGA Waivers DB read/write + hasWaiverOnFile gate read | high |
| src/lib/waiver-gate.ts | lib | 2026-06-27 | standardizes the pre-checkout waiver 409 contract | med |
| src/app/yellowball/inquiry/page.tsx | page | 2026-05-30 | Yellow Ball tournament-track inquiry (invite-only, 12+, 3.0+) | high |
| src/app/admin/login/page.tsx | page | 2026-06-11 | admin magic-link login | high |
| src/app/admin/(authed)/sessions/page.tsx | page | 2026-06-09 | admin sessions editor — writes Notion Sessions DB | high |
| src/app/coach/login/page.tsx | page | 2026-05-12 | coach magic-link login | high |
| src/app/coach/(authed)/page.tsx | page | 2026-06-07 | coach dashboard — upcoming sessions | high |
| src/app/coach/(authed)/[slug]/page.tsx | page | 2026-06-07 | per-session roster, attendance, cancel (child PII) | high |
| src/app/coach/(authed)/eval/page.tsx | page | 2026-06-05 | coach eval confirm/send form | high |
| src/app/coach/(authed)/players/page.tsx + [key] | page ×2 | 2026-05-21 | player CRM list + profile (child PII) | high |
| src/app/coach/(authed)/polls/page.tsx + [slug] | page ×2 | 2026-05-25 | crew poll admin + results | high |
| src/app/coach/cancel-session/[token]/page.tsx | page | 2026-05-21 | token-gated coach session cancel | high |

Non-page app files: layout.tsx, opengraph-image.tsx, robots.ts, sitemap.ts, globals.css, design.theme.css.

## 2. API routes (40 route.ts)

| path | type | last-commit | purpose | conf |
|---|---|---|---|---|
| src/app/api/stripe/webhook/route.ts | webhook | 2026-06-12 | STRIPE sig-verified; Notion writes, email+SMS, referral rewards, ISR revalidate | high |
| src/app/api/checkout/route.ts | api | 2026-06-12 | STRIPE drop-in checkout; Notion capacity check; 30-day window | high |
| src/app/api/checkout-camp/route.ts | api | 2026-06-03 | STRIPE camp checkout; 503 ship-dark if price env missing | high |
| src/app/api/checkout-league/route.ts | api | 2026-06-08 | STRIPE league checkout; 503 ship-dark | high |
| src/app/api/checkout-cluster/route.ts | api | 2026-06-10 | STRIPE cluster season checkout; Notion roster | high |
| src/app/api/commit/start-checkout/route.ts | api | 2026-05-30 | STRIPE setup-intent for crew card-on-file | high |
| src/app/api/commit/confirm/route.ts | api | 2026-05-25 | STRIPE+Notion+email crew commit confirmation | high |
| src/app/api/cancel-registration/route.ts | api | 2026-05-19 | refund+deregister drop-in; NGA_ADMIN_SECRET or cancel-token | high |
| src/app/api/coach/attendance/route.ts | api | 2026-06-14 | agent attendance check-in (Notion + OB activity + profile recompute via applyAttendance); Bearer ATTENDANCE_SECRET, fail-closed, idempotent, PII-free ack | high |
| src/app/api/cancel-camp-registration/route.ts | api | 2026-06-04 | STRIPE camp refund; NGA_ADMIN_SECRET gated | high |
| src/app/api/lead/route.ts | api | 2026-06-12 | NOTION lead write + EMAIL welcome + OB ingest | high |
| src/app/api/contact/route.ts | api | 2026-05-23 | NOTION + EMAIL contact form | high |
| src/app/api/newsletter/route.ts + unsubscribe | api ×2 | 2026-05-21→25 | NOTION subscriber + welcome; token-verified unsubscribe | high |
| src/app/api/waitlist/route.ts | api | 2026-06-12 | NOTION waitlist + EMAIL + OB ingest | high |
| src/app/api/crew-interest/route.ts | api | 2026-06-09 | NOTION + EMAIL; forwards to L&D cohort pool | high |
| src/app/api/crew-poll/vote/route.ts | api | 2026-05-24 | NOTION poll vote + EMAIL confirmation | high |
| src/app/api/league-interest/route.ts | api | 2026-06-08 | NOTION + EMAIL league interest | high |
| src/app/api/schools-lead/route.ts | api | 2026-05-17 | NOTION + EMAIL schools lead | high |
| src/app/api/yellowball-lead/route.ts | api | 2026-05-26 | NOTION player lookup + EMAIL inquiry | high |
| src/app/api/eval-confirmation/route.ts | api | 2026-06-05 | EMAIL eval confirmation; NGA_ADMIN_SECRET gated | high |
| src/app/api/eval-reengagement/route.ts | api | 2026-05-22 | NOTION+EMAIL stale-eval re-engagement; NGA_ADMIN_SECRET; DD-lead off-limits filter | high |
| src/app/api/post-eval-followup/route.ts | api | 2026-06-05 | NOTION+EMAIL post-eval follow-up; NGA_ADMIN_SECRET | high |
| src/app/api/notion-session-webhook/route.ts | webhook | 2026-05-12 | Notion automation → waitlist email blast; ⚠ query-param secret fallback, plain compare | high |
| src/app/api/analytics/route.ts | api | 2026-05-04 | unauthenticated proxy → Open Brain analytics; always 204 | high |
| src/app/api/admin/request-link/route.ts | api | 2026-06-11 | EMAIL admin magic link (allowlist) | high |
| src/app/api/admin/sessions/route.ts + registrants | api ×2 | 2026-06-11→12 | NOTION sessions CRUD + registrant roster read (child PII); admin-session gated | high |
| src/app/api/coach/request-link/route.ts | api | 2026-05-25 | EMAIL coach magic link (allowlist) | high |
| src/app/api/cron/* (8 — see §5) | cron ×8 | 2026-05-25→06-11 | see cron table | high |
| src/app/admin/auth/verify + logout, src/app/coach/auth/verify + logout | auth ×4 | 2026-05-12→06-11 | magic-link verify → session cookie; logout | high |

## 3. Lib modules (96)

**Auth/token libs (SLOP-FREE):**

| path | last-commit | purpose | conf |
|---|---|---|---|
| src/lib/admin-auth.ts | 2026-06-11 | admin session cookie, timingSafeEqual | high |
| src/lib/admin-allowlist.ts | 2026-06-11 | admin email allowlist | high |
| src/lib/coach-auth.ts | 2026-05-12 | coach session cookie, timingSafeEqual | high |
| src/lib/coach-allowlist.ts | 2026-05-21 | coach email allowlist | high |
| src/lib/cancel-token.ts | 2026-05-19 | HMAC cancel token — keyed on NGA_ADMIN_SECRET | high |
| src/lib/commit-token.ts | 2026-05-30 | HMAC crew-commit token — keyed on NGA_ADMIN_SECRET | high |
| src/lib/newsletter-token.ts | 2026-05-21 | HMAC unsubscribe token — keyed on NGA_ADMIN_SECRET | high |
| src/lib/referral-token.ts | 2026-05-25 | HMAC referral token — keyed on NGA_ADMIN_SECRET | high |
| src/lib/session-cancel-token.ts | 2026-05-21 | HMAC coach cancel token — keyed on NGA_ADMIN_SECRET | high |

**Child-PII libs (SLOP-FREE):**

| path | last-commit | purpose | conf |
|---|---|---|---|
| src/lib/notion-player-sync.ts | 2026-06-04 | upserts kid rows into Notion Player CRM | high |
| src/lib/notion-player-lookup.ts | 2026-05-26 | player CRM lookup by parent/child | high |
| src/lib/notion-player-bracket.ts | 2026-07-19 | coach-assignable skill bracket = Player CRM Level (R/O/G/Y): read by parent (profile) + full scan (directory filter) + `setPlayerLevel` write. Write touches ONLY the Level select; egress Notion-only (pinned by `invariant-player-bracket-egress.spec.ts`) | high |
| src/lib/player-profiles.ts | 2026-07-19 | coach-portal player profile + directory assembly; overlays Player CRM brackets; `toSearchIndex` = coach-scoped parent+child-NAMES-only projection for top-nav search | high |
| src/app/api/coach/family-search/route.ts | 2026-07-19 | coach-cookie-gated family search index (parent + child names + key only); fails closed → 401 + zero egress without coach auth (pinned by `invariant-coach-family-search-authz.spec.ts`) | high |
| src/lib/notion-dropins.ts | 2026-06-12 | drop-in registration rows (child name, parent contact) | high |
| src/lib/notion-eval.ts | 2026-06-05 | eval records | high |
| src/lib/registrant-match.ts | 2026-06-12 | match registrants to player profiles | high |
| src/lib/roster-mailto.ts | 2026-06-12 | email-all-parents mailto from roster | high |
| src/lib/attendance.ts | 2026-06-14 | shared check-in core (Notion write + OB activity + profile recompute); reused by the coach action + /api/coach/attendance; idempotent | high |
| src/lib/notion-camp-roster.ts | 2026-06-26 | camp roster read-model from Stripe + Friday reminder sync; reads child first name + birth year + **allergies/medical + emergency contact** (camp-safety exception, CLAUDE.md); surfaced auth-gated at /coach/camps/* (print-only, no file export) | high |

**Buckets (remaining):**

| bucket | last-commit | purpose | conf |
|---|---|---|---|
| src/lib/notion-* (11 more) | 2026-06-10 | Notion DB clients, one per database | high |
| src/lib/email/ (22) | 2026-06-11 | Resend HTML templates + brand/ics/utm helpers | high |
| src/lib/validate-* (11) | 2026-06-12 | per-form input validation | high |
| payments: stripe, refund-amount, cancel-camp, cancel-dropin, cluster-refund | 2026-06-10 | Stripe client, refund math, cancel flows (SLOP-FREE) | high |
| funnel: attribution, funnelClient, lead-segmentation, open-brain-ingest | 2026-06-12 | UTM attribution, OB ingest, DD-lead off-limits classifier | high |
| sessions: session-slug/time/location/cancel, schedule-grouping, recurring-sessions, fill-meter, weather, venue-lookup | 2026-06-11 | session slug/time/venue/grouping/seeding/weather | high |
| misc: seo, sports-event-jsonld, urls, schools, clusters, cluster-age, level-colors, news-scraper, newsletter-tips, eval-shared, eval-confirmation-send, forward-to-cohort-pool, referral-rewards, sms | 2026-06-12 | SEO/JSON-LD, schools data, news scraper, SMS (Twilio), referrals | med |

## 4. Components / tests / scripts / docs

| path | last-commit | purpose | conf |
|---|---|---|---|
| src/components/ (47) | 2026-06-12 | forms, cards, CTAs, JSON-LD, trackers | high |
| src/data/ (17) | 2026-06-10 | camps, clusters, coaches, schools, levels, SEO, site config | high |
| e2e/ (49 specs: 41 pure / 7 browser / 1 live smoke) | 2026-06-12 | CI runs test:pure only; browser local-only | high |
| scripts/backfill-dropin.mjs | 2026-05-29 | backfill missed paid drop-in Notion row | high |
| scripts/backfill-players-from-dropins.mjs | 2026-05-31 | backfill Player CRM from paid drop-ins | high |
| scripts/discount-checkout.mjs | 2026-05-29 | one-shot couponed Stripe Payment Link | high |
| scripts/refund-camp.mjs | 2026-06-04 | refund + deregister camp registration | high |
| scripts/setup-camp-stripe.mjs | 2026-06-03 | provision camp Stripe products (NGA acct_1TU4iS…) | high |
| scripts/setup-stripe-product.mjs | 2026-05-05 | ⚠ references OLD Stripe acct_1SOoW5… — likely stale pre-migration (risk log #7) | med |
| scripts/smoke-test-schedule.mjs | 2026-05-06 | live drop-in smoke, stops pre-payment | high |
| scripts/verify-funnel.mjs | 2026-06-08 | sanity-check unified funnel wiring | high |
| root configs (package.json, next.config, vercel.json, tsconfigs, playwright ×2, ci.yml, .env.example) | 2026-06-10 | — | high |
| BRAND_GUIDELINES.md / CLAUDE.md / DESIGN.md / README.md / seo-backlog.md | 2026-06-09 | — | high |
| docs/ops/ (3: README, Session_Cadence_Playbook, cadence_config.json) | 2026-05-30 | 3-2-0 cadence ops | high |
| docs/social/ (2) | 2026-06-07 | caption + YouTube templates | high |
| docs/youth-pickleball-league-* (3) | 2026-06-08 | league blueprint/spec/readiness | high |

## 5. Crons (8, vercel.json — all CRON_SECRET Bearer, fail-closed 500 when env unset, 401 on mismatch)

| path | schedule (UTC) | what it does |
|---|---|---|
| /api/cron/dropin-reminder | 0 17 * * * | next-day reminder email + SMS with cancel link |
| /api/cron/dropin-post-session | 0 13 * * * | post-session thanks + rebook emails |
| /api/cron/coach-pre-event | 0 * * * * | coach prep email: roster, weather, cancel token |
| /api/cron/mark-passed-sessions | 0 * * * * | mark past Notion sessions Passed |
| /api/cron/weekly-newsletter | 0 22 * * 4 | Thursday parent newsletter from Notion content loop |
| /api/cron/crew-autoreserve | 0 12 * * * | **charges saved cards off-session** + registers crew kids |
| /api/cron/scrape-news | 0 11 * * * | scrapes youth-PB news → Notion News DB (consumed by weekly-newsletter — KEEP) |
| /api/cron/seed-tuesday-sessions | 0 8 * * 1 | seeds Tuesday sessions 8 weeks ahead |

## 6. Classification

| surface | class | evidence |
|---|---|---|
| drop-in funnel (/schedule, checkout, webhook, dropin crons, cancel) | MOUSE-CATCHER | Stripe checkout + webhook → Notion roster + Player CRM + email/SMS |
| camps | MOUSE-CATCHER | live Stripe products, booked courts, refund tooling |
| crew/commit/poll/autoreserve | MOUSE-CATCHER | off-session Stripe charges daily at noon |
| weekly newsletter + news scraper | MOUSE-CATCHER | real Thursday sends; Notion approval loop active |
| coach portal + admin portal | MOUSE-CATCHER (internal) | only authed child-data readers; active through 06-12 |
| clusters | PROTOTYPE→MOUSE-CATCHER | pilot live 06-11; staged rollout |
| league | PROTOTYPE | ships dark by design (503 until price env) |
| SEO city pages, schools, yellowball | SHOW PONY | static/lead-form only |
| one-time waiver (sign flow + pre-checkout gate) | HARDENED | invariant-tested gate + egress; parent-scoped, fail-open-on-unconfigured |
| api/analytics, open-brain-ingest | DOWNGRADE (best-effort) | telemetry; must never block payments |

## 7. SLOP-FREE ZONE (no edits without separate explicit approval; tests observe, never modify)

- `src/app/api/stripe/webhook/route.ts` + all `api/checkout*` + `api/commit/*` + `api/cancel-*` + `src/lib/{stripe,refund-amount,cancel-camp,cancel-dropin,cluster-refund}.ts`
- All 9 auth/token libs in §3 + the 4 auth-session routes + admin/coach allowlists
- All 7 child-PII libs in §3 + `api/admin/sessions/registrants` + coach roster/player pages + eval routes
- `src/lib/attendance.ts` + `src/app/api/coach/attendance/route.ts` (check-in core + agent route — minor-PII write + OB egress)
- `api/cron/crew-autoreserve` (off-session charges)

## 8. Risk log

1. **NGA_ADMIN_SECRET blast radius — SPLIT (2026-06-12, Sam-approved).** Token families now sign with dedicated secrets (`CANCEL_TOKEN_SECRET`, `SESSION_CANCEL_TOKEN_SECRET`, `COMMIT_TOKEN_SECRET` — all optional, legacy fallback) with dual-verify so outstanding parent links keep working. NGA_ADMIN_SECRET remains the bearer for the 5 admin routes only. Residual: until Sam sets the new env vars in Vercel, signing still uses the legacy key; legacy-era links die only when NGA_ADMIN_SECRET rotates. Pinned by `e2e/invariant-secret-separation.spec.ts`.
2. **notion-session-webhook**: compare is now timing-safe via `secretEquals` (2026-06-12). The `?secret=` query-param fallback REMAINS by design (Notion's webhook action can't set custom headers on some plans; exposure = server-side access logs, documented in-route).
3. **Plain `!==` secret compares — FIXED (2026-06-12, Sam-approved).** All 14 route-gate compares (5 admin routes, notion-session-webhook, 8 crons) now use `src/lib/secret-compare.ts` `secretEquals` (constant-time, fail-closed on missing/empty).
4. **crew-autoreserve** charges saved cards off-session daily — highest-blast-radius cron; CRON_SECRET only.
5. **/api/analytics** unauthenticated open POST proxy (always 204, no rate limit) — spam vector, fail-open by design; must never gain PII.
6. **Ship-dark 503 fail mode** (camp/league checkout): fail-closed for money, but a dropped price env = silent revenue-off with a polite message, no alerting.
7. **scripts/setup-stripe-product.mjs** references old Stripe acct `acct_1SOoW5…` (NGA live = `acct_1TU4iS…`) — stale; deletion candidate.
8. **Child PII flow**: child name/birth-year ride Stripe metadata → webhook → Notion + admin email. Same Notion row holds parent contact + child fields (no separate child record). Any new egress destination is a hostile-review trigger.
9. **`/api/coach/attendance` auth authority (2026-06-14, hardened).** The agent route grants attendance-write to any holder of `ATTENDANCE_SECRET`, which does NOT enforce the `COACH_ALLOWED_EMAILS` allowlist the coach UI action does — a broader authority on a minor-PII write. Hardened over the original #189 form (which used NGA_ADMIN_SECRET in a `?secret=` query param): now a **dedicated** secret over a **Bearer header** (no access-log exposure, isolated blast radius), fail-closed when unset, idempotent (no duplicate OB activity on retries), OB ingest awaited for Vercel durability, PII-free ack. Egress pinned to Notion + OB by `e2e/invariant-attendance-pii-egress.spec.ts`. Residual: until `ATTENDANCE_SECRET` is set in Vercel the route 401s every call (safe default).
10. **Camp roster surfaces allergies + emergency contact (2026-06-26, Sam-approved camp-safety exception).** The coach camp-roster view (`/coach/camps/*`) displays already-collected child medical (allergies) + emergency contact, read live from Stripe (NOT newly persisted), behind the coach `(authed)` gate. **Print-only — no CSV/file export in v1** (a file export would be a child-medical egress to a device that the fetch-host invariant class cannot pin; deferred deliberately). The read path makes zero outbound fetches (Stripe rides its own SDK transport); pinned by `e2e/invariant-camp-roster-pii-egress.spec.ts` (no OB/Resend/analytics host, no PII sentinel in any fetch body) and `e2e/notion-camp-roster.spec.ts`. Allergies are capped at 480 chars upstream; the roster flags possible truncation ("verify with parent"). Governance exception documented in CLAUDE.md Minor-Data Governance. Residual: a coach printing the roster takes child medical onto paper (same as the prior external packet) — operational control, not a code control.

## 8a. Agent-action trigger parity — deferred surfaces (per-surface IPAV go required)

Principle: an operational UI action with a multi-trigger fan-out must expose a single shared,
auth-gated, agent-callable core so an out-of-band caller gets trigger parity instead of dropping
side-effects by writing the datastore directly. Attendance shipped this pattern (#189 + hardened
in #191): `src/lib/attendance.ts` (`applyAttendance`) + `src/app/api/coach/attendance/route.ts`
(Bearer `ATTENDANCE_SECRET`, fail-closed, idempotent, PII-free ack, OB awaited on the route).
Each awaiting its own go:

1. **`confirmCrewAction`** (`src/app/coach/(authed)/polls/[slug]/actions.ts`) — ✅ SHIPPED (this PR).
   Core extracted to `src/lib/crew-confirm.ts` (`confirmCrew`, idempotency guard on already-
   Confirmed/Cancelled) + Bearer `POST /api/coach/crew-confirm` (dedicated `CREW_CONFIRM_SECRET`,
   fail-closed, PII-free ack). Action thinned to an auth+revalidate wrapper. No OB ingest (the UI
   path doesn't ingest — parity, not scope creep). Invariants: `invariant-crew-confirm-trigger-
   parity` + `invariant-crew-confirm-pii-egress`.
2. **Stripe webhook camp/league branches** (`src/app/api/stripe/webhook/route.ts`) — ✅ SHIPPED.
   Shared processed-events ledger `src/lib/notion-processed-events.ts` (`findProcessedEvent` +
   `recordProcessedEvent`, mirrors `notion-clusters.ts`) keyed on the checkout-session id; both
   handlers guard on it before `after()` (transient write → 500 so Stripe redelivers; permanent /
   env-unset → proceed so a paid family is never stranded). Fail-soft until
   `NOTION_PROCESSED_EVENTS_DB_ID` is set (inert = today's behavior). Invariant:
   `invariant-webhook-camp-league-idempotency`.

Ready-to-run prompt for this work (collision check + IPAV + EDD guardrails baked in):
`~/.claude/plans/deferred-trigger-parity-prompt.md`.

## 9. DD/CourtReserve reference log (defensive only — nothing to remove)

- `src/lib/lead-segmentation.ts` — legacy-lead classifier marking DD/CR-provenance leads `off_limits` (enforces the no-DD-derived-sales rule).
- Guard tests asserting DD/CR absence: e2e/opengraph-image.spec.ts:79, eval-confirmation.spec.ts:46-49, lead-segmentation.spec.ts, clusters.spec.ts:272-275.
- One doc sentence restating the off-limits rule (docs/social/YouTube_Description_Template.md:10).
- No live DD/CR integration anywhere. Clean.
