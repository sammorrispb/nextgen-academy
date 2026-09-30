# Skill: Add an invariant test (pure spec)

Use when pinning a security/money/PII behavior so CI catches regressions. Pattern proven by the 10 `e2e/invariant-*` / `webhook-*` specs (2026-06-12). Their env handling predates step 3. For env, copy `e2e/invariant-linkdink-roster-egress.spec.ts` instead.

## Recipe

1. **Pick the invariant, one sentence, adversarial.** "A token for registration A must never act on B." Not "test the token lib."
2. **Pure spec, existing infra.** New file `e2e/invariant-<name>.spec.ts`. Pure specs import modules directly in Node and run in CI via `npm run test:pure` with ZERO config changes (`playwright.pure.config.ts` only ignores browser specs). If your spec drives a browser page, it does NOT belong in this pattern — add it to the ignore list instead.
3. **Env lives in hooks and gets restored; module scope is read-only.** At module scope, only declare things: constants, fixtures, the `FetchStub`, and a snapshot of the env keys you will touch. Set env inside `test.beforeEach`, or `beforeAll` when no test changes it. `delete` every key that must be absent. Every key a hook *or a test body* changes goes in `TOUCHED_ENV`: `beforeEach` resets it and `test.afterAll` puts it back:

   ```ts
   const TOUCHED_ENV = ["RESEND_API_KEY", "NOTION_API_KEY", "OPEN_BRAIN_INGEST_URL"] as const;
   const savedEnv = Object.fromEntries(TOUCHED_ENV.map((k) => [k, process.env[k]]));

   test.beforeEach(() => {
     process.env.RESEND_API_KEY = "re_test";
     process.env.NOTION_API_KEY = "ntn_test";
     delete process.env.OPEN_BRAIN_INGEST_URL; // absent is not the default here
   });

   test.afterAll(() => {
     for (const key of TOUCHED_ENV) {
       const value = savedEnv[key];
       if (value === undefined) delete process.env[key];
       else process.env[key] = value;
     }
   });
   ```

   `e2e/invariant-linkdink-roster-egress.spec.ts` is the working example. Never assign or delete env at module scope, and never call a helper that does from there. Calling `setWebhookTestEnv()` from a hook is fine; add the five keys it sets to `TOUCHED_ENV`. A module-scope snapshot is right for the default serial mode. If a file opts into `mode: "parallel"`, take the snapshot in `beforeAll` instead, because each test then runs its own `beforeAll`/`afterAll`. The section below explains why.
   - **Unmentioned is not unset.** A key your spec never touches can still be present, because another spec set it. It can switch on a branch your stub rules don't cover: the stub throws, fail-soft code swallows the error, and the test still passes. If a test needs a key absent, `delete` it in the hook. This is live (2026-09-30): six specs make extra Notion calls only in the full suite, through DB ids that other files set, and which DB they query changes from run to run.
   - **The module under test must read env per call** (inside the function), not into a module-level `const`. A spec can't control an import-time read: imports are hoisted above your assignments, and the module cache keeps whatever the first importer in that worker saw. An `await import()` in a hook is no fix either: if an earlier file in the same worker already imported the module, you get that cached copy. In `src/` today, `NEXT_PUBLIC_SITE_URL` is read into a module-level constant (`SITE_ORIGIN`, once `SITE_URL`) in 28 places, 16 of them in modules the pure specs import. A few page-level flags are read at import too. Don't write a test that needs a non-default value of an import-time read. Make the module read per call first, under IPAV if it's a Slop-Free file.
   - **The module also must not cache anything built from env.** `getStripe()` in `src/lib/stripe.ts` (Slop-Free) keeps the first client built in a worker, so a later file that sets or deletes `STRIPE_SECRET_KEY` changes nothing. Restoring env doesn't undo it either. On 2026-09-30, a spec that set the key, called `getStripe()` and restored the env made the missing-key test in `invariant-camp-reminder-egress` fail when it ran first in the same worker. That test passes in the suite only because no alphabetically earlier spec calls `getStripe()`.
   - **Not every SDK goes through the FetchStub.** The Stripe SDK (Node `http`/`https`) and Twilio bypass it. A key your spec inherits, or a client another file cached, means a real network call there, not a stub throw. `delete` those keys in your hook when a test must not reach them, as the reference spec does for `TWILIO_*`.
   - **Check isolation.** Run the new file alone, then the whole suite, both with a clean environment. Alone, the worker has your shell's env plus what your file sets. `env -i` drops the shell's env, and this machine's shell exports real keys; CI has none. In the suite, the worker also gets every file's collection-time env, plus whatever earlier files in its worker changed or cached. It must be green in both:

     ```bash
     env -i PATH="$PATH" HOME="$HOME" npx playwright test --config=playwright.pure.config.ts e2e/invariant-<name>.spec.ts
     env -i PATH="$PATH" HOME="$HOME" npm run test:pure
     ```
4. **Network = FetchStub.** `import { FetchStub } from "./fixtures/fetch-stub"`. Register rules first-match-wins (specific before catch-all); any unstubbed URL THROWS, which is itself an egress assertion. `stub.reset()` in `beforeEach` (clears calls AND rules — rules leak across tests otherwise; that bug cost a debugging cycle on day one), `stub.uninstall()` in `afterEach`.
5. **Stripe webhooks: sign for real.** Use `signedHeader()` from `e2e/fixtures/stripe-sessions.ts` — Stripe's own offline test-helper. Never mock `constructEvent`.
6. **Route handlers:** construct `new NextRequest(url, { method, body, headers })` and call the exported `POST` directly. Paths that reach `after()` may throw outside a Next request scope — settle with `.catch()` and assert on `stub` captures (the critical write lands before `after()`).
7. **Gates: assert fail-closed + zero calls.** Wrong secret → 401 AND `stub.calls.length === 0`. Also test the UNSET-env case — fail-open-on-missing-env is the classic regression. Unset means `delete` the key inside that test, never "no spec sets it" (step 3).
8. **Mutation-check before claiming done.** Perturb the fixture so the invariant should fail (sign with the right secret where you expect rejection, etc.), run, CONFIRM the spec fails, restore, confirm green. A spec that can't fail is decoration.
9. **Log it.** One `agent-log.md` entry (Situation · Decision · Risk · Change) if the invariant is new.

## Don'ts

- Don't edit slop-free files to make them "more testable" — tests observe, never modify.
- Don't duplicate existing coverage (`coach-auth.spec.ts` owns token mechanics; the invariant spec owns gate composition).
- Don't assert on log output or internal call order — behavior only.
- Don't set env at module scope, even above the `import`. It reaches every worker in the run, and it doesn't run before the import anyway (step 3).

## How the pure runner actually loads specs

Probed on 2026-09-28 with Playwright 1.59.1 while reviewing PR #368, and re-checked on 2026-09-30. The old step 3 said "set env before the import; per-file env is isolated, each spec file gets its own worker." All of that was wrong for `npm run test:pure`:

- **The runner runs every spec's module scope while collecting tests, then forks the workers with that environment.** The source shows it: `createLoadTask("in-process")` in `playwright/lib/runner/testRunner.js`, then `fork(…, { env: { ...process.env, … } })` in `processHost.js`.
  - So module-scope env from any spec lands in every worker's starting environment, whichever files that worker runs.
  - Files are collected in alphabetical order, so for each key the last file collected wins. As of 2026-09-30, every worker starts with `RESEND_API_KEY=re_test_dummy` from `session-reschedule.spec.ts`.
  - `afterAll` runs in the worker, so it can't reach the runner's copy.
- **Imports are hoisted.** A `process.env.X = …` written above an `import` runs after the imported module has already evaluated. "Env before import" only seemed to work because the worker had inherited that same assignment from the runner. A per-call read does see a module-scope assignment, because the worker finishes module scope before any test runs. So the real cost of the pattern is the leak into other files.
- **Workers are reused across spec files.** Env changes, cached clients and the module cache carry over from whichever files ran earlier in the same worker. Files reach a worker in collection order, so only alphabetically earlier files can leave state behind.
  - Which files share a worker depends on the worker count, on timing, and on failures, so it can change from run to run. A failed test restarts its worker from the runner's env.
  - Playwright defaults to half the CPUs: 2 on CI's 4-vCPU `ubuntu-latest`, more locally.
- `playwright test --ui` and watch mode load specs out of process, through Playwright's test server (`createLoadTask("out-of-process")`), so their workers inherit none of this. An editor integration that drives that server behaves the same way. A spec that leans on inherited env can behave differently there. (This is from the source; it wasn't probed.)

The specs that still set env at module scope all pass both alone and in the suite. There were 76 on 2026-09-30, up from 71 two days earlier. Move one to hooks when you next edit it; don't bulk-rewrite them. To list them (the grep matches statements at column 0, which catches every one today):

```bash
grep -lE '^(process\.env\b|delete process\.env\b|Object\.assign\(process\.env|setWebhookTestEnv\(\))' e2e/*.spec.ts
```
