# Integration and recreation procedure

## 1. Decide the event’s systems of record

Record the actual venue/courts, public page URL, entry unit (individual/pair/team), audience, division eligibility/caps, fees, format, director and policies in `tournament.json`. Select one registration/payment provider, one restricted registration roster and one scoring event. Match them by stable event/division identifiers. A payment owner is a business/account decision; do not infer it from an event title or copy another event’s invoice IDs.

## 2. External registration route — supported for new tournament types now

1. Create the event and form in the selected authorized provider, using `registration-form.md` as the field specification. Configure divisions, capacity/waitlist, eligibility, waiver, separate optional SMS consent, payment owner, fees, deadline and receipts there.
2. Set `registration.provider` to `external` and its public URL in `registration.url`. Keep private operator URLs out of that field.
3. Create the scoring event with the correct engine/format for the actual entry unit. Verify pairs/teams are not being counted as individual rotating players. Follow the engine catalogue and director guide for supported counts.
4. Rehearse the actual registration → provider payment → confirmed registration → director roster journey. Include a retry, full/closed event, unpaid attempt and permitted cancellation/recovery. Record outcomes and links in `readiness`; never substitute a mocked test for a provider result.
5. Build and host only `public/`, then verify mobile/desktop and scan the final printed QR proof. Release communications separately.

## 3. NGA native route — preserve the existing transaction safeguards

The bundled adapter currently recognizes only `november-2026`, `january-2027`, `february-2027`, each with `12u` and `16u`. It requires the existing NGA origin and installed releases, $50/$60 fees, ten-seat divisions and optional address. The validator rejects a new event passed off as one of these.

For another native event, an implementation owner must make a reviewed change using the bundled source snapshots:

1. Add an independent public event definition and immutable release revision. Resolve dates, age/rating eligibility, game format, fees, invoice payment window, minimum enrollment, refund/weather terms and director coverage. Keep the new admission/release disabled until its launch evidence is complete; retain all previously issued revisions.
2. Define fresh event/division keys in both discovery/registration code and P3’s `nga-series-registration` allowlist. The actual API currently rejects any other key before calling the ledger. Do not reuse one of the six MVF keys for a different tournament.
3. Use a new reviewed migration to provision isolated capacity rows, initially not ready. Verify the exact row count, limits, no unintended reservations and service-only grants. The bundled historical migrations are references: **do not rerun them**, edit the applied history, bulk-reset claims or use October-only bootstrap scripts. Use the repository’s migration workflow.
4. Configure a suitable restricted roster schema, including Home Address when collected. For adult/pair/team intake, implement a neutral validated contract and field mapping; do not label an adult’s record as a guardian/child merely to fit the old schema. Preserve least access and avoid public attendee feeds for minors.
5. Verify the intended merchant account, provider mode, email recipient, webhook event subscriptions/signatures, policy revision and final invoice amount. Reuse the existing waiver/retry/idempotency/receipt logic. Do not create a new payment engine by removing these checks.
6. Confirm reserve → bind → one roster → finalize/send → signed payment evidence → confirmed roster. Test lost responses, duplicate submissions/callbacks, closed/full admission, recipient drift, refunds/disputes and cancellation races. An overdue payable invoice still holds its seat until a provider-confirmed unpaid void; paid adjustments need review.
7. Configure only the verified readiness rows and release through normal checks/review/deployment. Verify the public alias serves the exact reviewed commit and that provider configuration matches it.

Native signup’s home address is optional and saved privately in the invoice metadata and roster. Do not mirror it into analytics, public JSON, general agent feeds or routine email notices. The packaged source snapshots contain the original account IDs/flags as historical code evidence, not authorization to activate another event.

## 4. Playing formats and day-of setup

`reference/community-os/packages/tournament` contains the reusable pure engine. It includes rotating-partner and same-partner generators, pool/playoff/bracket helpers and standings/tiebreakers. Check its catalogue for the exact format and player/pair/team count; a similarly named engine is not necessarily the same schedule. The P3 persistence, scoring/TV UI, operator authorization and PDF recovery are separate integrations in the full application.

Use the director guide for physical check-in, seat/pool review, score verification, tie resolution, medal-team review, recovery PDFs and completion. Create fresh scoring-event identifiers for each tournament. Never copy a previous attendance list or live draw as a new tournament’s roster. Resolve unsupported counts before promising game totals or a medal draw.

## 5. Closeout and feedback

Reconcile every registration against the correct provider’s invoice/payment/refund/dispute evidence; preserve unknowns. Record partner allocation only under the event’s approved production agreement, including processor-fee ownership. Record verified attendance and final results separately. Send only approved results/photos to the approved recipients, then update the reusable template with a general lesson rather than carrying personal records into the next copy.

## Environment references — names only

The existing NGA adapter uses runtime configuration such as `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NOTION_API_KEY`, `NOTION_MVF_SERIES_REGS_DB_ID`, `NOTION_WAIVERS_DB_ID`, `NGA_SYNC_SECRET`, `LINKDINK_BASE_URL`, `RESEND_API_KEY` and `VERCEL_ENV`. P3 uses its service-only Supabase configuration. Configure these through the approved hosting/integration path; never put values in `tournament.json`, the ZIP, chat, a public page or a copied `.env` file. The generator itself needs none of them.
