# October 6 program policy review

Draft PR #408 implements Sam's October 6 direction: NGA-controlled refund requests are reviewed case by case, and a $50 no-show fee applies to newly confirmed lessons using the new terms. A lesson request alone creates no no-show fee. No late-cancellation deadline, grace period, per-player fee, automatic charge or refund transaction is introduced.

The new terms are prospective. Existing registrations and confirmed lessons keep their supplied terms and any later agreed changes. Host-controlled registration and payment retain host terms. This PR does not set a retroactive effective date or change any payment/refund calculation, recurring job or agreement record.

## Copy aligned in this draft

- Terms and Schedule share the new refund review policy, existing-agreement protection and program summaries. The prior WJ season and October 24 tournament commitments are explicitly identified as supplied terms for existing registrations.
- FAQ mirrors those distinctions and answers confirmed lesson no-shows separately.
- Lessons and the unavailable-scheduler text fallback disclose the $50 fee before the request CTA, retain the request/confirmation/invoice distinction and link to Terms. Existing paid-invoice booking views are not assigned a new fee.
- Drop-in checkout/confirmation remove blanket withdrawal exclusions while retaining the actual NGA-cancellation refund flow. Booking confirmation and reminders align in HTML/plain text, including the webhook's actual plain-text builder. Self-cancellation, cancellation emails and SMS explain review under agreed terms; cancellation frees a seat without issuing a refund. A cancellation email describes only the current action, without denying a prior partial refund.
- The affected booking confirmation no longer promises a 50% referral discount; the referral payout was already disabled and Sam asked to remove discounts/promotions. The newsletter link remains. No coupon or earlier discount agreement is revoked.
- Crew offer/confirmation/weekly-receipt copy keeps the actual card and rate disclosures, removes the unsupported promise that the cancel link automatically refunds skipped weeks, and preserves earlier agreed commitments. This does not cancel a family's previously promised refund right.

## Remaining runtime and offer conflicts

| Surface | Current behavior or copy | Decision needed before complete rollout |
| --- | --- | --- |
| NGA-cancelled drop-ins: `src/lib/session-cancel.ts`; ReserveButton and `/schedule/success` | Session-wide cancellation attempts a full Stripe refund for each confirmed drop-in. The scoped public disclosure still describes this actual flow. | Decide whether that automatic NGA-cancellation remedy remains an exception or requires a separately authorized runtime change. This draft does not remove prior guarantees or turn automatic refunds into discretionary decisions. |
| Crew skipped week: `src/lib/email/commit-charge-receipt.ts`; `src/app/schedule/cancel/actions.ts` | The receipt's cancel URL goes to ordinary self-cancellation, which marks Cancelled and frees the seat without a Stripe refund. Earlier copy promised automatic skipped-week refunds. | Review previously promised crew refunds with Sam and honor those agreements. If future skip-week automation is wanted, separately authorize it; the new copy directs requests to Sam and does not claim automation exists. |
| WJ new sale: `/fall`, FallRegistrationForm, `src/lib/email/fall-season-confirmation.ts`, `src/lib/fall-refund-policy.ts` | Offer/form/email retain the sold no-withdrawal-refund promise. Runtime defaults to no refund for registrations on/after August 25, 2026; NGA cancellations prorate, with manual overrides available. | Coordinate prospective offer, confirmation and registration-policy-version handling before applying the new rule to this checkout. Do not silently reuse the August 25 cutoff for new case-by-case agreements or replace old registrants' terms. These surfaces are unresolved and unchanged. |
| October 24 tournament: page, MvfJuniorTournamentForm, invoice footer, signup/payment/reminder emails and paid success view | Shared `NO_REFUNDS_TEXT` is used for new invoice creation and existing-family communications. Rain-or-shine/no-rain-date and advertised medals remain prior event commitments. | Distinguish new offers from existing agreements throughout invoice and confirmation copy before replacing the no-refund constant. A global replacement would rewrite reminders and receipts for existing registrants. These surfaces are unresolved and unchanged. |
| External lesson request scheduler | `/lessons/book` normally redirects to the external Coach Sam scheduler. Its UI and later confirmation/invoice disclosures live outside this repository. | Parent task must align the external request/confirmation copy and confirm that the fee is disclosed before new confirmation. No changes to that repository or billing automation are made here. |
| Partner and winter programs | MVF classes and Pickl Park use host registration/payment; winter host, purchase and refund arrangements are unconfirmed. | Obtain host-specific rules and winter ownership before publishing purchase promises. NGA's new policy does not replace host terms. |

## Sources and verification

Sam's October 6 continuation settles the refund basis and lesson fee. The verified WJ guide (published October 5) is [the Fall season parent guide](https://app.notion.com/p/3edfa3ac27dc8126a600d602eb1072ff); existing tournament terms are in [the October 24 guide](https://app.notion.com/p/3edfa3ac27dc815a84bff3173b622a6b). The parent task maintains [the verified program sheet](https://app.notion.com/p/3f1fa3ac27dc81d08a68c3e2536fad91) and native Notion templates.

Tests cover prospective scope, the $50 amount, confirmed/request/earlier-agreement boundaries, legacy refund communication, the actual cancel-link behavior described in copy, rate disclosures and the original CRM status fixes. Verification uses synthetic inputs and a local built server with browser external traffic and submissions blocked. No checkout, form, email, production CRM write, card charge or refund is performed.
