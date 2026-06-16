# UI ↔ Agent Parity Audit — nextgen-academy

_Phase 1: actions touching Stripe/refunds, parent comms (email/SMS), or minor PII. Read-only audit, 2026-06-16. Every row verified against real source (file:line) by a verifier separate from the surface-mapper (writer ≠ reviewer)._

## Gold-standard pattern (target)
Thin route/action over an **auth-agnostic engine lib** + a **dedicated Bearer secret** (constant-time `secretEquals`, fails closed, in the **Authorization header**, NOT the query string, NOT the shared `NGA_ADMIN_SECRET`) + a **trigger-parity invariant spec**. Exemplars: `applyAttendance` (`src/lib/attendance.ts`) pinned by `e2e/invariant-attendance-trigger-parity.spec.ts`; `authorizeSessionOps` (`src/lib/session-ops-auth.ts`) pinned by `e2e/invariant-admin-session-ops-parity.spec.ts`; `confirmCrew` pinned by `e2e/invariant-crew-confirm-trigger-parity.spec.ts`.

## Parity matrix

| Action | UI path | Agent path | Shared engine | Class | Parity test | Auth | Triggers (who fires) |
|---|---|---|---|---|---|---|---|
| Session-wide cancel | `coach/(authed)/[slug]/actions.ts:168` + token `coach/cancel-session/[token]/actions.ts:15` | `api/admin/sessions/cancel/route.ts:17` | `lib/session-cancel.ts:221` | **PINNED** | `invariant-admin-session-ops-parity.spec.ts:120` | dedicated `SESSION_OPS_SECRET` Bearer header | refund+email+SMS+Notion flag+status+revalidate (all paths via engine) |
| Session reschedule | admin cookie → `api/admin/sessions/reschedule/route.ts:14` | Bearer → same route | `lib/session-reschedule.ts:119` | **PINNED** | `invariant-admin-session-ops-parity.spec.ts:120` | dedicated `SESSION_OPS_SECRET` Bearer header | Notion re-date+flag reset+parent email+session advance (both, **no Stripe** by design) |
| Drop-in cancel (per-row) | `coach/(authed)/[slug]/actions.ts:44` | `api/cancel-registration/route.ts:13` + Stripe webhook `:897` + parent self-serve `schedule/cancel/actions.ts:23` | `lib/cancel-dropin.ts:160` | SHARED | **auth-gate only** (`invariant-cancel-route-auth.spec.ts`) — no trigger-parity | ⚠️ admin route = `?secret=NGA_ADMIN_SECRET` **query string** | Notion status+count, Stripe refund (UI refund path only), email+SMS, revalidate |
| Camp cancellation | **NONE** | `api/cancel-camp-registration/route.ts:21` | `lib/cancel-camp.ts:110` | **AGENT-ONLY** | **NONE** | ⚠️ `?secret=NGA_ADMIN_SECRET` query string | Notion withdraw, Stripe refund (idempotent), email+SMS, **OB ingest** |
| Cluster refund | **NONE** | Stripe webhook `api/stripe/webhook/route.ts:980` (always-100% on roster fail) | `lib/cluster-refund.ts:13` (**dead — 0 prod callers**) | **DIVERGENT** | NONE (unit only) | Stripe signature | webhook refunds 100%; policy engine encodes a fee schedule **nobody calls** |
| Eval-confirmation send | `coach/(authed)/eval/actions.ts:42` | `api/eval-confirmation/route.ts:11` | `lib/eval-confirmation-send.ts:89` | SHARED | **NONE** (gate-only `invariant-eval-admin-gate.spec.ts`) | ⚠️ `?secret=NGA_ADMIN_SECRET` query string | parent email + .ics + Notion Eval-Date stamp (both via engine) |
| Stripe webhook / referral reward | **NONE** (webhook by nature) | `api/stripe/webhook/route.ts:268` → `lib/referral-rewards.ts:72` | `lib/referral-rewards.ts:72` | AGENT-ONLY | **PARTIAL** — drop-in/camp/league idempotency pinned; **referral mint not pinned** | Stripe signature (correct) | coupon×2 mint + dual parent emails + Notion flip; idempotency = Notion bool flipped **after** mint |
| Comms crons (reminder, post-session, weekly-newsletter, crew-autoreserve) | **NONE** (no manual re-fire) | `api/cron/*/route.ts` | inline; only `lib/crew-charge.ts` shared | AGENT-ONLY | NONE | ✅ dedicated `CRON_SECRET` Bearer header | crew-autoreserve = Stripe off-session $20 charge + roster + refund-on-fail; others = email/SMS + flag |
| PII intake (lead, yellowball, schools, league, newsletter, crew-interest, post-eval-followup) | 6 public form POSTs | post-eval-followup `api/post-eval-followup/route.ts:99` | **NONE** (each route hand-rolls fan-out) | UI-ONLY | NONE | public (rate-limit) + post-eval = ⚠️ `?secret` query string | Notion + Resend + OB per route; **6 hand-rolled copies** |

## Gaps ranked by blast radius

### GAP-N1 — Camp cancellation: refund + minor-PII, AGENT-ONLY, query-string secret, unpinned `[M, slop-free]`
`api/cancel-camp-registration` issues a **Stripe refund** + Notion withdrawal + **OB ingest** + parent email/SMS, has **no human UI override**, and is gated by `?secret=NGA_ADMIN_SECRET` in the query string (leaks via access logs/Referer, rides the mega-secret blast radius). No trigger-parity spec — a refactor could silently drop the refund/OB/comms.
**Smallest fix:** mint a dedicated `CAMP_OPS_SECRET`, gate the route on an `Authorization: Bearer` header via an `authorize()` helper (mirror `authorizeSessionOps`); add `invariant-camp-cancel-trigger-parity.spec.ts`. Engine already auth-agnostic + idempotent.

### GAP-N2 — Drop-in cancel: refund-capable admin route on query-string mega-secret, unpinned `[M, slop-free]`
Engine (`cancel-dropin.ts`) is correctly shared across all 4 paths, but the admin route carries `NGA_ADMIN_SECRET` in the query string — the exact anti-pattern `session-ops-auth.ts:18-20` warns against — and only an auth-gate test exists, no trigger-parity.
**Smallest fix:** dedicated `DROPIN_OPS_SECRET` Bearer header (added **alongside**, not replacing, the legacy kill-switch); `invariant-cancel-dropin-trigger-parity.spec.ts` pinning all 4 paths.

### GAP-N3 — Eval-confirmation: comms + minor-PII, SHARED but unpinned, query-string secret `[M, slop-free]`
Both UI (`confirmEvalAction`) and agent route share `sendEvalConfirmation`, but nothing pins the email+.ics+CRM fan-out, and the agent route uses `?secret=NGA_ADMIN_SECRET`.
**Smallest fix:** `invariant-eval-confirmation-trigger-parity.spec.ts` (mirror attendance spec); optionally a dedicated `EVAL_CONFIRMATION_SECRET` header via a cookie-OR-Bearer `authorize()`.

### GAP-N4 — Referral reward: coupon mint + dual comms unpinned; theoretical redelivery race `[S, slop-free]`
Coupon mint + both parent emails are **not pinned** by any invariant. Idempotency rests on a Notion `Referral Rewarded` bool flipped **after** mint/send. In practice the event-level roster-row guard (`route.ts:345`) short-circuits a redelivered `checkout.session.completed` before referral runs, so this is a *theoretical* parallel-delivery window, not an active bug — but it's untested.
**Smallest fix (test-only):** `invariant-webhook-referral-idempotency.spec.ts` driving a redelivered referred-subscriber checkout, asserting coupons mint + emails send **exactly once**. Optionally hoist the flag-flip to a pre-mint reservation.

### GAP-N5 — post-eval-followup: comms + CRM write on query-string mega-secret `[part of intake row, slop-free]`
Sends a parent email + PATCHes the Notion player row, gated by `?secret=NGA_ADMIN_SECRET` query string (Minor-PII Slop-Free Zone, "the 3 eval routes").
**Smallest fix:** `Authorization: Bearer POST_EVAL_SECRET` header (dedicated secret).

### GAP-N6 — PII intake routes: 6 hand-rolled fan-outs, HIGH drift `[M, lower urgency]`
Each public intake reinvents rate-limit + IP + HTML-escape + Notion + Resend + OB; already inconsistent (crew/league inline raw escape vs shared brand chrome). No engine, no parity spec → a dropped trigger or escape gap is invisible. Public-by-design + "show-pony"/prototype tier, so urgency is anti-drift, not auth.
**Smallest fix:** extract one auth-agnostic intake engine (validate → Notion → Resend → OB) + shared rate-limit/escape util; one parity spec per intake.

### GAP-N7 — Cluster refund: dead policy engine vs always-100% webhook refund `[M, defer]`
`cluster-refund.ts` (the $25-retained / non-refundable-window policy the parent email promises) has **zero production callers**; the live webhook always refunds 100% on roster-write failure, and parent/min-size refunds are done by hand in Stripe. Clusters are prototype-tier — acceptable now; wire on promotion.

## Already correct (don't re-litigate)
- **Session-wide cancel** + **session reschedule** — the gold-standard exemplars: auth-agnostic engine + dedicated `SESSION_OPS_SECRET` header Bearer + pinned parity spec. No drift.
- **Comms crons auth** — all four use `secretEquals(authHeader, \`Bearer ${CRON_SECRET}\`)` (header, constant-time, fails closed). They're inherently AGENT-ONLY (scheduled jobs), so PINNED parity is N/A.
- **Reschedule fires no Stripe** by design (carry-over keeps paid spots) — pinned that `api.stripe.com` is never contacted.

## Live probe evidence (2026-06-16)
**NGA attendance agent path — `POST https://nextgenpbacademy.com/api/coach/attendance` (Bearer `ATTENDANCE_SECRET`)** — PASSED against production with a throwaway Notion drop-in row dated 2020-01-01 (invisible to `/schedule` + all crons):
- Auth gate: wrong Bearer → **401** (fails closed).
- FIRE `Present` → `200 {ok, status:"Present", idempotent:false}`; Notion `Attendance` select read back as **Present**.
- All three triggers confirmed: Notion write ✓, **OB activity** ✓ (OB contact now carries `source:nga_attendance`), stat recompute ran (no-op — no test player CRM row, fail-soft as designed).
- Re-fire `Present` → `idempotent:true`, no duplicate.
- Cleanup: throwaway row archived; read-back gone. (Residue: one disposable OB contact `Parity Probe` / example.com, no thoughts — no contact-delete tool exposed, trivial manual cleanup.)

**L&D community RSVP agent path — BLOCKED (not a defect).** `AGENT_INTERNAL_AUTH_SECRET` is set Sensitive/unreadable on Vercel and cannot be pulled, so the L&D agent JSON routes can't be fired headlessly from a dev box (every L&D agent route gates on that one secret). This is correct security posture — but it means the agent path can only be exercised from a context that already holds the secret. Probe deferred.

## Cross-cutting recommendation
Three refund/comms surfaces (camp, drop-in, eval) and post-eval-followup all still carry their secret in the **query string** on the shared `NGA_ADMIN_SECRET`. Standardize them on the `authorizeSessionOps` pattern (dedicated header Bearer per surface) so the refund-capable blast radius is isolated — this is the same hardening that already shipped for session-ops and attendance.

> **All NGA fixes above are in Slop-Free Zones (Payments / Auth-tokens / Minor-PII)** → each requires the IPAV loop (invariant test first, fail-before/pass-after, mutation-check, `agent-log.md`) + Sam's explicit approval. Tests *observe* these files; they never modify them — so the test-only fixes (N3, and the test halves of N1–N3) are the lowest-risk first moves.
