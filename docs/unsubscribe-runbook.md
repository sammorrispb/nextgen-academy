# Unsubscribe / opt-out runbook

How to honor a parent who asks to stop receiving email (or SMS) from NGA —
whether they reply **"skip"** / **"stop"** / **"unsubscribe"** to a blast, or ask
by any other channel.

> **Why this needs a runbook:** NGA mails parents from **two different lists**
> with **two different opt-out mechanisms**. Flipping the wrong one (or assuming a
> Notion status change is enough) leaves the parent still receiving email. Find
> which list they're on first, then apply the matching step below.

---

## Step 0 — Which list are they on?

Match on the **email they replied to / the campaign**, not a guess:

| They received… | List | Source of truth | Opt-out mechanism |
| --- | --- | --- | --- |
| The **weekly newsletter** ("From Coach Sam this week", open-sessions roundup) | **Newsletter subscribers** | `NGA Newsletter Subscribers` DB (`NOTION_NEWSLETTER_DB_ID`) | One-click unsubscribe link → `Status = Unsubscribed` |
| **Camp outreach** ("Two weeks of summer camp left") or **eval re-engagement** ("…you reached out about getting your kid on the court") | **Lead-CRM marketing** | `Next Gen Academy Player Database` (`NOTION_DB_ID` = `1e5e34c258384c6cb5f3e846543ecfc7`) | Tick **Quarantine** on their row |
| A **drop-in reminder / post-session / cancellation** SMS or email | Transactional (per registration) | `NGA Drop-in Registrations` DB | Not marketing — see [SMS](#sms-opt-out) / don't blanket-suppress |

If you're unsure which it was, search the parent's email across both DBs — a
person can be on **both** lists (e.g. a lead who also subscribed to the
newsletter). Opt them out of **every** list they appear on.

---

## A. Newsletter subscriber opt-out

The newsletter already carries a **signed one-click unsubscribe link** in every
issue's footer (`GET /api/newsletter/unsubscribe`), which flips the row to
`Status = Unsubscribed`. The Thursday cron only sends to `Status = Active` rows,
so an unsubscribed row is permanently skipped.

**If the parent used the link:** nothing to do — it's already done.

**If they replied by email/text instead:** flip it manually.
1. Open `NGA Newsletter Subscribers` DB → find the row by **Email**.
2. Set **Status** → `Unsubscribed`.
3. (Optional) Note the date + reason in the row for audit.

That's the entire mechanism — no code reads any other field for the newsletter.

---

## B. Lead-CRM marketing opt-out (the **Quarantine** flag)

Lead marketing (`/api/camp-outreach`, `/api/eval-reengagement`) does **not** read
`Status`. It selects recipients purely through `classifyLead()` in
`src/lib/lead-segmentation.ts`. The opt-out lever is the **`Quarantine`
checkbox** on the lead's CRM row.

**How it works (since PR #223):** `classifyLead()` returns `off_limits` for any
row with `Quarantine = true`, **before** any Source/provenance check — so a
quarantined lead is suppressed regardless of their Source (even a clean
"Website" lead). Both senders read the checkbox inside `fetchEligibleRecipients`,
so the gate also applies to anyone passed in an `only` allow-list. Add a new
Quarantine-respecting sender and it inherits the suppression for free.

### Procedure

1. Open the **lead's CRM row**: `Next Gen Academy Player Database` → find by
   **Parent Email** (or Parent Name).
2. Set the fields:
   - **Quarantine** → ✅ *(this is the field that actually stops the email)*
   - **Status** → `Inactive`
   - **Notes** → append a dated line, e.g.
     `2026-06-25: Opted out of marketing — replied "skip" to Gaithersburg camp outreach. Quarantined (do not market).`
   - **Last Contact Date** → today
3. **Only Quarantine matters for suppression** — Status/Notes/Last Contact are
   the audit trail. Don't rely on Status alone; the senders ignore it.

### Verify (optional but recommended)

Confirm the parent is no longer a recipient with a **dry run** (no email is
sent — `dryRun` just returns the recipient list):

```bash
curl -s -X POST "https://nextgenpbacademy.com/api/camp-outreach?secret=$NGA_ADMIN_SECRET" \
  -H 'Content-Type: application/json' -d '{"dryRun": true}' | jq '.recipients[].email'
# the quarantined parent's email should NOT appear; off_limits count goes up by 1
```

Same shape works for `/api/eval-reengagement`.

---

## SMS opt-out

SMS is gated separately by TCPA consent, not by these lists. `sendSms()`
hard-refuses without `consent: true`, and consent only ever flips from the exact
checkout string `"true"`. To stop texts for a registered parent, clear/withhold
their SMS consent on the relevant `NGA Drop-in Registrations` row — do **not**
treat an email "unsubscribe" as an SMS opt-out and vice-versa. A parent who
texts "STOP" to a number should be honored at the carrier/Twilio level too.

---

## Notes & gotchas

- **A person can be on multiple lists.** Opt them out of each one they're on —
  Quarantine does nothing for the newsletter, and `Status = Unsubscribed` does
  nothing for lead marketing.
- **Quarantine is reusable and reversible.** Tick it to suppress any lead at any
  time (not only on a "skip" reply); untick to re-enable. No code change needed.
- **The "skip" cue is intentional.** Camp-outreach and eval-reengagement footers
  say *Reply "skip" and we'll close the loop* — so replies are expected. This
  runbook is "closing the loop."
- **Don't fake provenance to suppress.** Never set a DD/CourtReserve Source or CR
  history just to push someone to `off_limits` — that corrupts the segmentation
  data. `Quarantine` is the correct, honest lever.
- **Audit defense.** Always leave the dated Notes line; it's the record that the
  opt-out request was received and honored.

## Reference

- `src/lib/lead-segmentation.ts` — `classifyLead()` (Quarantine → `off_limits`)
- `src/app/api/camp-outreach/route.ts`, `src/app/api/eval-reengagement/route.ts`
  — lead-marketing senders that read Quarantine
- `e2e/lead-segmentation.spec.ts` — pins the Quarantine behavior
- `src/app/api/newsletter/unsubscribe/route.ts` — newsletter one-click unsubscribe
- CLAUDE.md → "Newsletter signup" / "Eval-lead re-engagement" sections
