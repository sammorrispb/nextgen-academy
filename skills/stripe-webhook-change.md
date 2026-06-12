# Skill: Changing the Stripe webhook (pre-flight)

`src/app/api/stripe/webhook/route.ts` is SLOP-FREE: separate explicit approval from Sam BEFORE any edit, even a one-liner. Then:

## Pre-flight checklist

1. **IPAV first.** Investigate → Propose (files, invariants at risk, rollback) → Sam approves → only then code.
2. **Know the architecture before touching it** (route.ts:33-39): the Notion roster-row create is the ONLY critical work on the response path; everything else (email, SMS, referral, count bump, ISR revalidate) rides `after()` post-response. Never move a critical write into `after()`; never add an `await`-everything path back (that caused the pre-2026-06 retry storm).
3. **Idempotency is sacred.** Any new branch that creates rows or sends comms needs a find-by-checkout-id guard (or state-flag equivalent) — Stripe redelivers every event. The transient(500-retry)/permanent(alert+ack) split on Notion failures must survive your change.
4. **Routing contract:** `kind=camp|league|cluster` never touch the drop-in roster DB; non-drop-in payments (no `session_id` metadata) are acked and skipped. Pinned by `webhook-routing.spec.ts` — extend it if you add a kind.
5. **Metadata is the consent record.** `display_consent`/`sms_consent` flip only on exact `"true"`; `sms_consent_text` is stored verbatim for audit. New metadata keys: update `e2e/fixtures/stripe-sessions.ts` factories in the same PR.
6. **Tests fail first.** Extend the relevant spec (`webhook-signature` / `webhook-idempotency` / `webhook-routing` / `invariant-consent-gating` / `invariant-child-pii-egress`) so it FAILS against the old behavior, then implement, then green, then mutation-check.
7. **Full gate before push:** `npm run test:pure` + `npm run lint` + `npm run build` all green. Run `docs/hostile-reviewer.md` items 1-5, 11-13, 15 against the diff.
8. **After merge:** verify live with a Stripe test event (Stripe Dashboard → webhook → send test event) and watch the Vercel function logs; confirm exactly one Notion row.
9. **Log the decision** in `agent-log.md`.
