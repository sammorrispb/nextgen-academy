import { withCronAlert } from "@/lib/cron-alert";
import { runMvfTournamentPreEventReminder } from "@/lib/mvf-tournament-pre-event-run";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

/**
 * Daily cron, date-gated: on the send date (ET) only, emails every PAID MVF
 * Junior Tournament registrant the pre-event reminder — check-in procedures,
 * what to bring, and a last call to share the registration link with
 * friends. Every other day it no-ops with zero failures. The body lives in
 * src/lib/mvf-tournament-pre-event-run.ts so a spec can run it on the send
 * date; this route never overrides the date.
 */
export const GET = withCronAlert("mvf-tournament-pre-event-reminder", () =>
  runMvfTournamentPreEventReminder(),
);
