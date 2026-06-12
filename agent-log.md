# Agent Decision Log

Append-only. One entry per consequential decision, newest first. Format:
**Situation** (what was true) · **Decision** (what we chose) · **Risk** (what could bite) · **Change** (what moved in the repo).

---

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
