# Manual lineup release hold

Manual lineup editing must not release until the edit/score race is resolved. Participant checks before a Notion PATCH, readback after it, and process-local locks do not provide a transaction across serverless instances.

## Implemented safeguards

- Score requests carry the participant identities rendered with their inputs and reject changed or missing identities.
- Score forms remount when participant identities change, clearing unsaved numbers.
- A lineup editor retains its opening snapshot as its expected baseline even if another component refreshes server props.

These address stale browser state, not concurrent database writes. The PR remains held.

## Proposed persistence protocol, pending approval and validation

Add two relation properties to the existing Season League Games Notion database: `Scored Side A` and `Scored Side B`, targeting the existing Fall Registrations database. They contain existing registration IDs only, with no new destination or names. No schema changes have been made.

A score write must place both participant snapshots, scores and scored state into a single page PATCH. Every played-game consumer must use that immutable participant snapshot, not the editable lineup relations. Corrections must preserve the snapshot. Readers must recognize a valid scored snapshot even if a concurrent replan/void operation changes mutable status, so a score cannot disappear or transfer to new participants. Replan/void and final-lock behavior must be tested together, not only the new editor.

Existing scored rows would remain unchanged and locked, without automatic backfill. Migration must establish a clear legacy cutover and verify existing legacy rows cannot be touched by a new lineup action. Newly scored rows require snapshots; missing or malformed schema/data must fail closed, not use mutable sides. The exact distinction between legacy rows and new malformed rows needs a durable version/cutover marker and approval before implementation.

This proposal preserves attribution but does not by itself provide multi-row atomic swaps, concurrency control for conflicting coach edits, or final-lock fencing. Those must either be addressed through an explicit immutable event/version protocol with conflict detection, or through transactional persistence covering lineup, score, replan, void and final lock. No claim of atomicity is made for Notion.

## Required adversarial tests before release

- Score starts before edit validation and finishes before/after lineup PATCH.
- Edit starts before score validation and finishes before/after score PATCH.
- Score races schedule regeneration, void and final-team lock.
- Concurrent coach edits based on the same baseline conflict instead of silently overwriting.
- One court saves and another fails; repair preserves every scored participant and score.
- Legacy scored rows stay unchanged; malformed/missing snapshot schema fails closed.
- An open editor survives unrelated refresh without adopting a new baseline.
