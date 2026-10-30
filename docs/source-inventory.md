# NGA Source Inventory

> Audited at `a591bbd` (origin/main, 2026-06-12). Counts derived at audit time from `git ls-tree` — re-derive, never trust these as constants. Companion docs: `docs/hostile-reviewer.md`, `agent-log.md`, CLAUDE.md § Minor-data governance.

**Totals @ a591bbd:** 41 pages · 40 route.ts (36 under /api + 4 auth-session) · 8 crons · 96 lib files (74 top-level + 22 email/) · 49 e2e specs (41 pure / 7 browser / 1 live smoke) · 47 components.

**Stack reality:** Next.js (Vercel) + Stripe + **Notion as the only database** (no Supabase, no SQL). Auth = signed session cookies (coach/admin, magic-link issued) + HMAC tokens for one-shot parent/coach actions. Email = Resend; SMS = Twilio.

## October 23 NGA payment projection addition (pending release)

Sam approved the paired payment propagation fix after a verified NGA payment left its protected L&D RSVP at `intent`. `src/lib/mvf-linkdink-payment-sync.ts` reads fresh current-account Stripe invoice, invoice-payment, payment-intent, charge and refund evidence; validates native ownership/kind/date/server-resolved amount/residency; joins exactly one active native Notion registration by invoice; and derives the capacity-attendee and cleaned child-roster HMACs from the same identity. The authenticated new `/play/api/internal/nga-roster-payment` projection sends only opaque invoice/account/submission/HMAC identities, amount/currency/residency/time and a private provider-intent receipt. No child/guardian name, contact, DOB, medical or waiver data is added to this egress.

The MVF webhook calls it after the historical callback hold and native source processing, before mail flags or the already-paid return; destination failure remains retryable. The production signed-in `/admin/mvf-roster-sync` adds separate payment preview/apply actions using invoice ID only, fresh provider proof and a ten-minute session/source/proof-bound capability. It performs no age admission, roster addition, invoice, email or native payment mutation. The old roster recovery path and public age bounds remain intact. Community-os owns durable invoice/RSVP binding, payment-before-roster consumption, and the explicit external-NGA-refund guard. The provider intent stays out of L&D's native payment field. Both reviewed releases are prerequisites to live correction. See `docs/mvf-linkdink-payment-sync-runbook.md` and `e2e/invariant-mvf-linkdink-payment-sync.spec.ts`.

## October 23 MVF admin registration addition (pending release)

`/admin/mvf-registration`, `POST /api/admin/mvf-registration`, and `src/lib/admin-mvf-registration.ts` add an authenticated preview/apply flow for the active October 24 14U event. The page requires an allowlisted admin session before rendering; the API independently requires that cookie, an exact trusted Origin, and JSON. Responses are not cached. Public admission remains ages 11–14; this admin flow also accepts a real DOB yielding age 15–16 only with an explicit organizer approval and reason. The DOB is never rewritten. No schema changes or new child fields/destinations are introduced.

Preview verifies one current, signed waiver in the existing store and the live Stripe account (`acct_1TU4iSBpXOfTC961`), then returns a ten-minute HMAC receipt bound to the admin session, actor, operation ID, complete normalized form and waiver receipt. Registration verifies it again and checks capacity through the existing ledger. The server derives the existing $50 resident / $60 non-resident fee. It reuses native invoice creation with a stable operation ID and validates metadata, total and USD currency on every bound-invoice resume (including paid invoices). The draft must bind to capacity before finalization/email; a bind failure leaves it unpayable. Approval actor/reason are invoice audit metadata, never substituted for the actual DOB.

The existing native Notion registration writer and payment webhook remain authoritative. The admin flow reads back an active matching row before using the protected junior roster sync, which receives only event key, first/last name and parent email (the receiver derives its private attendee key). DOB, phone, emergency contact and allergies do not travel to Link & Dink. Existing MVF fields retain their approved Stripe/Notion/notification path. Canceled/refunded rows are not revived. An invoice receipt reports NGA and Link & Dink completion separately; payment status remains Stripe/webhook-owned.

Retries retain the same opaque UUID; the browser stores no family details in session storage. Confirmed completion clears it. After an uncertain write, repeat the same operation; do not start a second invoice. The durable Notion creation claim can survive a failed Notion POST: an accepted-but-unknown row can be found on retry, but a genuinely absent row requires reconciliation rather than another automatic create. The older roster replay tool still enforces public ages; this registration operation is the recovery entry point for an approved exception. Rollback removes this page/API/helper and nav item; issued native invoices continue through the existing webhook. Invariant coverage: `invariant-admin-mvf-registration.spec.ts`, narrow CSRF comparison pins in `invariant-canonical-site-origin.spec.ts`, and the shared synthetic invoice fixture. Provider-stub checks are not production registration proof.

## September 29 scheduling addition (pending release)

`/lessons/book` retains paid-invoice links and sends new requests to Coach OS `/book/nga-lessons`. Coach OS stores guardian contacts only and uses Sam's shared availability; no child fields are transferred. Its authenticated calls to `POST /api/lesson-scheduling` use the dedicated `NGA_LESSON_SCHEDULING_SECRET`, never the admin secret. `check_waiver` strictly reads the existing NGA waiver store. `prepare_request` also ensures a parent-only CRM inquiry exists; it never overwrites existing family or subscriber records. Missing configuration, malformed/incomplete reads, and Notion failures refuse the handoff. The public `/api/eval-book` slot picker is retired (410); evaluations are arranged by text. Tests: `invariant-lesson-scheduling-bridge`, `invariant-eval-book-egress`, `lesson-scheduling-entry`.

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
| src/app/coach/(authed)/fall-season/page.tsx + [group]/[week] | page ×2 | 2026-09-13 | season play: attendance → rotating-partner schedule → scores; week-6 seeding + double-elimination bracket (coach-gated, minor PII) | high |
| src/app/fall/standings/[group]/[token]/page.tsx | page | 2026-09-13 | signed parent standings link — first names + records only, noindex, force-dynamic, token verified before any read | high |
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
| src/lib/standings-link-token.ts | 2026-09-13 | HMAC parent standings link (season play) — keyed on STANDINGS_LINK_SECRET ONLY, no admin fallback | high |

**Season play (2026-09-13):**

| path | last-commit | purpose | conf |
|---|---|---|---|
| src/lib/season-league/{types,prng,rotation,standings,scores,finals,names}.ts | 2026-09-13 | pure engine: singles+doubles court allocation, history-aware partner rotation, shrunk-win% standings, snake seeding, double elimination | high |
| src/lib/notion-season-league.ts | 2026-09-13 | NGA Season League Games DB store — relations not names, find-or-create on the key title, schema probe (minor PII) | high |
| src/lib/season-league-view.ts | 2026-09-13 | orchestration over engine + Notion: preview/save a day, scores, lock/unlock teams, bracket scores, the parent StandingsView (minor PII) | high |
| src/app/coach/(authed)/fall-season/actions.ts | 2026-09-13 | thin requireCoach wrappers over season-league-view | high |

**Inquiry intake into the Player CRM (2026-10-19):**

| path | last-commit | purpose | conf |
|---|---|---|---|
| src/lib/player-crm-inquiry.ts | 2026-10-19 | `recordCrmInquiry`: league interest, waitlist, crew interest and Yellow Ball land a Lead in the Player CRM (child first name + age only; Notion-only; fail-soft). Pinned by `invariant-player-crm-inquiry.spec.ts` + `invariant-inquiry-routes-to-crm.spec.ts` | high |
| src/lib/notion-lead-enrich.ts | 2026-10-19 | `findFamilyRows` + `appendLeadInquiry`: the shared family lookup and Notes appender; stamps the strict reply pair (Last Inbound / Last Replied Date) by entry direction | high |
| src/lib/lead-enrich-run.ts | 2026-10-19 | `/api/lead-enrich` engine (Open Brain's write-back caller); closed vocabularies for channel, message source and direction | high |

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
| src/lib/linkdink-roster-sync.ts | 2026-09-28 | MVF Junior Tournament → Link & Dink roster sync, called by `api/checkout-mvf-junior-tournament`: sends child first + last name (cleaned by `cleanPersonName`, as on an invoice; a first name with nothing printable left is not sent and alerts `name_unprintable`) and the parent's email (L&D's idempotency input only, never stored there) by stable `event_key`, from a production deploy only (or a build `LINKDINK_BASE_URL` points at an L&D instance on purpose); never throws; a failure alerts Sam after the response, with no registrant data. Egress pinned by `invariant-linkdink-roster-egress.spec.ts` (risk log #11) | high |
| src/lib/mvf-parent-contacts.ts + src/app/api/internal/mvf-parent-contacts/route.ts | 2026-10-23 | Sam-approved production-only parent-contact read for L&D organizer messaging. Existing `NGA_SYNC_SECRET` header auth and exact division/event scope; legacy opaque roster keys use their original HMAC, while optional private `nga-notion-<UUID>` registration references bind a key to its active canonical source row without depending on child spelling. Returns normalized parent emails + keys only, never source references, child data or invoice IDs. Reads the canonical MVF Notion registration DB completely or fails closed; writes nothing and logs no source/response bodies. No new schema or contact on a child's L&D identity. Pinned by `e2e/mvf-parent-contacts.spec.ts`; risk log #16 | high |
| src/lib/notion-mvf-tournament-registrations.ts | 2026-09-29 | MVF Junior Tournament roster store (`NOTION_MVF_TOURNAMENT_REGS_DB_ID`), written by `api/checkout-mvf-junior-tournament` (invoice sent, `Pending`) and the Stripe webhook (`invoice.payment_succeeded` → `Paid`, or a backfill create from invoice metadata — that event was subscribed on the live endpoint only on 2026-09-29); read by `cron/mvf-tournament-payment-reminder` and the pre-event reminder (`src/lib/mvf-tournament-pre-event-run.ts`). **One row per invoice (2026-09-29):** the create looks the invoice up first, and a lookup Notion can't answer throws `DedupeLookupError` rather than reading as "no row" (pinned by `invariant-signup-invoice-idempotency`). Holds child first + **last** name, **full DOB**, allergies and an emergency contact beside parent contact: beyond the first-name + birth-year baseline, **approved by Sam 2026-09-29 as a scoped exception (D7)**. See risk log #12 (minor PII) | high |

**Buckets (remaining):**

| bucket | last-commit | purpose | conf |
|---|---|---|---|
| src/lib/notion-* (11 more) | 2026-06-10 | Notion DB clients, one per database | high |
| src/lib/email/ (22) | 2026-06-11 | Resend HTML templates + brand/ics/utm helpers | high |
| src/lib/validate-* (11) | 2026-06-12 | per-form input validation | high |
| payments: stripe, stripe-invoices, submission-key, refund-amount, cancel-camp, cancel-dropin, cluster-refund | 2026-09-29 | Stripe client, invoice sign-ups (every write keyed per submission step; `submission-key` = the forms' idempotency key), refund math, cancel flows (SLOP-FREE) | high |
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
| ~~/api/cron/scrape-news~~ | — | RETIRED 2026-10-26: the newsletter news block it fed came out 2026-10-23 |
| /api/cron/seed-tuesday-sessions | 0 8 * * 1 | seeds Tuesday sessions 8 weeks ahead |

## 6. Classification

| surface | class | evidence |
|---|---|---|
| drop-in funnel (/schedule, checkout, webhook, dropin crons, cancel) | MOUSE-CATCHER | Stripe checkout + webhook → Notion roster + Player CRM + email/SMS |
| camps | MOUSE-CATCHER | live Stripe products, booked courts, refund tooling |
| crew/commit/poll/autoreserve | MOUSE-CATCHER | off-session Stripe charges daily at noon |
| weekly newsletter (news scraper retired 2026-10-26) | MOUSE-CATCHER | real Thursday sends; Notion approval loop active |
| coach portal + admin portal | MOUSE-CATCHER (internal) | only authed child-data readers; active through 06-12 |
| clusters | PROTOTYPE→MOUSE-CATCHER | pilot live 06-11; staged rollout |
| league | PROTOTYPE | ships dark by design (503 until price env) |
| SEO city pages, schools, yellowball | SHOW PONY | static/lead-form only |
| one-time waiver (sign flow + pre-checkout gate) | HARDENED | invariant-tested gate + egress; parent-scoped, fail-open-on-unconfigured |
| api/analytics, open-brain-ingest | DOWNGRADE (best-effort) | telemetry; must never block payments |

## 7. SLOP-FREE ZONE (no edits without separate explicit approval; tests observe, never modify)

- `src/app/api/stripe/webhook/route.ts` + all `api/checkout*` + `api/commit/*` + `api/cancel-*` + `src/lib/{stripe,stripe-invoices,submission-key,refund-amount,cancel-camp,cancel-dropin,cluster-refund}.ts`
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
8. **Child PII flow**: child name/birth-year ride Stripe metadata → webhook → Notion + admin email. Same Notion row holds parent contact + child fields (no separate child record). Any new egress destination is a hostile-review trigger. One sanctioned exception to "Notion + Resend only": the MVF Junior Tournament roster sync to Link & Dink (#11). The MVF Junior Tournament collects child fields beyond the baseline and emails them to MVF, a second scoped exception approved by Sam 2026-09-29 (#12).
9. **`/api/coach/attendance` auth authority (2026-06-14, hardened).** The agent route grants attendance-write to any holder of `ATTENDANCE_SECRET`, which does NOT enforce the `COACH_ALLOWED_EMAILS` allowlist the coach UI action does — a broader authority on a minor-PII write. Hardened over the original #189 form (which used NGA_ADMIN_SECRET in a `?secret=` query param): now a **dedicated** secret over a **Bearer header** (no access-log exposure, isolated blast radius), fail-closed when unset, idempotent (no duplicate OB activity on retries), OB ingest awaited for Vercel durability, PII-free ack. Egress pinned to Notion + OB by `e2e/invariant-attendance-pii-egress.spec.ts`. Residual: until `ATTENDANCE_SECRET` is set in Vercel the route 401s every call (safe default).
10. **Camp roster surfaces allergies + emergency contact (2026-06-26, Sam-approved camp-safety exception).** The coach camp-roster view (`/coach/camps/*`) displays already-collected child medical (allergies) + emergency contact, read live from Stripe (NOT newly persisted), behind the coach `(authed)` gate. **Print-only — no CSV/file export in v1** (a file export would be a child-medical egress to a device that the fetch-host invariant class cannot pin; deferred deliberately). The read path makes zero outbound fetches (Stripe rides its own SDK transport); pinned by `e2e/invariant-camp-roster-pii-egress.spec.ts` (no OB/Resend/analytics host, no PII sentinel in any fetch body) and `e2e/notion-camp-roster.spec.ts`. Allergies are capped at 480 chars upstream; the roster flags possible truncation ("verify with parent"). Governance exception documented in CLAUDE.md Minor-Data Governance. Residual: a coach printing the roster takes child medical onto paper (same as the prior external packet) — operational control, not a code control.
11. **Child names → Link & Dink roster (MVF Junior Tournament; Sam's call 2026-09-22, keyed + alerting 2026-09-28).** After the invoice goes out, `api/checkout-mvf-junior-tournament` awaits `src/lib/linkdink-roster-sync.ts`, which POSTs the registrant to `www.linkanddink.com/play/api/internal/nga-roster-add` (header `X-NGA-Sync-Secret` = `NGA_SYNC_SECRET`, set separately on the NGA and L&D p3 Vercel projects). The body is exactly `{event_key, first_name, last_name, email}`: the child's first and last name — reduced by `cleanPersonName` (`src/lib/invoice-text.ts`) to Latin letters, marks on a letter, apostrophes, hyphens and spaces, because the organizer and MVF read them on L&D ("First L." on the roster, full in the roster export and the organizer's registration alert); a first name with nothing left is refused and alerted as `name_unprintable`, never replaced with a placeholder — plus the parent's email, which L&D uses only as an input to its sibling-safe HMAC idempotency key and never stores. No phone, DOB, allergies or emergency contact. Only a production deploy (`VERCEL_ENV=production`; the Vercel project exposes system env vars, checked 2026-09-28) sends; a preview or local build skips unless `LINKDINK_BASE_URL` points it at an L&D instance on purpose. A runtime that holds the secret but has no `VERCEL_ENV` (unset or empty) skips and alerts `env_unknown`, so production with system env vars hidden can't skip every registration silently while the secret is present; with the secret also missing it would skip quietly (a double fault). The call refuses redirects (a redirect would carry the secret header and the body to another origin) and times out after 8 seconds. On the L&D side (community-os 432feeb) the player row and the RSVP store the child's full first and last name; the row carries no contact (so it joins no adult community identity), displays as "First L.", is hidden from peers, and the event must carry a youth age band. `event_key` is the division key without L&D's `-N` re-creation suffix, so a cancel-and-recreate keeps resolving to the one live event. A failed sync never throws; it alerts Sam through `deliverCronAlert` after the checkout response goes out, with L&D's error code, the division and the key only (NGA's own missing secret is `nga_secret_unset`, distinct from L&D's `not_configured`). Recovery (Sam-approved admin resend, 2026-10-01): check the L&D roster first (a timed-out call can still have seated the player); if missing, match the alert to its existing invoice ID and open `/admin/mvf-roster-sync`. The signed admin cookie + allowlist and same-origin JSON gate protect the one-row Notion lookup. A unique row in the configured tournament DB must have a valid division, active Pending/Confirmed status, cleaned name, parent email and age 8–10 / 11–14 on event day. Preview calls the same endpoint with `dry_run: true`; only `would_add` issues a ten-minute digest receipt bound to the invoice, row, revision, exact cleaned payload and current admin session. Replay re-reads and verifies before sending the original four fields. It changes neither Notion nor invoices/payments; it does not check in the junior or link a community identity. The new tool is production-only, uses the fixed existing host and server credentials, and ignores URL overrides. It collects/echoes no child fields. It uses `COACH_SIGNING_SECRET` with a domain-separated HMAC; rotation invalidates previews along with existing admin sessions. No new credential or schema is required. Pinned by `e2e/invariant-admin-mvf-roster-resend.spec.ts`. L&D main `2666edcd` imports atomically under the external-registration guard; direct/public inserts remain blocked. Never hand-add a junior through L&D's walk-up form: even name-only it skips the junior protections (`peer_visible` false, the RSVP's child-name fields) and seats the child already checked in; with the parent's contact entered it ties the child to the parent's adult identity (TD-59); and the endpoint can't dedupe that seat later. Pinned by `e2e/invariant-linkdink-roster-egress.spec.ts` (host, path, four-field allowlist, header auth, no redirects, the timeout's duration, production only, `env_unknown`, fail-closed, no PII in alerts or logs). The `after()` delivery itself is not pinned by a committed spec (the pure suite has no request scope, so it exercises the inline fallback); it was checked against Next 16.3.5's `AfterContext` out of tree on 2026-09-28: delivered once at response close, never twice. Residual: (a) the names now live in L&D's `ld.*` tables, so their exposure there follows L&D's youth-roster rules (including what an MVF co-organizer's roster view shows); (b) the two `NGA_SYNC_SECRET` copies are unreadable and in neither env registry, so a mismatch surfaces as an `unauthorized` alert or failed admin preview; the resend tool uses the existing server value without exposing it; (c) rotating `NGA_SYNC_SECRET` changes every idempotency key, so inspect the live roster before using a preview after rotation; (d) the checkout route awaits the sync, so an L&D hang adds up to 8 seconds to a parent's checkout response. (e) L&D's idempotency key hashes email + first + last name, so a name that cleans differently from what was sent before 2026-09-29 gets a new key; before re-sending any registration synced earlier, dry-run it against the live roster.
12. **MVF Junior Tournament: child last name, full DOB, allergies and emergency contact (collected since 2026-09-22; approved by Sam 2026-09-29 as a scoped exception — decision D7).** CLAUDE.md's Minor-Data Governance allows a child's first name + birth year, plus allergies + emergency contact under the camp-safety exception (`/api/checkout-camp`). The MVF form (`MvfJuniorTournamentForm`, validated by `validate-mvf-junior-tournament.ts`) requires more. Found by the 2026-09-28 review (D7) with no approval on record, and inventoried 2026-09-29. **Sam approved the flow as it runs today on 2026-09-29**, covering every field and destination listed below, including the plain-text DOB, allergies and emergency contact in the MVF partner's "paid" notice. The approval covers this tournament's current fields and recipients only: a new field, destination or recipient needs its own approval. Recorded in CLAUDE.md's Minor-Data Governance as the MVF exception.
    - **Why the fields exist:** the full DOB places the child in a division by age on 2026-10-24 (10U / 14U, `isDobEligibleForDivision`), which a birth year alone can't do near the cutoff. Allergies and the emergency contact serve day-of supervision, as at camps. The last name identifies the child on the MVF / Link & Dink roster.
    - **Where each field goes:**
      - *Stripe invoice metadata* (`checkout-mvf-junior-tournament`): all of them — first + last name, `child_dob`, emergency name + phone, allergies (capped at 480). Visible in the Stripe Dashboard, not on the invoice a parent receives; the visible invoice text carries only the cleaned name (`invoiceSafeName`).
      - *Notion roster row* (`NOTION_MVF_TOURNAMENT_REGS_DB_ID`): all of them — `Child Last Name`, `Child DOB` (date), `Emergency Name`, `Emergency Phone`, `Allergies`. Written at checkout, and again by the webhook's backfill create if the row is missing when the invoice is paid.
      - *"Invoice sent" admin notice* (`signup-admin-notify.ts`, to Sam's two inboxes **and MVF's partner contact**): child first + last name, no DOB / allergies / emergency contact.
      - *"Paid" notice* (Stripe webhook, `invoice.paid`, to Sam's two inboxes **and MVF's partner contact `malvero@mvf.org`**): child full name, **DOB, emergency contact and allergies** in plain text. **This is the one flow that puts the extra fields in an outside organization's inbox.** The partner recipient was Sam's call of 2026-09-22; the fields in this scoped paid notice were subsequently approved on 2026-09-29 (D7), as recorded above. That approval does not establish safe rendering of untrusted name or medical text.
      - *Parent emails:* the signup confirmation, payment reminder and pre-event reminder carry the first name only (the signup confirmation's is cleaned). The webhook's "You're in" email carries first + last name, raw, to the paying parent. None carries the DOB, allergies or emergency contact.
      - *Link & Dink roster sync:* cleaned first + last name only (#11).
      - *Open Brain* (`nga_mvf_junior_tournament`): first name only since 2026-09-28 (#372). Before that it received the last name and DOB; those rows are part of the D3 scrub.
    - **Pinned** by `e2e/invariant-mvf-tournament-payloads.spec.ts` (complete actual Stripe/Notion payloads and exhaustive child-property syntax inventory) and `e2e/invariant-mvf-notification-output.spec.ts` (actual serialized mail from signed synthetic `invoice.paid` / `invoice.payment_succeeded` callbacks and the invoice-sent helper, using strict offline provider fixtures). The output tests compare complete recipient/envelope/text objects, reject extra child fields hitchhiking from metadata or notice inputs, and verify quiet redelivery after both notification receipts are acknowledged. They do not call real Stripe, Notion, Resend or Link & Dink, nor prove deployed configuration or real-provider deduplication. These complete-payload assertions replace the narrower child-prefix and paid-email source-expression checks formerly in `invariant-mvf-tournament-child-fields.spec.ts`. The partner send is the only one in the paid webhook; the separate invoice-sent helper also sends to MVF, with names but without those additional child fields. Rendering is a separate boundary: `e2e/invariant-mvf-name-rendering.spec.ts` pins cleaned invoice-sent body names and escaped reminder HTML names. Sam separately approved the narrow local paid-notice name repair on 2026-10-22: assembled child names and outgoing parent/emergency name fields now use the existing invoice-name cleaner. Raw roster metadata, approved fields, recipients, ledger, provider keys and retry behavior are preserved. Pending old-version notification attempts require reconciliation before deployment because cleaned names can change payload bytes under an existing provider key; never rekey to force a resend. Local synthetic green does not establish deployed delivery or publication approval. The existing separate approval requirement for any webhook edit is unchanged.
    - **Options not taken (still available if Sam narrows it later):** a birth year plus a self-attested "age on Oct 24" instead of the DOB; keeping allergies and the emergency contact out of the MVF partner email; deleting the fields once the event is over.


13. **Season checkouts: child last name (collected since 2026-10-19; approved by Sam 2026-10-19, required).** `/fall` and `/monday-girls` now require a "Player's last name" (`src/lib/child-last-name.ts`: letters, spaces, hyphens, apostrophes, periods, 40 max, the same rule Link & Dink's `ld.rotation_league_roster` command parser enforces). Why: the season rosters held a first name only, and the rotation-league coach screens send the full name to Link & Dink.
    - **Where it goes:** Stripe checkout metadata (`child_last_name`, cleaned) -> Stripe webhook -> the season's Notion roster row (`Child Last Name`, written only when present so a checkout started before the field existed still lands) and the ADMIN notification's "Player:" line. Next, the coach screens send it to Link & Dink (approved the same day).
    - **Where it never goes:** parent emails, Open Brain (`last_?name` is on the ingest strip list), the Player CRM sync, the webhook ack, any public page.
    - **Not changed:** the Pickl Park checkout (retired 2026-09-07, answers 410), the MVF tournament (#12), drop-ins, camps, leagues.
    - **Pinned** by `e2e/invariant-season-child-last-name.spec.ts` (mutation-checked 3/3: making the field optional, always writing the property, and leaking it into a parent email each turn it red). Rows created before 2026-10-19 stay blank; there is no backfill.
14. **Rotation-league coach screens → Link & Dink (2026-10-20, Sam-approved egress 2026-10-19).** `/coach/league` sends a season's roster to L&D's `ld.rotation_league_roster` through `/play/api/internal/nga-rotation-league`: the registration page id plus the child's first and last name, nothing else (`src/lib/rotation-league/roster.ts` never reads birth year, allergies, emergency contact, parent fields or SMS consent). Check-ins, plans and scores carry ids and numbers only. Production-only (or `LINKDINK_BASE_URL`), `X-NGA-Sync-Secret` header, coach-session gated on every action. First wired as a trial on Fall 2026 Green/Yellow, so the Fall roster's first names (and any last names collected since 2026-10-19) now also sit on L&D. Pinned by `e2e/invariant-rotation-league-egress.spec.ts` + `e2e/invariant-rotation-league-authz.spec.ts`. Erasure on L&D is `erase_player` (endpoint only; no NGA button yet).
15. **Parent standings link for Link & Dink seasons (2026-10-20, Sam's call: full names).** `/standings/<slug>/<token>` shows a season's standings and playoff with each child's first and last name, read live from Link & Dink. Protection is access only: one HMAC link per season (`league-standings-token`, `STANDINGS_LINK_SECRET`, no fallback, rotate to revoke), token verified before any call, `noindex` + `no-referrer` + `force-dynamic`, robots-disallowed, not in the sitemap. A forwarded link exposes full names; that trade-off was Sam's explicit choice over first name + initial. Pinned by `e2e/invariant-league-standings-link.spec.ts` (mutation-checked 3/3).
16. **MVF parent contacts for L&D organizer messaging (Sam-approved 2026-10-23; stable-reference follow-up approved the same day, PR review pending).** `POST /api/internal/mvf-parent-contacts` is a production-only server-to-server reader, protected by timing-safe `X-NGA-Sync-Secret` comparison against the existing `NGA_SYNC_SECRET`. The existing `{event_key,sync_keys}` body remains valid: one of the two MVF tournament division keys and 0–100 unique opaque `nga:` roster keys. An optional `registration_refs:[{sync_key,registration_ref}]` maps a unique subset of those keys to unique private `nga-notion-<UUID>` references; UUID/prefix case is normalized. L&D supplies these from an approved stored RSVP provenance field, never organizer/browser input. A referenced key resolves **only** the identified canonical Notion page in the same configured DB, exact requested division and active Pending/Confirmed status, with a valid parent email; child spelling is not a lookup input. Missing/inactive/wrong-division references stay missing even if a legacy HMAC would otherwise match. Keys without an explicit reference retain the original name/email HMAC behavior. Duplicate normalized references, duplicate mapped keys, unrequested keys, malformed mappings, extra fields and input over **16 KiB** are rejected; 100 reference/key pairs fit inside this bound. Empty keys return an empty audience without reading Notion. Browser Origin requests and other content types remain refused. The fixed Notion endpoint is queried with exact Division and Pending/Confirmed status filters, then each row's database, division and active status are checked again. Cancelled/refunded, archived, missing-contact and invalid-contact rows cannot yield contacts. Complete traversal is bounded to 20 pages/2,000 rows and one eight-second abort signal; missing/repeated cursors, malformed source data, divergent contacts for one key, provider failures or a page-cap hit return a fixed error and no partial audience. The response remains only `{contacts:[{sync_key,email}],missing_sync_keys}` in caller order: no source IDs/references, names, child fields or invoice IDs, with normalized parent emails, `no-store`, no CORS, redirects, source logs or Notion writes. L&D must authorize the event organizer and restrict both keys and stored references to that event's active NGA RSVPs before calling; NGA's shared service credential is not organizer authentication. Parent email is used only for organizer messaging and is not copied into a child's L&D player/profile/contact fields. This code makes no migration, source/roster correction, payment/roster writer, new credential or marketing opt-in. Legacy name/email changes or secret rotation can still make unreferenced keys unresolved; they are reported missing rather than guessed. Stable references do not widen division eligibility. Tests use synthetic contacts and offline provider stubs; release and any separately approved provenance repair require their own receipts.
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

## 2026-10-17 MVF capacity and recovery changes (local, coordinated rollout pending)

MVF invoice capacity now uses the existing authenticated NGA → P3 server transport (`NGA_SYNC_SECRET`), backed by service-only `ld.nga_tournament_capacity` / `ld.nga_tournament_reservations`. The new store contains event keys, opaque UUID/invoice IDs, domain-separated HMAC digests of attendee identity and the full validated request, lifecycle and notification timestamps/flags. It receives no raw child/contact fields. Notion remains the roster/CRM record and is no longer the authority for scarce MVF seats. A row lock serializes reservations per division; every non-void hold counts, and no timed expiry can free a still-payable invoice.

The migration intentionally initializes both divisions with `ready=false`. The combined-field reconciliation retains historical invoices under their original division keys while counting active seats in the surviving 14U pool; 10U stays closed. Before release, reconcile every paid, still-payable and fully refunded/provider-voided invoice on its actual Stripe account. A paid invoice status alone is insufficient to prove a refund. Compare the original invoice identity privately with its Notion row before using the protected `/admin/mvf-capacity-export` operator form or its cookie-authenticated, same-origin JSON `POST /api/admin/mvf-capacity-export` (`invoices: [{ invoiceId, originalDivision }]`). This read-only endpoint derives the native original-division HMACs and a canonical 14U pooled-attendee HMAC inside the NGA runtime, returning opaque invoice IDs, digests, count and source revision only. A revision covers the requested rows, not proof of exhaustive provider inventory or payment verification.

`scripts/prepare-mvf-capacity-bootstrap.mjs` reviews the exact opaque manifest contract used by community-os's manually dispatched capacity activation workflow: schemaVersion 1; pool `mvf-2026-10-24-14u`; seatLimit 12; providerVerified; UTC reconciliation time; sourceRevision; reviewed counts nine active and two released; both original event keys; and per-invoice provider account/status, full-refund verification, original and pooled digests, reviewed notification flags and mandatory `legacyCallbackHold: true`. Released records persist as `void`; they retain callback quarantine and never occupy a seat. All historical rows stay quarantined even when prior delivery is unknown. The tool performs no network/database operation; its review SQL refuses an enabled/nonempty or changed ledger and enables only 14U. Real participant fields, invoice seed rows and private manifests never belong in Git. Apply only through the separate approved release process after the companion combined-pool migration is verified; implementation, merge and activation are distinct. No bootstrap is applied by these changes. Legacy unknown invoices fail closed before roster/email effects until reconciled.

Paid notices retain the existing recipients and fields. Recipient-specific Resend idempotency keys handle overlapping deliveries; durable delivered flags suppress acknowledged notices indefinitely. Because provider keys last 24 hours, an unacknowledged attempt older than 23 hours refuses automatic resend for manual reconciliation. A failed waiver write returns 503 before email/CRM side effects. Draft recovery stores only division/residency, guardian contact and player names in tab-scoped session storage for at most 30 minutes; DOB, emergency contact, medical notes and SMS consent require re-entry and are stripped from older saved drafts. Hash-only attempt records preserve retry keys and reject changed uncertain attempts.

The idempotent paid-email body excludes mutable roster-write status so a lost delivery acknowledgment can replay identical provider parameters. Reconciliation failures are logged with opaque invoice IDs. Provider-confirmed void rows retain history but are excluded from active attendee uniqueness; payable or uncertain holds remain protected. The offline bootstrap refuses multiple active invoices for one attendee.

Sam subsequently authorized repair of the reproduced concurrent Notion missing-row race. Checkout and both paid-event aliases now use one durable, service-only creation claim on the already-bound invoice reservation. The additional nullable `roster_create_started_at` field holds no participant data. An authoritative Notion lookup happens before claiming; an unavailable lookup or claim writes nothing. At most one caller may POST a new page. A positive lookup recovers a lost create response and never downgrades an existing paid page. Losing callers return a retryable result so payment redelivery can re-read the winner's row.

The creation claim has no timeout, lease or automatic reset. A failed or lost POST response may mean Notion accepted the page even if its query index has not caught up. Retry the invoice lookup first. If a claim remains held while the row remains absent, freeze processing for that invoice and verify the provider request outcome and the target database directly. Only after confirming no page was created and no original request remains in flight may an explicitly authorized operator clear `roster_create_started_at` for that exact event/invoice and replay. Never clear claims in bulk or merely because they are old. Existing duplicate pages need separate reviewed reconciliation; this code does not delete/merge any roster rows. Local evidence preserves the original two-row failure and adds simultaneous checkout/paid-alias tests, lost-ack recovery, uncertain-missing refusal and independent database connection races. This remains a coordinated local-only migration/app change, with no production rollout performed.


### Signed standings telemetry boundary (2026-10-20)

Both `/standings/*` and `/fall/standings/*` carry bearer credentials. Page tracking and the first-party analytics transport drop events from these routes, or carrying their URL in a referrer/nested value; the proxy repeats this check before upstream work. Newly loaded documents from the fixed app have no optional GA4/Meta bootstrap or mirrors, so those providers cannot install automatic history capture for later signed-route navigation. Already-open tabs running the old app may retain loaded providers until reloaded; this source repair does not unload them or erase existing remote copies. Public first-party analytics remains. No secret, access grant or external configuration is changed. Coverage: `e2e/invariant-standings-analytics-privacy.spec.ts` and `invariant-analytics-transport.spec.ts`.


## Future MVF month registrations — proposed, admission disabled (2026-10-30)

The three stable month URLs retain their informational/photo content. New admissions require the source `MVF_SERIES_ADMISSION_ENABLED` gate, a reviewed immutable release revision, a future intake deadline, the existing NGA live Stripe account and provider integrations, and a separately ready ten-seat backend division. All production release lists and active revisions ship empty. Tentative dates, minimum ages/play-up, minimum enrollment, cancellation/weather, invoice timing and revenue allocation are not inferred from October. Closing admission preserves issued release versions and callback/receipt processing.

`/api/mvf-series/[event]/register` collects the existing MVF guardian/player/safety fields (full name, DOB, emergency contact, medical notes, optional exact SMS consent), plus an explicit policy acceptance/revision. The flow uses the existing NGA Stripe account `acct_1TU4iSBpXOfTC961`, USD ad-hoc invoice items at $50 resident/$60 nonresident, and explicit `payment_owner=nga_site`/`kind=mvf-junior-series`. Invoice allocation metadata is bookkeeping only: no transfer, new product/price, charge/refund automation or billing-account setting is added. Final invoice totals, amount due and no existing payment must match before email; a mismatch retains the invoice/seat for operator reconciliation.

Full registration metadata goes to Stripe and the separate Notion `NOTION_MVF_SERIES_REGS_DB_ID` roster. The old tournament DB is rejected if configured as the new DB. Schema is checked before invoices; pending rows record zero paid, and exactly one invoice-bound roster creation is permitted. Paid/void status updates re-read that row's database/event/revision and guardian/player identity. No child fields reach Open Brain, analytics, a public roster or Link & Dink player profiles. Operational notices go only to the invoice guardian and Sam's two existing NGA admin inboxes; no partner medical notice, reminder cron, marketing send or SMS send is added. New partner communications and day-of roster projection need their own review; October's existing channels are untouched.

The existing authenticated NGA → P3 transport sends only stable event keys, UUID/invoice IDs, domain-separated HMAC identity/request hashes, notice payload hashes and lease tokens to new service-only `ld.nga_series_*` tables. October's combined pool and records are never reused. Pending/unbound/payable/paid holds count toward ten; no timed expiry releases them. A provider-confirmed unpaid invoice void can release a bound seat; paid cancellations/refunds require owner review. Lost/uncertain responses retain capacity. Durable notification claims bind exact payload bytes to a stable provider key; uncertain retries past 23 hours require reconciliation.

The private receipt and unpaid-cancel capabilities are domain-separated HMACs of one event/invoice/submission/revision/purpose with bounded expiry, using the existing `NGA_SYNC_SECRET` without creating a new credential. They travel in a browser fragment then POST body, not server query strings; responses contain only status, bracket, fee, validated Stripe pay URL and a separately scoped unpaid-cancel capability. No guardian, child, DOB or medical field is echoed. Session storage keeps only a per-event opaque submission UUID and 30-minute expiry; no registration fields. Secret rotation invalidates capabilities and changes new attendee hashes, so reconcile pending attempts before rotation.

Validation uses synthetic SDK/Notion/mail/ledger fixtures, signed local webhook requests, credential-free isolated browser copies, disposable PGlite, and private-socket local PostgreSQL concurrency. No real Stripe sandbox round trip or production transaction is claimed. No database change, access grant, live setting, invoice, email, charge, refund or replay was performed. The paired migration and application remain draft-only pending review and explicit launch approval.

Invoice-send acknowledgement is durably recorded before retries can forget Stripe's 24-hour keys: acknowledged sends skip the SDK; uncertain sends and unbound attempts past 23 hours require owner reconciliation. Receipt links in guardian/admin operational emails use a frozen first-attempt timestamp, keeping notification bytes stable across retries. A definite successful response clears only the per-event attempt UUID so a guardian can register another child immediately; uncertain responses keep the UUID.

Pre-launch review corrections (2026-10-30): the invoice metadata guardian, invoice email snapshot and fresh Stripe Customer email must agree before finalization, immediately before send and before receipt access. A recipient mismatch is a hard failure, including during notices; it cannot become a successful response with `notificationPending`. No address is automatically repaired. Offline Stripe fixtures model live draft customer email and frozen finalized email independently of metadata.

A receipt may say paid only after fresh complete invoice/payment-intent/charge/refund proof and an exact confirmed roster read. Post-confirmation refunds (including pending refund evidence), credits and disputes move the existing roster to `Review required`, clear its Paid confirmation checkbox, preserve historical amounts and retain the paid capacity reservation. This required status option must exist before launch. Provider outages show verification pending without inventing an adjustment. Review is sticky until an operator resolves the roster; no automatic refund, cancellation, resale or repeat confirmation email is authorized. Signed `charge.refunded`, `charge.dispute.created/updated/closed`, `credit_note.created/updated/voided` and `invoice.updated` events resolve a fresh exact series invoice before reconciliation. Event subscription and provider read permissions remain operational launch checks; no live endpoint was changed. Unrelated invoices retain their legacy handling.

The receipt UI clears prior status/actions on each verification or fragment change, observes hash/history navigation and invalidates stale asynchronous responses. Unpaid cancellation requires a freshly verified receipt for the token currently in the address bar. Failed refreshes remove previous confirmation and payment/cancellation controls.
