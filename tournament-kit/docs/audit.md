# Tournament packaging audit — November 2, 2026

## Finding

There was no single reproducible launch package. The reusable playing engine existed, while the public site, signup/payment adapters, capacity/publication ledger, guides and event setup lived in different places.

| Area | Existing source | Reuse boundary |
| --- | --- | --- |
| Public month pages and form | `nextgen-academy`: `src/app/mvf-junior-tournament/[event]`, `MvfSeriesRegistrationForm`, `MvfSeriesFormatRules` | Specific MVF events, junior fields, 12U/16U, resident/nonresident fees |
| Invoice/receipt/waiver | `src/lib/mvf-series-{service,store,http}.ts`, signup invoices and ownership guards | Existing NGA merchant and provider configuration; financial state is verified rather than inferred |
| Capacity and delivery/publication serialization | `community-os`: P3 `nga-series-registration` and three ledger/publication migrations | API allows exactly six MVF event/division keys; every new native event needs isolated keys/capacity and a reviewed allowlist/release change |
| Game engine | `community-os/packages/tournament` | Reusable pure formats, schedules, standings, tiebreakers and medal helpers; persistence/PDF/operator surfaces live outside this package |
| Director procedure | [Rotating-partner tournament director guide](https://app.notion.com/p/3fdfa3ac27dc814a81d1e4d3750d1ef0) | Reviewed draw selection depends on actual player counts; an old event’s dates/approval/roster do not transfer |
| Launch copy and QR assets | Event-specific guide/PNG/SVG pack | Useful artifacts, but no common config or generator |

## Built in this kit

One configuration generates the public player experience and the private operating pack. Copying clears event-specific bindings and evidence. Adult/fixed-partner and junior/rotating-partner examples demonstrate that public/operations content is not tied to MVF. The native adapter is intentionally capability-limited to the installed API rather than claiming arbitrary new registrations already work.

The complete distribution can include pinned source snapshots from both repositories, plus file hashes. No template carries live participant rows, participant photos, credentials or invoice identities. This closes the packaging/recreation gap; it does not provision or certify a new provider event.

## Remaining integration work for a new native event

The current NGA native service is not yet a universal tournament registration backend. It hardcodes event/division discovery, merchant ownership and the junior schema; the P3 transport hardcodes allowed event keys. A future generic-native adapter should accept a reviewed event registry, neutral participant/team schema and per-event merchant/roster/capacity bindings while preserving the existing retry/payment/ownership checks. Until that adapter is implemented and verified, new event types use an external provider or the reviewed source-integration procedure. This limit is surfaced by validation, not hidden behind a working-looking form.

## Verification scope

Local package generation and tests are separate from live launch readiness. No new event, provider invoice, payment, message, roster record, database migration, access grant or deployment is created by building or exporting this package. Existing MVF live pages are unchanged by this kit.
