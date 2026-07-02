# Deep Codebase Review + Admin-Reduction Roadmap — Next Gen Pickleball Academy

**Rev 2 — 2026-07-01.** Fact-checked line-by-line against the repo at `38b5b4c` (post-#237) by a senior-engineer review pass; all quantitative claims verified with rg/find/wc and all "helper exists/missing" claims resolved to file:line. Deltas from Rev 1 are listed in the changelog at the bottom.

## Context

Sam asked for a new-engineer deep review: what's built, what needs improvement, and how to start fixing it so a solo founder-coach can focus on coaching instead of administrative work. Three parallel exploration passes covered the product surface, the ops/automation machinery, and code quality; a design pass produced the phased roadmap below; a verification pass re-checked every claim against the code. This document is both the review findings and the recommended execution plan.

---

## Part 1 — What's actually built

This is **not a marketing site — it's a lightweight club-operations platform** wearing a marketing site's clothes. Scale: ~45k lines of src TypeScript (45,118 across 315 files), 46 page routes (31 public / 15 coach+admin), 50 API endpoints, 124 lib files, 100 Playwright specs (~12.0k lines).

**Architecture in one sentence:** Vercel-hosted Next.js 16 with **no database of its own** — 17 Notion databases are the system of record, Stripe is the money layer, Resend/Twilio are comms, Open Brain is the external CRM mirror, and 12 Vercel crons are the back office.

**Live and mature:**
- Marketing site + 8 programmatic SEO city pages + ~15 lead-capture funnels (lead, contact, newsletter w/ referral rewards, crew interest, waiver, waitlist, schools B2B, yellowball, poll votes…).
- Drop-in commerce: `/schedule` (Notion-sourced, 5-min ISR) → Stripe Checkout → 1,085-line webhook → Notion roster + emails + SMS + player sync.
- **Refunds run through TWO idempotent engines, not one funnel** (corrected in Rev 2 — this matters for Phase 3):
  - `cancelDropIn()`/`cancelDropInByPaymentIntent()` (`src/lib/cancel-dropin.ts:168,184`) — five entry points: parent token self-serve cancel, coach per-row cancel, coach per-row refund, `/api/cancel-registration`, and the `charge.refunded` webhook branch (`webhook/route.ts:881`).
  - `executeSessionCancel()` (`src/lib/session-cancel.ts`, own `refundOne` at :84) — whole-session cancel, all-levels cancel, `/api/admin/sessions/cancel`, and the reconcile-cancelled-sessions cron.
- Camps commerce: rosters are a Stripe read-model (`src/lib/notion-camp-roster.ts`), synced **at checkout time with a daily-cron backstop as of #237** (2026-07-01) — see Part 2/H2.
- One-time e-sign waiver + pre-checkout gate (`hasWaiverOnFile`) on all four checkout routes (547 lines total).
- **Coach portal** (magic-link auth: 10-min HMAC link → 30-day session cookie, `src/lib/coach-auth.ts`) — a real ops console: attendance check-in, per-row cancel/refund (full/partial), whole-session + all-levels cancel, eval-confirmation sends with dry-run (`src/app/coach/(authed)/eval/`), family profiles, crew confirmation from polls, printable camp rosters, token-based no-login cancel from email.
- **Admin portal**: sessions editor writing to Notion + camp roster panel with cancel/refund.
- 12 crons: drop-in reminders, post-session recaps, coach pre-event briefs, weekly newsletter, crew autoreserve (off-session charges), news scraping, Tuesday session seeding, crew follow-ups, **two** camp crons (Friday parent reminder + daily coach checklist), cancelled-session reconciliation, passed-session marking.

**Deliberately dark-launched (complete but gated — easy to mistake for unfinished):** League (`NEXT_PUBLIC_LEAGUE_ENROLLMENT_OPEN` flag + missing price env → 503) and Clusters (`src/data/cluster-launch-gates.ts` all false → 503 at the money step).

**Standout asset:** the test culture. 29 `invariant-*` specs pin child-PII egress, auth fail-closed behavior, refund/webhook idempotency, and trigger parity; specs are written red-first and mutation-verified; CI runs `lint → tsc → test:pure` (~720 pure cases, no dev server; `.github/workflows/ci.yml:17-20`). `agent-log.md` records every change as Situation/Decision/Risk/Change with rollback plans.

---

## Part 2 — What needs improvement (ranked)

**H2 — Near-zero observability of domain failures (the single biggest operational risk).** No error tracker (deps are only next/react/resend/stripe/twilio). Precisely (Rev 2): the gap is NOT "no alerting anywhere" —
- `crew-autoreserve` already emails Sam on card decline and on "REFUND FAILED" (route ~1508-1531);
- four crons (weekly-newsletter, seed-tuesday-sessions, camp-reminder, camp-checklist-reminder) already return HTTP 500 on hard failure, so Vercel's cron dashboard flags them.
- **The real gap is swallowed per-item domain failures returned as 200** in ~6 crons — canonical example `dropin-reminder/route.ts:160-165` + `281-292`: a Resend reject is `console.error`'d, the row is left unflagged, and the route returns `ok:true`. Nothing reaches Sam by email/SMS/Slack for these.
- This class has already bitten once: a misconfigured Resend key silently broke camp roster sync. **That specific incident was fixed by #237 (2026-07-01)** — checkout-time write-through + a backstop that runs *ahead of* the `RESEND_API_KEY` gate + daily cron. #237 is both proof of the class and the pattern Phase 0/3 should generalize.

**H1 — In-memory rate limiter copy-pasted into 10 public routes** (`src/app/api/lead/route.ts:24-46` is the template; +2 cron routes). On serverless each instance has its own Map, so real protection is near zero and it resets every deploy.

**M1 — Four near-identical checkout routes** (547 lines total: `checkout`, `checkout-camp`, `checkout-league`, `checkout-cluster`); the waiver gate had to be hand-wired into all four. A fifth program means a fifth copy.

**M2 — Untyped Notion layer.** 69 explicit `any`s (64 `: any` + 5 `as any`); `readPlainText()` redefined in 7 files; `EMAIL_RE` redefined 24×; 12 copy-paste `validate-*.ts` libs. A renamed Notion column is a runtime failure, not a compile error — under payments and rosters.

**M4 — Config as source literals.** The Player CRM Notion DB ID is a hardcoded string in **7 files** (`src/app/api/lead/route.ts:16`, contact, camp-outreach, eval-reengagement routes + `notion-player-sync.ts`, `notion-player-lookup.ts`, `notion-eval.ts`); admin emails inlined across routes (literal address in 13 files); 7 ops endpoints authenticate via `?secret=` query strings (leak into logs).

**L — File bloat** (webhook 1,085 / `SessionsEditor.tsx` 813 / `notion-sessions.ts` 773 lines) and no direct spec on checkout-session construction (only the ordering invariant in `invariant-waiver-gate.spec.ts:127-133`).

**The manual admin burden (the actual target):**
1. **Eval booking is 100% manual** — parent inquires → email/phone tag to pick a time → coach-portal send → Sam hand-creates the calendar event. ~20–40 min per eval.
2. **Daily/weekly Notion status flips across 4 DBs** — news triage, newsletter-draft approval, crew-interest review, CardFailed commit re-activation. ~30–60 min/week, scattered.
3. **Manual session seeding** — only Tuesday is cron-seeded; the Mon/Wed/Thu cluster-pilot evenings are hand-created, one row per level (~12+ rows/week).
4. **Curl-with-secret ops** — eval-reengagement, post-eval-followup, camp-outreach run from a terminal with a dryRun-first convention enforced only by discipline.
5. **Hand-recovery** — `backfill-dropin.mjs` on permanent webhook failure; manual Stripe-dashboard refunds when refund calls fail.

---

## Part 3 — Roadmap: "Sam coaches, the site runs the desk"

North star: **weekly admin minutes eliminated per engineering hour**, without weakening IPAV / Slop-Free Zones / COPPA gates. No new infra — everything fits Vercel + Notion + Stripe + Resend + Twilio.

**Q3 focus check (Rev 2, non-blocking):** Phase 1a is an acquisition-side funnel; Q3 Goal #2 is retention-first fall re-enrollment. The admin-minutes math still favors 1a (evals are the single biggest weekly drain), but if camp→fall conversion outreach ends up competing for the same build-hours, name the retention number first and let it win. Sam's call.

### Phase 0 — See failures before parents do (~1–2 days)

**0.1 Cron-failure alerting via a shared wrapper (not Sentry, not log drains).** Sentry misses the actual incident class (swallowed domain failures returned as 200); log drains need paid infra. Build `src/lib/cron-alert.ts`:
- `withCronAlert(name, handler, options?)` wrapping every cron; handler returns `{ attempted, succeeded, failures[] }` so **partial** failures alert too — the wrapper derives the outcome from `failures.length` alone (no hand-computed `ok`). Hourly crons pass `alertEmailUtcHours` to cap alert EMAILS to fixed UTC windows (Resend 100/day quota guard); every failing run still 500s + logs the full alert body.
- On failure: email Sam (CC admin) with cron name + failure list + Vercel logs link; if the alert email itself fails → SMS via existing `sendSms()` (`src/lib/sms.ts:39` — already used by dropin-reminder), covering the "Resend key is dead" case; return 500 so Vercel's cron dashboard shows red.
- **Integrate with, don't double-layer, `crew-autoreserve`'s bespoke alerts** (Rev 2): its per-event decline/refund-failure emails carry actionable context — keep them, and have the wrapper catch only what they don't. Two alert channels for one failure is how alerts get ignored.
- **Alert-storm posture, stated explicitly** (Rev 2): there is no state store to record "already alerted," and `reconcile-cancelled-sessions` runs every 2h — a persistently-failing dependency means up to 12 alert emails/day in v1. Accepted for v1: include the failure signature in the subject so Gmail threads them; SMS escalates ONLY when the alert email itself fails, never per-run. Revisit only if a real storm happens.
- **No PII in alert bodies** (controlled-vocabulary signatures, page IDs + counts; error CLASS names only for unhandled exceptions — raw exception text and the merged route summary stay in logs; the 500 body is a fixed generic shape) — stays off the minor-PII egress surface.
- Rollout: 10 non-payment crons in one PR (for the 4 that already return 500 the wrapper standardizes rather than adds); `crew-autoreserve` (Slop-Free, off-session charges) in its own separately-approved PR. New pure spec `e2e/cron-alert.spec.ts` (alert-body builder, PII-free assertion) first.

**0.2 Ride-along consolidations** (de-risk Phase 1): extract `src/lib/rate-limit.ts` from the 10 copies (keep in-memory — don't add Upstash unless abuse is observed); extract shared `readPlainText()`/`EMAIL_RE` into `src/lib/notion-utils.ts` (migrate opportunistically); move the hardcoded Player CRM DB ID behind one env-backed constant — a **7-file** change (the minor-PII files need their own approval — batch with Phase 1a which opens that zone anyway).

**Deliberately deferred:** M1 checkout consolidation and L2 file splits buy zero admin minutes and churn Slop-Free payment files — do them only when a feature forces those files open. The typed-Notion layer is NOT a prerequisite for anything below.

### Phase 1 — Kill the two biggest recurring drains (~1–1.5 weeks)

**1a. Eval self-scheduling (highest-ROI item).** Smallest slice: Sam publishes availability, the parent picks, the system confirms both sides. No Google API in v1.
- New Notion DB **"NGA Eval Slots"** (`NOTION_EVAL_SLOTS_DB_ID`): Date, Start/End, Location, Status (Open/Booked), Booked By/Child/At. Sam bulk-types slots in ~2 min/week.
- `src/lib/notion-eval-slots.ts`: `fetchOpenEvalSlots()` + `claimEvalSlot()` — claim-then-verify to shrink the no-transactions race window, **with the loser path specified** (Rev 2): after the claim write, re-read the row and verify Booked-By matches this booking; on mismatch return "slot just taken" and re-fetch open slots. This verify step is also what makes the page's ISR staleness safe (a booked slot can display for up to 5 min). Acceptable at eval volume.
- Public page **`/free-evaluation/book`** (5-min ISR like `/schedule`): parent name/email/phone + child first name + level — **no new child fields**.
- `POST /api/eval-book`: validate (new `validate-eval-book.ts`, house shape) → rate limit (Phase 0 lib) → claim slot → **reuse `sendEvalConfirmation()` from `src/lib/eval-confirmation-send.ts` unchanged** (renders template, parent `.ics` via `buildDropInIcs()` from `src/lib/email/ics.ts:78`, BCC admin, stamps `Eval Date` on CRM fail-soft at :176-183). It becomes the third caller alongside the coach action (`eval/actions.ts:55`) and the secret endpoint (`eval-confirmation/route.ts:27`).
- **Coach calendar without Google auth:** booking-notification email to Sam with its own `.ics` (`METHOD:REQUEST` variant in `src/lib/email/ics.ts`) so the mail client offers add-to-calendar. First verify whether the existing admin-BCC'd `.ics` already auto-adds — that may be the whole fix. (Rev 2) The `.ics` route also works in Apple Calendar — relevant because Sam's personal working calendar is iCloud — and an **agent-side workflow that creates NGA eval events on the NGA Google Calendar already exists outside this repo**; see Phase 3 item 3 before writing any GCal code here.
- Close the loop: add the `/free-evaluation/book` CTA to the lead-form parent confirmation email and the `/free-evaluation` page — that's what deletes the phone tag. (Rev 2) **The confirmation email is inline HTML inside `src/app/api/lead/route.ts:323-350`** (a minor-PII route), not a template module — name that file in the IPAV scope, and consider extracting it to `src/lib/email/` in the same PR (it's also one of the 7 hardcoded-CRM-ID files; one PR can kill both).
- **Process:** new minor-PII route → full IPAV; invariant tests FIRST: `invariant-eval-book-egress.spec.ts` (egress = Notion + Resend only; recipients = parent + admin only; child fields = first name + level only) and extend the existing eval trigger-parity coverage (`invariant-eval-confirmation-trigger-parity.spec.ts`). Needs Sam's explicit approval before implementation (Slop-Free eval surface).

**1b. Coach Inbox — every pending decision on one page.** `/coach/(authed)/inbox` under the existing `requireCoach` layout, per-row one-tap server actions copying the `eval/actions.ts` pattern. Feasibility verified — mostly assembles existing helpers:
- News triage: `setNewsStatus()` already exists (`src/lib/notion-news.ts:175`); add `fetchNewNews()` (~20 lines; existing fetcher is `fetchApprovedNews`).
- Newsletter drafts: add `fetchPendingDrafts()` + `setDraftStatus()` to `src/lib/notion-newsletter-drafts.ts` (genuinely new — current exports are `fetchApprovedNewsletterDrafts`/`stampDraftsSentAt`); **render the draft body in the inbox by EXPORTING the existing internal `blocksToHtml`/`blocksToText` helpers** (`notion-newsletter-drafts.ts:99,168`) — don't rewrite them (Rev 2). Approval remains approval of read content — the "nothing ships un-reviewed" gate stays intact.
- Crew interest: `fetchActionableCrewInterest()` exists (`notion-crew-interest.ts:148`). (Rev 2) **A status setter also already exists — `markCrewInterestFlag()` (`notion-crew-interest.ts:217`)** — audit whether it covers the inbox action before writing a duplicate `setCrewInterestStatus()`.
- CardFailed commits: add `fetchCardFailedCommits()` (existing fetchers are `fetchActiveCommits`/`findCommitByEmailChildCrew`); `updateCommit()` exists (`notion-crew-commits.ts:209`). Button copy must say a stored-card charge will retry on the next autoreserve tick + confirm step — this matches the existing lastError instructions ("Set back to Active to rebook").
- Pending-count badge on the `/coach` home page.
- Eliminates the daily 4-DB Notion scatter (~30–60 min/week → one ~5–10 min morning pass) and makes the Thu-6pm approval deadline (`vercel.json:22`, `0 22 * * 4`) harder to miss.

### Phase 2 — Delete the weekly hand-work (~3–5 days)

**2a. Recurring-session templates.** Generalize `src/lib/recurring-sessions.ts`: `upcomingTuesdays` (:44) → `upcomingWeekday(weekday)`; move `TEMPLATE` (:22-38)/`TUESDAY_LEVELS` (:16) to `src/data/recurring-templates.ts` (Tuesday Redland + Ridgeview Mon / Westland Wed / Shannon Thu; fields incl. `legacyTitlePrefixes`, `active`); `ensureAllLevelsTuesdays` (:185) → `ensureWeeklyTemplates()` with the same idempotency contract (existence check counts any row for a date|level regardless of Status, so Cancelled rows never resurrect; fail-soft per row). **Critical:** audit live Sessions DB titles first so `legacyTitlePrefixes` matches Sam's hand-created rows, or the first run double-books. Data file, not a Notion DB, for v1 (venues change a few times a year; a one-line PR is fine). Keep the existing cron path + wrap with the Phase 0 alerter. Add `?dryRun=1` returning the would-create list. Extend `e2e/recurring-sessions.spec.ts`.

**2b. Ops page for the curl endpoints.** `/coach/(authed)/ops`: buttons for eval-reengagement, post-eval-followup, camp-outreach — each shows the endpoint's existing `dryRun` output (recipient counts + list), and "Send live" only enables after a preview ran (dryRun-first becomes UI-enforced, not convention). Implement as server actions calling the same shared libs (never proxy `?secret=` URLs). Keep curls as agent fallbacks. Skip cancel-registration curls — the portal already covers them. Trigger-parity spec so Quarantine/OFF-LIMITS segmentation runs through the identical code path.

### Phase 3 — Evidence-gated (build only if Phase 0 alerts show the need)

1. Stripe↔Notion drop-in reconciler cron — **alert-only v1** with the backfill command pre-filled in the email (Slop-Free, own IPAV pass). (Rev 2) Design it as the **drop-in analog of #237** (checkout already write-throughs; the reconciler is the backstop) and reuse the `backfill-dropin.mjs` matching logic.
2. Refund-failure alerting routed into the Phase 0 alerter with a Stripe deep link (payment libs → own approval). (Rev 2) **Must instrument BOTH refund engines** — `cancel-dropin.ts` AND `session-cancel.ts`'s `refundOne` — or half the refund surface stays dark.
3. Google Calendar REST integration for eval bookings — only if the `.ics`-to-coach approach demonstrably fails, and (Rev 2) **only after trying the zero-code option**: route the Phase 1a booking-notification email into the existing agent-side NGA eval-calendar workflow (calendarId nextgenacademypb@gmail.com), which already creates these events today. Repo-side OAuth adds a new long-lived secret surface (LSN-007) for a job an agent already does.
4. Debt as-you-go: checkout consolidation when the next program forces it; typed Notion layer incrementally via `notion-utils.ts`; file splits never as standalone PRs.

### Do NOT build (over-automation red lines)
- Auto-approving newsletter drafts or news (the review gate is load-bearing).
- Auto-creating crew polls from interest rows (Sam owns that decision).
- Auto-retrying CardFailed off-session charges (dispute/trust risk; one informed tap is the ceiling).
- Auto-backfill/auto-refund without dry-run gates.
- GCal-driven slot generation, parent-facing eval reschedule, any new infra (DB, Redis, Sentry).

---

## Critical files
- `src/lib/eval-confirmation-send.ts` — shared eval send path; Phase 1a's booking route becomes its third caller.
- `src/app/coach/(authed)/eval/actions.ts` — the `requireCoach` server-action pattern every inbox/ops action copies.
- `src/app/api/cron/dropin-reminder/route.ts` — representative swallowed-failure `SendOutcome` shape (:74-82) driving the `withCronAlert` design.
- `src/lib/cancel-dropin.ts` + `src/lib/session-cancel.ts` — the TWO refund engines Phase 3 item 2 must both cover.
- `src/lib/recurring-sessions.ts` + `e2e/recurring-sessions.spec.ts` — the seeder to generalize.
- `src/lib/notion-news.ts`, `src/lib/notion-newsletter-drafts.ts`, `src/lib/notion-crew-interest.ts`, `src/lib/notion-crew-commits.ts` — inbox data helpers (several actions already exist).
- `src/app/api/lead/route.ts` — rate-limiter template (:24-46), hardcoded CRM DB ID (:16), AND the inline parent-confirmation email (:323-350) that gets the Phase 1a CTA.

## Verification approach
- Every phase: invariant/pure specs written first (red → green), `npm run test:pure` + lint + `npm run build` green, decision logged in `agent-log.md`.
- Phase 0: deliberately break one cron's env in preview and confirm the alert lands (email, then SMS fallback with Resend disabled).
- Phase 1a: dry-run send, staging end-to-end booking, confirm CRM `Eval Date` stamp and both `.ics` files open in Google + Apple Calendar; egress invariant spec pins Notion+Resend-only.
- Phase 1b/2b: extend coach-session-scope + trigger-parity invariants to the new actions; manual staging pass against real DBs.
- Phase 2a: `?dryRun=1` diff against the live Sessions DB before the first live seed run.
- Per house rules: anything touching payments/minor-PII (Phase 1a eval surface, crew-autoreserve wrapper, Phase 3 items) gets its own IPAV approval — approval for this plan doesn't extend to those PRs individually.

---

## Changelog — Rev 2 deltas (2026-07-01, from senior-engineer verification review)
1. **Refund architecture corrected:** two idempotent engines (`cancelDropIn` ×5 entry points + `executeSessionCancel`), not "six paths through one funnel." Phase 3 item 2 now covers both.
2. **H2 reframed:** the gap is swallowed per-item failures returned as 200 (~6 crons), not "9 of 12 have no alerting" — crew-autoreserve already alerts, 4 crons already return 500. The camp-roster incident was fixed by #237 (2026-07-01), cited as evidence of the class.
3. **Phase 0 additions:** integrate with crew-autoreserve's bespoke alerts; explicit alert-storm posture for the every-2h reconcile cron.
4. **Phase 1a scope:** lead confirmation email located (inline in `lead/route.ts:323-350`, minor-PII); claim-race loser path + ISR-staleness note specified; CRM DB ID cleanup is 7 files, not 4.
5. **Phase 1b cheaper:** `markCrewInterestFlag()` and `blocksToHtml`/`blocksToText` already exist — audit/export instead of writing new.
6. **Phase 3 GCal:** try the existing agent-side NGA calendar workflow before any repo-side OAuth.
7. **Number corrections:** webhook 1,085 lines; 69 explicit `any`s; ~720 pure tests; 12.0k spec lines; 29 invariant specs; two camp crons.
8. **Q3 focus note added** (acquisition vs retention-first tradeoff on Phase 1a build-hours).
