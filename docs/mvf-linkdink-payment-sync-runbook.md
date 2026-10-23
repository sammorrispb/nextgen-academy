# MVF payment status in Link & Dink

NGA remains the payment owner. A Link & Dink `paid` RSVP is an organizer projection of a verified NGA invoice, not a second payment and not permission for L&D to refund that payment.

## Release order

1. Review and release the paired community-os private payment-fact/RPC, protected endpoint, import-consumption and external-refund guard changes through its normal migration/deployment workflows.
2. Release the NGA sender/webhook/admin changes. The sender fails retryably until the receiver exists and confirms the exact binding. Do not replay customer notifications to test payment propagation.
3. Verify with synthetic integration first, then the specifically authorized existing paid invoice through the production admin page. Code/CI/preview success alone is not a live reconciliation receipt.

No direct production migration, hand-edit to `payment_status`, generic walk-up, new invoice, charge, resend, or webhook replay is part of this runbook.

## One existing invoice

Open `/admin/mvf-roster-sync` signed in as an allowlisted NGA admin. Select **Sync a verified NGA payment**, enter the existing invoice ID, and preview. The server reads the current live NGA account, fresh invoice, its successful invoice payment, payment intent, charge/refund state, and exactly one matching active native tournament registration. It derives both private identity keys from the same native invoice/registration. Browser inputs cannot supply paid flags, child identity, destination or keys.

Review the preview. It changes nothing in L&D. The ten-minute capability binds the current admin session, invoice, immutable proof and Notion source revision. Apply only that preview. If any evidence changed, preview again. No admission or age check runs for this payment-only operation; it preserves an already-approved real-DOB exception and cannot add a player.

- **Payment sync confirmed:** L&D matched the exact protected junior import and changed or confirmed that RSVP's payment projection.
- **Payment receipt saved:** L&D durably saved the verified receipt, but no matching protected roster entry exists yet. The normal protected import consumes the receipt later. This result does not mean the child is on the roster.
- **Verification required / unavailable:** Stop guessing. Check the exact invoice, current NGA account, source record and receiver binding. Resolve duplicate, canceled, refunded, disputed, incomplete or changed evidence before a fresh preview. A lost response may hide a completed write; the same exact invoice can be reconciled idempotently.

Never use roster recovery to repair payment status. Roster recovery retains its existing eligibility and privacy rules; payment reconciliation does not broaden the public age bands.

## Automatic operation

Modern MVF paid callbacks refresh proof after historical callback holds and native registration processing, before notification flags and the already-paid return. Both Stripe paid aliases retry the same immutable receipt. Destination failure requests redelivery. A payment arriving before the protected roster is stored is retained privately and consumed by that import, without another charge or email. Historical callbacks remain held.

Only opaque account/invoice/submission IDs, attendee/roster HMACs, amount/currency/residency, payment timestamp and the NGA payment-intent receipt cross this new channel. The NGA intent must never populate L&D's native `rsvps.payment_intent_id`. L&D's explicit external-owner guard prevents its cancellation flow from promising or initiating an NGA refund. Existing paid facts are not automatically reversed by refund/dispute events; conflicting provider evidence refuses a new reconciliation and requires a separately reviewed owner-side decision.
