# Proposal — editing the curriculum from the website

**Status: APPROVED 2026-08-27. STAGE 1 SHIPPED; Stages 2 and 3 not built.**
Requested by Sam 2026-08-27 ("view these guides and edit them from the website").

Stage 1 — the read path — is live: `src/lib/curriculum-merge.ts`,
`src/lib/notion-curriculum.ts`, `src/lib/curriculum-health.ts`,
`/api/cron/curriculum-health`, and the merged render on `/coach/fall-playbook`.
It ships dark until `NOTION_CURRICULUM_DB_ID` is set. Sam edits rows in Notion
directly; there is deliberately **no write surface**. Stage 2 (the
`/coach/curriculum` editor + one-tap revert) and Stage 3 (export-back-to-git)
are deferred by design — the call was to run a season on Stage 1 first and only
then decide whether they earn their keep.

Two things the shipped design added to the proposal below:

- **`week.<n>.<prop>` is in scope**, so the override layer spans
  `fall-season-plan-2026.ts` as well. The file table further down omits it; that
  file is UNCHANGED too, and its spec (`e2e/fall-season-plan.spec.ts`) still
  pins its defaults.
- **An `Active` checkbox on the DB.** Without Stage 2's revert button, deleting
  the row was the only undo; unticking `Active` reverts one string while keeping
  the text. A *missing* `Active` property means active, and there is no
  server-side filter on it — Notion 400s a filter naming a property the DB lacks,
  which would turn a missing column into a failed read for the whole feature.

## The problem

`/coach/fall-playbook` renders from TypeScript data files at **build time**. So
today the round-trip to change a cue is: edit the Copy Desk artifact → Claude
ports it → PR → review → merge → deploy. That worked twice (#296, #297) and is
genuinely good for *rules*, which deserve review. It is bad for the case Sam
actually named: fixing a wrong cue on a Sunday morning, from a phone, at a court.

## What we must not lose

PR #297 is the argument for caution. Sam changed the Red serve rule; the
invariant test pinning the old rule went red and forced a deliberate decision.
If the curriculum simply moves to Notion, **that safety net disappears** — every
string becomes editable by anyone with the DB, with no test, no review, no
history, and no way to tell "Sam meant this" from "someone fat-fingered it".

That is a real regression, and it is the whole design constraint here.

## Proposed shape — code is the floor, Notion is an override layer

Not a migration. An **override layer** over the existing data files.

1. **Code stays the source of truth for defaults.** `session-curriculum.ts` is
   untouched, and `e2e/session-curriculum.spec.ts` keeps pinning it. The tests
   stay meaningful because they test the floor.
2. **A Notion DB holds only overrides** — one row per changed string, keyed by
   the same field IDs the Copy Desk already uses (`rule.red.serve`,
   `block.1.cue.0`, `captain.duty.3`). An unedited string has **no row**.
3. **The page merges at request time**: `code default ← Notion override`, with
   ISR (5 min, matching `notion-sessions`).
4. **Fail-soft, hard.** Notion down, unset, or slow → the page renders the code
   defaults. A run sheet must never be blank or half-rendered on a Sunday. Same
   posture as `fetchApprovedNewsletterDrafts`, and the same lesson: a silent
   fallback needs an alert, so an override that stops resolving raises a cron
   alert rather than quietly reverting.
5. **Overrides are visible, not invisible.** The playbook shows a small "edited"
   marker per overridden string (the Copy Desk's lime gutter, ported), and
   `/coach/curriculum` lists every active override with its code default beside
   it and a one-tap revert. You can always see how far the live copy has drifted
   from what is in git.
6. **Promotion path.** A `POST /api/curriculum/export` returns the overrides as
   a patch Claude ports into the data files — so anything that proves itself on
   court gets folded back into version control and re-pinned by tests. Notion is
   for *fast*, git is for *settled*.

## Files this would touch

| File | What |
|---|---|
| `src/lib/notion-curriculum.ts` | NEW — read overrides, ISR, fail-soft, alert on query failure |
| `src/lib/curriculum-merge.ts` | NEW — pure merge of defaults + overrides; heavily unit-tested |
| `src/app/coach/(authed)/curriculum/page.tsx` | NEW — auth-gated editor + override list + revert |
| `src/app/api/curriculum/route.ts` | NEW — write path, coach-auth gated |
| `src/app/coach/fall-playbook/page.tsx` | render merged values; show the edited marker |
| `src/data/session-curriculum.ts` | UNCHANGED |
| `e2e/curriculum-merge.spec.ts` | NEW — merge purity, unknown keys ignored, fail-soft |
| `e2e/invariant-curriculum-authz.spec.ts` | NEW — write path fails closed without coach auth |

## What Sam has to do out of repo

1. Create the **NGA Curriculum Overrides** Notion DB: `Field ID` (title),
   `Value` (rich text), `Updated By` (email), `Updated At` (date), `Note`.
2. Share it with the NGA Notion integration.
3. Set `NOTION_CURRICULUM_DB_ID` in Vercel. **Unset = the feature is dark and the
   page renders exactly as it does today** — same ships-dark convention as the
   league and Pickl Park surfaces.

## Invariants at risk, and the mitigation

- **Rules drift with no review.** Mitigated by: code defaults still tested;
  overrides visible and revertible; export-back-to-git path. *Accepted residual
  risk:* between an edit and its promotion, the live rule differs from the
  tested one. The override list is how you see that.
- **A new write surface on coach auth.** Editor and API sit under
  `coach/(authed)` behind `COACH_ALLOWED_EMAILS`, pinned by an authz invariant
  test. **No child or parent data is involved** — the curriculum is coach text
  only, so this stays off the minor-PII egress surface.
- **Notion outage on a Sunday.** Fail-soft to code defaults, alert, never blank.

## Rollback

Unset `NOTION_CURRICULUM_DB_ID`. The merge layer no-ops and the page is exactly
what it is today. No data migration to undo.

## Estimate and staging

Roughly 2-3 focused sessions. Worth staging:

- **Stage 1** — read path only. Overrides render on the playbook, edited via
  Notion directly. Delivers the "fix it from my phone" case with the least code
  and no new write surface at all.
- **Stage 2** — the `/coach/curriculum` editor and revert.
- **Stage 3** — export-back-to-git.

**Stage 1 alone may be the whole answer**, since Sam already edits Notion daily
for sessions and newsletter drafts. Recommend building Stage 1, running a season
on it, and only then deciding whether 2 and 3 earn their keep.
