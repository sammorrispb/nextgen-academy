# Skill: Agent trigger parity (one-shot, cross-repo)

Use to hunt and fix one class of bug across all our sites: when an **agent**
performs an operational action by writing the datastore directly, it bypasses
the side-effect triggers that fire when the same action runs through the app's
UI. The visible write lands; the rest of the fan-out (CRM/analytics ingest,
email/SMS, webhooks, status/count rollups, idempotency flags, cache
revalidation, audit log) is silently skipped.

Canonical case (NGA, 2026-06-14): the coach dashboard attendance toggle runs
`markAttendanceAction`, which writes the Notion `Attendance` field **and** fires
`ingestToOpenBrain({ source: "nga_attendance" })`. An agent set the Notion field
directly, so the Open Brain check-in activity never fired — the trigger lived
only inside the action.

Run this in ONE shot: loop the repo list below, do every repo, then stop.

## Repos
- `nextgen-academy` (nextgenpbacademy.com)
- `linkanddink` (linkanddink.com)
- `sammorrispb` (sammorrispb.com)

Skip any repo not checked out / not accessible in this session — note it and
move on; do not block the others.

## Recipe (per repo)

1. **Isolate.** New worktree off the default branch so the active checkout is
   untouched: `git worktree add ../<repo>-trigger-parity -b agent-action-trigger-parity`.
   Do all work there. Read that repo's `CLAUDE.md` / contributing rules first —
   they override this skill.
2. **Investigate (read-only first).** Inventory every UI-exposed operational
   mutation — server actions, route handlers / API endpoints, form submits —
   that has MORE than one side effect (a primary datastore write PLUS any
   secondary trigger: CRM/analytics ingest, email/SMS, webhook, status or count
   rollup, idempotency-flag write, cache revalidation, audit log).
3. **Score the gap.** For each, decide whether an agent / out-of-band caller
   could reproduce the primary write while dropping the secondary triggers, and
   exactly what would be missed. Output a table: action · file · triggers it
   fans out to · what a raw datastore write misses · risk.
4. **Propose, don't barge.** Recommend the fix: a single shared, auth-gated,
   agent-callable entry point (internal API route or exported action) that wraps
   the existing logic so calling it fires the FULL fan-out — instead of letting
   agents touch the raw datastore. Note where a small refactor consolidates
   duplicated side-effect logic behind one function.
5. **Respect the gates.** Any surface this repo puts behind a hard approval gate
   (NGA's payments / auth-tokens / minor-PII "Slop-Free Zones" + the IPAV loop;
   the equivalent in each repo) — STOP at the proposal and wait for explicit
   approval before writing code there. Implement only the clearly-safe ones.
6. **Validate what you implement.** Tests FIRST: assert the side-effect parity
   (fails before, passes after), then green build + lint + existing tests.
   Mutation-check the new test. Never weaken an existing invariant test.
7. **Deliver.** Commit with clear messages, push `agent-action-trigger-parity`,
   open a DRAFT PR per repo: the principle, the inventory table, what changed,
   and what you left gated for approval. Don't merge.

## Don'ts
- Don't reach past a shared action to the raw datastore "just to make it work" —
  that's the bug this skill exists to kill.
- Don't auto-implement on payments / auth / minor-PII surfaces — propose + wait.
- Don't leave a worktree half-done silently; if a repo is blocked, say why.
