# Agent Decision Log

Append-only. One entry per consequential decision, newest first. Format:
**Situation** (what was true) · **Decision** (what we chose) · **Risk** (what could bite) · **Change** (what moved in the repo).

---

## 2026-06-14 — Agent-action trigger parity: shared attendance core + secret-gated /api/attendance

- **Situation:** `markAttendanceAction` inlined its entire fan-out (Notion `Attendance` write + `ingestToOpenBrain({source:"nga_attendance"})` + `recomputePlayerAttendance` + 2× `revalidatePath`), reachable only by a coach clicking the toggle (cookie auth). An agent that marked attendance by writing the Notion field directly silently skipped the OB activity AND the profile-stat recompute — a whole class of bug where out-of-band writes bypass UI side-effects. The cancel family already had the right shape (`cancelDropIn`/`executeSessionCancel` shared cores + `/api/cancel-registration`); attendance was the gap. Gauntlet-reviewed (5 critics): caught that `revalidatePath` sync-throws outside a request scope (a `.catch()` is a no-op), that the OB `void` ingest makes a fetch-stub assertion racy, that the 3 Notion triggers share `PATCH pages/{id}` shapes, and that the new route is a child-PII egress surface needing its own invariant.
- **Decision:** Extract `markAttendanceCore` into a plain lib (`src/lib/mark-attendance.ts`, NOT `"use server"`) holding the full fan-out; `markAttendanceAction` becomes a thin `requireCoach()` wrapper over it (mirrors `cancelSessionAction → executeSessionCancel`). New `POST /api/attendance` calls the same core. Auth = **Bearer `ATTENDANCE_SECRET`** (Sam's choice — dedicated secret, not the NGA_ADMIN_SECRET mega-secret; isolates blast radius), fail-closed, PII-free ack (`{ok,pageId,status,idempotent}` only). Gauntlet fixes integrated: `revalidatePath` in a sync `try/catch` inside the core; core returns the (never-throwing) OB ingest promise so the route `await`s it (durable on Vercel + deterministic in tests) while the coach action ignores it (fire-and-forget UX preserved); idempotency guard skips the write+OB when `Attendance` already equals the requested value (tames agent retries — coach UI never sends same-value repeats); `"clear"→null` mapping + invalid-value rejection moved into the core verbatim.
- **Risk:** Touches `actions.ts` (Minor-PII slop-free) — but the coach click path is behavior-preserving (same fan-out, now via the core). New route grants attendance-write to any `ATTENDANCE_SECRET` holder, bypassing `COACH_ALLOWED_EMAILS` — broader authority than the action, same shape as the existing cancel-registration admin curl; logged in source-inventory §8 risk #9. Until `ATTENDANCE_SECRET` is set in Vercel the route 401s every call (safe). OB ingest now awaited on the agent path only — coach path unchanged.
- **Change:** New `src/lib/mark-attendance.ts`, `src/app/api/attendance/route.ts`; refactor `src/app/coach/(authed)/[slug]/actions.ts` (delegate + drop 5 now-unused imports); `.env.example` (+ATTENDANCE_SECRET); `docs/source-inventory.md` (§2/§3/§7/§8 + deferred-surfaces §8a); `CLAUDE.md` (Slop-Free list + env section). Tests FIRST (red on missing module): `e2e/invariant-attendance-agent-gate.spec.ts` (fail-closed), `e2e/mark-attendance.spec.ts` (9 cases — Present/No-show/clear/no-contact/idempotent/not-found/write-fail/missing/invalid, 3 triggers discriminated by body + the hardcoded player DB id), `e2e/invariant-attendance-pii-egress.spec.ts` (egress→Notion+OB only, ack PII-free), `e2e/mark-attendance-parity.spec.ts` (structural pin: action calls the core once, no inline triggers). **Mutation check:** each of the 3 triggers commented out in turn → a DISTINCT assertion went red (OB length, player query/write length, attendance-write length); restored green. Full `test:pure` (524) + lint + build green. Draft PR, no merge (production first-PR pause + minor-PII).

## 2026-06-13 — Backfill script reaches webhook parity (session count + Player CRM)

- **Situation:** `scripts/backfill-dropin.mjs` only created the roster row — it skipped the webhook `after()` block's `incrementSessionRegistered` and `syncPlayerFromDropIn`. So every hand-backfill silently under-counted the session (wrong fill meter / a Full session reads Open) and left the registrant out of the Player CRM. Surfaced when the Landon backfill (same day) drifted WJHS 6/14 to 5-vs-6.
- **Decision:** Port both side-effects into the script as best-effort, non-throwing steps that run only after a *new* roster row is created (the existing idempotency guard exits before them on re-run, so no double-count). Kept the repo's standalone-`.mjs` convention (no tsx; the libs import via `@/` alias) — raw-`fetch` ports faithful to the source functions, each commented "KEEP IN SYNC with src/lib/…". Player-CRM write is the SAME egress + SAME child fields (first name + birth-year→age) the webhook already uses — not a new PII destination.
- **Risk:** Duplicated logic can drift from `notion-sessions.ts` / `notion-player-sync.ts` (mitigated by sync-comments + the fact the pure helpers are unit-tested in the lib). Faithful-port caveat: like the live webhook, `findPlayerRow` matches on Parent Email/Phone, so an eval-created CRM row lacking contact info won't be found and a new player row is created — pre-existing lib behavior, deliberately not "fixed" here to avoid divergence.
- **Change:** `scripts/backfill-dropin.mjs` only (no app code, not a slop-free-zone TS file). `node --check` + eslint clean; both ported flows validated READ-ONLY against live Notion (increment math on the real session row; `findPlayerRow` query shape). No script-level test harness exists in the repo (convention); logic mirrors lib functions already covered by `e2e/notion-{sessions,player-sync}.spec.ts`.

## 2026-06-13 — Drop-in roster write is fail-soft on the optional `Source` column

- **Situation:** #174 added a `Source` select write to the drop-in roster create, but the `Source` property was never created on the NGA Drop-in Registrations Notion DB. From the 6/12 deploy on, every paid drop-in `checkout.session.completed` got a deterministic Notion 400 → `"permanent"` → paid-but-unregistered + alert email. First (and only) victim: Landon Lee, 6/13, for the 6/14 WJHS session. Root cause closed separately by adding the `Source` column to the DB; this hardens the code so a missing/renamed optional column can never again strand a registration.
- **Decision:** In `createDropInRegistrationResult`, if the create fails with a *permanent* status AND `Source` was in the payload AND the error body names `Source`, drop `Source` and retry the create once. The core roster row (source of truth for reminders/check-in/cancel refunds) lands; attribution degrades to blank. Happy path is unchanged (single call, Source included). Scoped tightly to Source-named errors so a real permanent failure (bad Status, etc.) is NOT masked.
- **Risk:** Touches `notion-dropins.ts` (Minor-PII slop-free zone) — but only the create's failure path; no change to the property set on success, idempotency, child-PII flow, or refund logic. The substring match (`bodyText.includes("Source")`) could in theory match a Source-bearing parent name in an unrelated 400 → at worst one harmless retry-without-Source; it never suppresses a non-Source failure (pinned by test).
- **Change:** `src/lib/notion-dropins.ts` (extracted `postPage`, added the one-shot Source-stripping retry). New pins in `e2e/notion-dropins.spec.ts` (4 specs: retries-without-Source-and-lands, happy-path-single-write, non-Source-permanent-not-masked, transient-not-retried). Mutation-checked both the fail-soft behavior (red before fix) and the no-mask guard (forced retry-on-any-permanent → guard fails). Full `npm run test:pure` (508) + lint + build green.

## 2026-06-12 — Secret split completed for referral + newsletter-unsub; all 5 token secrets live in Vercel (#181)

- **Situation:** After #180, referral and newsletter-unsub tokens still verified single-secret — setting their (already-documented) env vars would have broken every unsubscribe link in past issues and every referral link in old welcome emails. Both vars were unset in Vercel.
- **Decision:** Same `signingSecrets` dual-verify as the other three families; then ALL FIVE dedicated secrets set in Vercel (Sensitive, Production-only, mirroring NGA_ADMIN_SECRET scope) and prod redeployed. Sequencing mattered: the Vercel "Redeploy" toast targeted the pre-#181 deployment — redeploying THAT with the new vars would have run single-verify code with a dedicated secret set (the exact brick this PR prevents). Redeployed the #181 build explicitly instead.
- **Risk:** Legacy-era links now ride the fallback path until NGA_ADMIN_SECRET rotates (intended). Pre-existing CI flake fixed in passing: coach-auth tamper tests replaced the last char with a FIXED char, silently no-op'ing ~1/64 runs (token embeds Date.now()).
- **Change:** `src/lib/{referral-token,newsletter-token}.ts`, 5 new invariant tests, de-flaked coach-auth.spec.ts, `.env.example` comments. Secrets recorded in the operator env registry.

## 2026-06-12 — Security hardening: timing-safe gates + NGA_ADMIN_SECRET split (Sam-approved slop-free edits)

- **Situation:** Risk log #1–3: all 14 route-gate secret compares were plain `!==` (timing side-channel), and NGA_ADMIN_SECRET both gated 5 admin routes (2 refund-capable) and signed all 5 HMAC token families — one leak forged everything. Sam approved both fixes ("yes do both").
- **Decision:** New `src/lib/secret-compare.ts` (`secretEquals` constant-time + fail-closed; `signingSecrets` dedicated-first key resolution). All 14 gates swapped. cancel/session-cancel/commit tokens sign with dedicated secrets when set, **verify against dedicated AND legacy** — outstanding non-expiring links in parent inboxes survive the env-var flip. Tests written first (3 failed against old behavior), source-level mutation check confirmed they're load-bearing.
- **Risk:** Until the new env vars are set in Vercel, signing still uses the legacy key (no behavior change at deploy — by design). The legacy-era same-key edge (a session-cancel token decodes as a `session:`-prefixed garbage cancel id, bounded to a no-op lookup) is pinned by test and disappears once distinct secrets are live. The `?secret=` query-param fallback on notion-session-webhook is retained deliberately (Notion header limitation).
- **Change:** `src/lib/{secret-compare,cancel-token,session-cancel-token,commit-token}.ts`, 14 route files (compare swap + import only), `.env.example` (+3 vars), `e2e/invariant-secret-separation.spec.ts` (10 tests). Operator follow-up: set `CANCEL_TOKEN_SECRET` / `SESSION_CANCEL_TOKEN_SECRET` / `COMMIT_TOKEN_SECRET` in Vercel + both env registries when ready.

## 2026-06-12 — Verification harness pins youth-data invariants as pure specs

- **Situation:** 41 page routes, 40 API routes, all child data flowing Stripe→Notion with HMAC-token/cookie gates; 41 existing pure specs covered templates and helpers but nothing pinned the auth gates, webhook idempotency, consent mapping, or child-PII egress. CI runs `test:pure` only.
- **Decision:** Extend the playwright.pure pattern with 10 invariant specs + a throw-on-unstubbed global-fetch stub and offline Stripe signature generation, so the highest-stakes behavior runs deterministically in CI on every PR. Tests observe slop-free files; zero production edits.
- **Risk:** Route handlers register `after()` comms that may throw outside a Next request scope — specs settle either way and assert on captured calls, so a future Next behavior change could silently skip response-status assertions on the create path. Twilio rides its own SDK transport, so the egress spec's host allowlist covers fetch-based egress only (SMS is separately consent-hard-gated).
- **Change:** `e2e/fixtures/{fetch-stub,stripe-sessions}.ts`, 10 `e2e/invariant-*` / `webhook-*` specs (44 tests), all passing with the existing 430.

## 2026-06-12 — Mutation check proves the new specs are load-bearing

- **Situation:** A test that cannot fail proves nothing; 4 prior sessions established the pattern of verifying failure states explicitly.
- **Decision:** Perturb three fixtures (properly-signed rebind token expected null; valid webhook signature expected 400; exact-string consent expected false) and require the suite to FAIL, then restore green.
- **Risk:** Fixture-side mutation proves assertions are live but not that every source regression is caught — source-side mutation was skipped because all guarded files are slop-free.
- **Change:** No repo change; mutation run failed 3/3 as required, restore run 19/19 green.

## 2026-06-12 — Governance docs anchored to the audited tree, counts derived at runtime

- **Situation:** A prior community-os audit (same day) showed hardcoded verification counts were wrong at planning time (crons 27≠26, p3 routes ≠35) and that `src/app` vs `app` layout splits silently zero out naive globs.
- **Decision:** `docs/source-inventory.md` states counts as "@ a591bbd, re-derive via git ls-tree"; classification carries evidence per verdict; risk log documents rather than fixes (fixes are separate approvals).
- **Risk:** The inventory goes stale as main moves; staleness column dates are squash-PR dates, not semantic change dates.
- **Change:** `docs/source-inventory.md`, `docs/hostile-reviewer.md`, CLAUDE.md governance sections, `skills/` (3 procedures).

## 2026-05-30 (backfilled from code) — Cancel tokens are non-expiring and keyed on NGA_ADMIN_SECRET

- **Situation:** Parents cancel anywhere from a week out to morning-of; an expiry window adds friction without real protection.
- **Decision:** Non-expiring HMAC token binding exactly one checkout-session id; signing key reuses `NGA_ADMIN_SECRET` to avoid a new env var (rationale inline at `src/lib/cancel-token.ts:14-21`).
- **Risk:** `NGA_ADMIN_SECRET` is a mega-secret — bearer gate for 5 admin routes (2 refund-capable) AND the HMAC key for all 5 token libs. One leak = forge any token + issue refunds. Rotation invalidates every outstanding link (pinned by test).
- **Change:** Documented in `docs/source-inventory.md` risk log #1; revisit key separation if blast radius grows.

## 2026-06-03 (backfilled from code) — Webhook acks fast; comms ride after()

- **Situation:** Awaiting every email/SMS/coupon before 200'ing blew Stripe's webhook timeout on cold starts → retry storm, ~50% error rate.
- **Decision:** Create the Notion roster row (the only critical write) on the response path; everything else runs via `after()` post-response with `maxDuration: 60`. Transient Notion failures 500 (Stripe retries); permanent ones alert + ack (operator backfills via `scripts/backfill-dropin.mjs`).
- **Risk:** `after()` work that throws is lost silently — a failed parent confirmation email leaves a paid-but-unnotified registration (admin email is the catch).
- **Change:** Documented at `src/app/api/stripe/webhook/route.ts:33-39, 394-418`; idempotency + transient/permanent split pinned by `e2e/webhook-idempotency.spec.ts`.

## 2026-06-13 — WhatsApp parent-group invite on every registrant email

- **Situation:** The Next Gen parent WhatsApp invite only rode along on a parent's *first* touch (booking confirmation gated by `isFirstTimer`, lead/Yellow Ball confirmations, newsletter welcome). Sam wants every *registered* family to have a standing way to reach Coach Sam and each other.
- **Decision:** Render the existing (brand-approved) `whatsappInviteHtml()`/`whatsappInviteText()` block unconditionally on all session-related registrant emails: booking confirmation, day-before reminder, post-session recap, and no-show rebook. Excluded cancellation/refund comms (off-tone) per Sam. Lead/Yellow Ball confirmations left first-timer-gated (leads aren't registrants). Removed the now-dead `isFirstTimeParent()` lookup + `parentEmailForLookup` from the Stripe webhook (helper still used by yellowball-lead).
- **Risk:** Edits touch the payments webhook (slop-free zone), but only drop a Notion read + flip a copy flag — no change to roster write, idempotency, refunds, or PII flow. No new child-PII egress. Copy itself unchanged (placement only), so no new brand-review surface.
- **Change:** `src/app/api/stripe/webhook/route.ts`, `src/lib/email/{booking-confirmation,booking-reminder,post-session,post-session-rebook,whatsapp-invite}.ts`; new pin `e2e/whatsapp-invite.spec.ts` (4 specs). Full `npm run test:pure` (493) + lint + tsc green; webhook build blocked only by sandboxed Google Fonts fetch.
