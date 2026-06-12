# Skill: Add an invariant test (pure spec)

Use when pinning a security/money/PII behavior so CI catches regressions. Pattern proven by the 10 `e2e/invariant-*` / `webhook-*` specs (2026-06-12).

## Recipe

1. **Pick the invariant, one sentence, adversarial.** "A token for registration A must never act on B." Not "test the token lib."
2. **Pure spec, existing infra.** New file `e2e/invariant-<name>.spec.ts`. Pure specs import modules directly in Node and run in CI via `npm run test:pure` with ZERO config changes (`playwright.pure.config.ts` only ignores browser specs). If your spec drives a browser page, it does NOT belong in this pattern — add it to the ignore list instead.
3. **Env BEFORE import.** Set every env var the module reads at the top of the file, before the `import` of the module under test (see any existing invariant spec). Per-file env is isolated — each spec file gets its own worker.
4. **Network = FetchStub.** `import { FetchStub } from "./fixtures/fetch-stub"`. Register rules first-match-wins (specific before catch-all); any unstubbed URL THROWS, which is itself an egress assertion. `stub.reset()` in `beforeEach` (clears calls AND rules — rules leak across tests otherwise; that bug cost a debugging cycle on day one), `stub.uninstall()` in `afterEach`.
5. **Stripe webhooks: sign for real.** Use `signedHeader()` from `e2e/fixtures/stripe-sessions.ts` — Stripe's own offline test-helper. Never mock `constructEvent`.
6. **Route handlers:** construct `new NextRequest(url, { method, body, headers })` and call the exported `POST` directly. Paths that reach `after()` may throw outside a Next request scope — settle with `.catch()` and assert on `stub` captures (the critical write lands before `after()`).
7. **Gates: assert fail-closed + zero calls.** Wrong secret → 401 AND `stub.calls.length === 0`. Also test the UNSET-env case — fail-open-on-missing-env is the classic regression.
8. **Mutation-check before claiming done.** Perturb the fixture so the invariant should fail (sign with the right secret where you expect rejection, etc.), run, CONFIRM the spec fails, restore, confirm green. A spec that can't fail is decoration.
9. **Log it.** One `agent-log.md` entry (Situation · Decision · Risk · Change) if the invariant is new.

## Don'ts

- Don't edit slop-free files to make them "more testable" — tests observe, never modify.
- Don't duplicate existing coverage (`coach-auth.spec.ts` owns token mechanics; the invariant spec owns gate composition).
- Don't assert on log output or internal call order — behavior only.
