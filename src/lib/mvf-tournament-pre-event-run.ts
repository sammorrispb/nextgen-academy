import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import {
  errorCode,
  rollupFailure,
  type CronFailure,
  type CronRunResult,
} from "@/lib/cron-alert";
import { EMAIL_RE } from "@/lib/notion-utils";
import { fetchMvfTournamentRegistrations } from "@/lib/notion-mvf-tournament-registrations";
import {
  MVF_TOURNAMENT_PRE_EVENT_SEND_DATE_ISO,
  mvfTournamentPreEventReminderSubject,
  mvfTournamentPreEventReminderText,
  mvfTournamentPreEventReminderHtml,
  todayEtIso,
} from "@/lib/email/mvf-tournament-pre-event-reminder";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SENT_KEY = "pre_event_reminder_sent";

/** The slice of the Stripe client the reminder reads and writes. */
export interface PreEventInvoiceStore {
  invoices: {
    retrieve(id: string): Promise<{ metadata?: Record<string, string> | null }>;
    update(
      id: string,
      params: { metadata: Record<string, string> },
    ): Promise<unknown>;
  };
}

export interface RunPreEventReminderOptions {
  /** ET date to run as. The route never passes it; specs pin the send date. */
  todayIso?: string;
  stripe?: PreEventInvoiceStore;
}

/**
 * The body of the date-gated pre-event cron: on the send date (ET) only,
 * email every PAID MVF Junior Tournament registrant the pre-event reminder.
 *
 * A row the run can't handle is a failure, never a quiet skip: on 2026-10-19
 * nine of ten paid families got nothing because their invoices lived on an
 * older Stripe account, every lookup threw `resource_missing`, and the catch
 * counted them as skipped, so the run returned 200 and no alert fired.
 */
export async function runMvfTournamentPreEventReminder(
  opts: RunPreEventReminderOptions = {},
): Promise<CronRunResult> {
  if ((opts.todayIso ?? todayEtIso()) !== MVF_TOURNAMENT_PRE_EVENT_SEND_DATE_ISO) {
    return {
      attempted: 0,
      succeeded: 0,
      failures: [],
      body: { sent: 0, skipped: 0, note: "not send date" },
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      attempted: 0,
      succeeded: 0,
      failures: [
        {
          signature: "resend_not_configured",
          detail: "RESEND_API_KEY missing",
        },
      ],
      body: { sent: 0, skipped: 0 },
    };
  }
  const resend = new Resend(apiKey);
  const stripe = opts.stripe ?? getStripe();

  const rows = await fetchMvfTournamentRegistrations(true);
  if (!rows) {
    return {
      attempted: 0,
      succeeded: 0,
      failures: [
        { signature: "notion_unavailable", detail: "paid fetch failed" },
      ],
      body: { sent: 0, skipped: 0 },
    };
  }

  let sent = 0;
  let skipped = 0;
  const invalidEmail: string[] = [];
  const lookupFailed: string[] = [];
  const lookupCodes = new Set<string>();
  const rejected: string[] = [];
  const flagFailed: string[] = [];

  for (const row of rows) {
    if (!row.parentEmail || !EMAIL_RE.test(row.parentEmail)) {
      invalidEmail.push(row.pageId);
      continue;
    }
    // Idempotency: a manual re-trigger on the send date must not double-send.
    // The flag lives on the Stripe invoice (Notion schema isn't API-writable).
    // A lookup that fails still skips the send, since the flag can't be
    // checked, but it reports.
    if (row.stripeInvoiceId) {
      try {
        const inv = await stripe.invoices.retrieve(row.stripeInvoiceId);
        if (inv.metadata?.[SENT_KEY] === "true") {
          skipped++;
          continue;
        }
      } catch (err) {
        console.error(
          `[cron/mvf-tournament-pre-event-reminder] stripe retrieve failed for ${row.pageId}`,
          err,
        );
        lookupFailed.push(row.pageId);
        lookupCodes.add(errorCode(err));
        continue;
      }
    }
    const parentFirst = row.parentName.split(/\s+/)[0] || "there";
    const childFirst = row.childFirstName || "your player";
    const input = {
      parentFirst,
      childFirst,
      divisionLabel: row.division === "14u" ? "14U" : "10U",
    };
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: row.parentEmail,
      bcc: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject: mvfTournamentPreEventReminderSubject(),
      html: mvfTournamentPreEventReminderHtml(input),
      text: mvfTournamentPreEventReminderText(input),
    });
    if (error) {
      console.error(
        `[cron/mvf-tournament-pre-event-reminder] resend rejected ${row.pageId}`,
        error,
      );
      rejected.push(row.pageId);
      continue;
    }
    sent++;
    if (row.stripeInvoiceId) {
      try {
        await stripe.invoices.update(row.stripeInvoiceId, {
          metadata: { [SENT_KEY]: "true" },
        });
      } catch (err) {
        // The email landed; a missing flag only risks a duplicate on a manual
        // re-run, so report it rather than fail the send.
        console.error(
          `[cron/mvf-tournament-pre-event-reminder] flag write failed for ${row.pageId}`,
          err,
        );
        flagFailed.push(row.pageId);
      }
    }
  }

  const failures: CronFailure[] = [];
  for (const rolled of [
    rollupFailure(
      "invalid_parent_email",
      invalidEmail,
      "paid row(s) with a missing/malformed parent email",
    ),
    rollupFailure(
      "stripe_lookup_failed",
      lookupFailed,
      `paid row(s) not emailed because the Stripe invoice lookup failed (${[...lookupCodes].sort().join(", ")})`,
    ),
    rollupFailure("resend_rejected", rejected, "pre-event reminders rejected"),
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
      sent + skipped + invalidEmail.length + lookupFailed.length + rejected.length,
    succeeded: sent,
    failures,
    body: { sent, skipped },
  };
}
