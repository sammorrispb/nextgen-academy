import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import {
  errorCode,
  rollupFailure,
  withCronAlert,
  type CronFailure,
} from "@/lib/cron-alert";
import { EMAIL_RE } from "@/lib/notion-utils";
import { fetchMvfTournamentRegistrations } from "@/lib/notion-mvf-tournament-registrations";
import { isWithdrawnMvfRegistration } from "@/lib/mvf-tournament-status";
import {
  mvfTournamentPaymentReminderSubject,
  mvfTournamentPaymentReminderText,
  mvfTournamentPaymentReminderHtml,
} from "@/lib/email/mvf-tournament-payment-reminder";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";

/** Days after signup before the unpaid nudge goes out (invoice is due in 7). */
const REMINDER_AFTER_DAYS = 5;
/** Stripe invoice metadata flag so a parent never gets two reminders. */
const REMINDER_SENT_KEY = "payment_reminder_sent";

/**
 * Daily cron: nudge MVF Junior Tournament parents whose invoice is still
 * unpaid 5 days after signup. The invoice expires at 7 days, so this is the
 * last-chance reminder. Sends once per invoice (tracked in Stripe invoice
 * metadata, not Notion — Notion schema changes aren't API-writable).
 *
 * Safety posture mirrors the drop-in reminder: a Notion/Stripe outage
 * reports but never sends to a row it can't verify as still-open. A due row
 * the run can't remind (no invoice id, a failed invoice lookup, a bad parent
 * email) is a failure, never a quiet skip.
 */
export const GET = withCronAlert("mvf-tournament-payment-reminder", async () => {
  const stripe = getStripe();
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      attempted: 0,
      succeeded: 0,
      failures: [
        { signature: "resend_not_configured", detail: "RESEND_API_KEY missing" },
      ],
      body: { sent: 0, skipped: 0 },
    };
  }
  const resend = new Resend(apiKey);

  const rows = await fetchMvfTournamentRegistrations(false);
  if (!rows) {
    return {
      attempted: 0,
      succeeded: 0,
      failures: [
        { signature: "notion_unavailable", detail: "unpaid fetch failed" },
      ],
      body: { sent: 0, skipped: 0 },
    };
  }

  const cutoff = Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000;
  let sent = 0;
  let skipped = 0;
  const missingInvoice: string[] = [];
  const lookupFailed: string[] = [];
  const lookupCodes = new Set<string>();
  const invalidEmail: string[] = [];
  const rejected: string[] = [];
  const flagFailed: string[] = [];

  for (const row of rows) {
    // Refunded and Cancelled rows stay Paid=false for good. They need no
    // reminder, so they never reach Stripe or the alert.
    if (isWithdrawnMvfRegistration(row.status)) {
      skipped++;
      continue;
    }
    // Only rows created at least 5 days ago.
    const created = row.createdAt ? Date.parse(row.createdAt) : NaN;
    if (Number.isNaN(created) || created > cutoff) {
      skipped++;
      continue;
    }
    // The checkout writes the row with its invoice id, so a blank one is a
    // broken row, not an unpaid family with nothing to pay.
    if (!row.stripeInvoiceId) {
      missingInvoice.push(row.pageId);
      continue;
    }

    // Verify against Stripe: still open, and no reminder sent yet.
    let invoice;
    try {
      invoice = await stripe.invoices.retrieve(row.stripeInvoiceId);
    } catch (err) {
      console.error(
        `[cron/mvf-tournament-payment-reminder] stripe retrieve failed for ${row.pageId}`,
        err,
      );
      lookupFailed.push(row.pageId);
      lookupCodes.add(errorCode(err));
      continue;
    }
    if (invoice.status !== "open") {
      skipped++;
      continue;
    }
    if (invoice.metadata?.[REMINDER_SENT_KEY] === "true") {
      skipped++;
      continue;
    }
    // Checked after Stripe so only a reminder that is really due can alert.
    if (!row.parentEmail || !EMAIL_RE.test(row.parentEmail)) {
      invalidEmail.push(row.pageId);
      continue;
    }

    const parentFirst = row.parentName.split(/\s+/)[0] || "there";
    const childFirst = row.childFirstName || "your player";
    const input = {
      parentFirst,
      childFirst,
      divisionLabel: row.division === "14u" ? "14U" : "10U",
      amountUsd: row.amountUsd.toFixed(2),
      residencyLabel: row.resident ? "MV resident" : "non-resident",
      payUrl: invoice.hosted_invoice_url ?? "",
    };
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: row.parentEmail,
      bcc: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject: mvfTournamentPaymentReminderSubject({ childFirst }),
      html: mvfTournamentPaymentReminderHtml(input),
      text: mvfTournamentPaymentReminderText(input),
    });
    if (error) {
      console.error(
        `[cron/mvf-tournament-payment-reminder] resend rejected ${row.pageId}`,
        error,
      );
      rejected.push(row.pageId);
      continue;
    }

    sent++;
    // A throw here used to end the run and leave every later family
    // unreminded. The email landed; a missing flag only risks a duplicate
    // tomorrow, so report it and keep going.
    try {
      await stripe.invoices.update(row.stripeInvoiceId, {
        metadata: { ...invoice.metadata, [REMINDER_SENT_KEY]: "true" },
      });
    } catch (err) {
      console.error(
        `[cron/mvf-tournament-payment-reminder] flag write failed for ${row.pageId}`,
        err,
      );
      flagFailed.push(row.pageId);
    }
  }

  const failures: CronFailure[] = [];
  for (const rolled of [
    rollupFailure(
      "missing_invoice_id",
      missingInvoice,
      "unpaid row(s) with no Stripe invoice id",
    ),
    rollupFailure(
      "stripe_lookup_failed",
      lookupFailed,
      `unpaid row(s) not reminded because the Stripe invoice lookup failed (${[...lookupCodes].sort().join(", ")})`,
    ),
    rollupFailure(
      "invalid_parent_email",
      invalidEmail,
      "due reminder(s) with a missing/malformed parent email",
    ),
    rollupFailure("resend_rejected", rejected, "payment reminders rejected"),
    rollupFailure(
      "flag_write_failed",
      flagFailed,
      "reminder(s) sent but the Stripe sent-flag didn't save",
    ),
  ]) {
    if (rolled) failures.push(rolled);
  }

  return {
    attempted:
      sent +
      skipped +
      missingInvoice.length +
      lookupFailed.length +
      invalidEmail.length +
      rejected.length,
    succeeded: sent,
    failures,
    body: { sent, skipped },
  };
});
