import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import { rollupFailure, withCronAlert } from "@/lib/cron-alert";
import { EMAIL_RE } from "@/lib/notion-utils";
import { fetchMvfTournamentRegistrations } from "@/lib/notion-mvf-tournament-registrations";
import {
  MVF_TOURNAMENT_PRE_EVENT_SEND_DATE_ISO,
  mvfTournamentPreEventReminderSubject,
  mvfTournamentPreEventReminderText,
  mvfTournamentPreEventReminderHtml,
  todayEtIso,
} from "@/lib/email/mvf-tournament-pre-event-reminder";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";

/** The one date (ET) this reminder fires: 5 days before Oct 24. */
const SEND_DATE_ISO = MVF_TOURNAMENT_PRE_EVENT_SEND_DATE_ISO;

/**
 * Daily cron, date-gated: on Oct 19, 2026 (ET) only, emails every PAID MVF
 * Junior Tournament registrant the pre-event reminder — check-in procedures,
 * what to bring, and a last call to share the registration link with
 * friends. Every other day it no-ops with zero failures.
 */
export const GET = withCronAlert(
  "mvf-tournament-pre-event-reminder",
  async () => {
    if (todayEtIso() !== SEND_DATE_ISO) {
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
    const stripe = getStripe();

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
    const rejected: string[] = [];

    for (const row of rows) {
      if (!row.parentEmail || !EMAIL_RE.test(row.parentEmail)) {
        skipped++;
        continue;
      }
      // Idempotency: a manual re-trigger on Oct 19 must not double-send.
      // The flag lives on the Stripe invoice (Notion schema isn't API-writable).
      if (row.stripeInvoiceId) {
        try {
          const inv = await stripe.invoices.retrieve(row.stripeInvoiceId);
          if (inv.metadata?.["pre_event_reminder_sent"] === "true") {
            skipped++;
            continue;
          }
        } catch (err) {
          console.error(
            `[cron/mvf-tournament-pre-event-reminder] stripe retrieve failed for ${row.pageId}`,
            err,
          );
          skipped++;
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
      if (row.stripeInvoiceId) {
        try {
          await stripe.invoices.update(row.stripeInvoiceId, {
            metadata: { pre_event_reminder_sent: "true" },
          });
        } catch (err) {
          // Email already landed; the flag write failing only risks a
          // duplicate on a manual re-run, which the cron alert will surface.
          console.error(
            `[cron/mvf-tournament-pre-event-reminder] flag write failed for ${row.pageId}`,
            err,
          );
        }
      }
      sent++;
    }

    const failures = [];
    const rolled = rollupFailure(
      "resend_rejected",
      rejected,
      "pre-event reminders rejected",
    );
    if (rolled) failures.push(rolled);

    return {
      attempted: sent + skipped + rejected.length,
      succeeded: sent,
      failures,
      body: { sent, skipped },
    };
  },
);
