# Hostile Reviewer Checklist — NGA

Run this against ANY diff touching payments, auth/tokens, or minor PII (the slop-free zones in CLAUDE.md), and on demand via `skills/hostile-review.md`. The reviewer's job is to ATTACK the change — assume the author was careless and hunt for the kill. Every item is NGA-specific; generic lint is not hostile review.

For each item: PASS / FAIL / N-A with one line of evidence (file:line).

## Child data (the moat — review hardest)

1. **PII echo:** Does any route/page echo `child_first_name`, `child_birth_year`, or parent contact in a response body, error message, log line, or URL? (Webhook ack is pinned PII-free by `invariant-child-pii-egress.spec.ts` — new surfaces aren't.)
2. **Unscoped child read:** Is any child-data read reachable WITHOUT the coach cookie+allowlist composition or a correctly-scoped one-row token? New admin/coach pages must go through `requireCoach()` / `requireAdmin()`-style gates, never ad-hoc checks.
3. **New child field:** Does the diff collect anything beyond first name + birth year (DOB, school, medical, photo)? That needs Sam's explicit approval BEFORE the code exists.
4. **New egress:** Does child data flow to any destination besides Notion and Resend-to-parent/admin? Includes "harmless" telemetry — `/api/analytics` and Open Brain ingest must never gain child PII.
5. **Consent bypass:** Any SMS path that doesn't run through `sendSms()`'s consent hard-gate? Any consent flag set from something other than the exact string `"true"`? Any send to a number/address that isn't the parent's?

## Tokens & auth

6. **Token scope growth:** Does any HMAC token's payload now authorize more than one row/operation? (Today every token binds exactly one registration/subscriber.) A token that can enumerate or act on multiple children is a critical finding.
7. **Compare discipline:** Any new secret compared with `==`/`!==`/`includes` instead of `timingSafeEqual`? (Known accepted offenders: route-level bearer gates + notion-session-webhook — documented in `docs/source-inventory.md` risk log #2-3. New code doesn't get that grandfather clause.)
8. **Fail-open gate:** Does any gate ADMIT when its env secret/allowlist is unset? Every gate must fail closed (pinned for the current routes by the `invariant-*` specs; verify new ones match).
9. **Mega-secret blast radius:** Does the diff hang anything NEW off `NGA_ADMIN_SECRET`? It already gates 5 admin routes and signs 5 token families. New capabilities need their own secret with documented rotation impact.
10. **Secrets in URLs:** Any new secret accepted via query param (it lands in access logs) or stamped into a link that gets forwarded/logged?

## Money

11. **Webhook idempotency:** Does any new webhook branch create rows/send comms WITHOUT a find-by-checkout-id guard (or equivalent) ahead of it? Stripe redelivers; exactly-once is on us.
12. **Refund caps:** Does any refund path allow refunding more than was paid, or refunding the same intent twice? (`resolveRefundCents` validates amounts — new paths must reuse it.)
13. **Silent revenue-off:** Does the change introduce an env-gated 503/skip that could leave a revenue path dark with no alert? (Known pattern: camp/league checkout ship-dark — risk log #6.)

## Operational

14. **Notion-schema "migration":** Does the diff rename/retype a Notion property that an existing query filter or cron depends on? Notion fails these silently (empty results, not errors) — grep every property-name string the change touches across `src/lib/notion-*.ts` and the crons.
15. **after() loss:** Is any NEW critical write placed inside `after()` (where a throw is silently lost)? Critical writes belong on the response path; only best-effort comms ride after().
16. **Cron gating:** Does any new scheduled/triggered endpoint lack the CRON_SECRET fail-closed block (500 unset / 401 mismatch) that all 8 current crons share?

## Verdict block (paste in PR/review)

```
HOSTILE REVIEW — <date> — <diff/PR>
Items: 16 → PASS n / FAIL n / N-A n
Kills found: <list or none>
Verdict: APPROVE / BLOCK (FAILs are blocking until resolved or Sam waives)
Logged: agent-log.md entry <yes/no>
```
