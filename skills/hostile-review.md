# Skill: Run a hostile review

Use on any diff touching payments, auth/tokens, or minor PII — and periodically against main as an audit.

## Procedure

1. **Scope the diff.** `git diff <base>... --stat` — flag every file in a slop-free zone (CLAUDE.md § Slop-Free Zones). Slop-free edits without a logged approval = instant BLOCK.
2. **Run the checklist** at `docs/hostile-reviewer.md` — all 16 items, adversarial mindset: you are trying to reach a child's record, forge a token, double-spend a refund, or kill a revenue path silently. PASS/FAIL/N-A each with file:line evidence. No evidence = not a PASS.
3. **Grep-assists** (fast hunts for the common kills):
   - PII echo: `grep -rn "child_first_name\|childFirstName" src/app --include=route.ts` then eyeball response bodies.
   - Compare discipline: `grep -rn '!== process.env\|=== process.env' src/` (new hits beyond the documented grandfathered ones).
   - Fail-open: for each new gate, find the unset-env branch; it must reject.
   - Query-param secrets: `grep -rn 'searchParams.get("secret")' src/app`.
   - Notion property renames: grep the exact property-name strings the diff touches across `src/lib/notion-*.ts` + `src/app/api/cron/`.
4. **Run the harness:** `npm run test:pure` — the invariant specs are the executable half of this checklist.
5. **Verdict block** (format in docs/hostile-reviewer.md) goes in the PR comment / review output; FAILs are blocking until fixed or Sam explicitly waives.
6. **Log** findings worth remembering in `agent-log.md`.
