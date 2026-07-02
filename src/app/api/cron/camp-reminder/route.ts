import { withCronAlert, type CronFailure } from "@/lib/cron-alert";
import { runCampReminder } from "@/lib/camp-reminder-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Friday-before-camp reminder. Vercel cron fires every Friday (0 13 * * 5 UTC,
 * ~9am ET); it no-ops on Fridays with no camp the following Monday. Auth =
 * Bearer CRON_SECRET (Vercel injects it; a manual curl needs the same header).
 *
 * Query params (manual runs):
 *   ?dryRun=1        preview recipients + a rendered sample, no send, no writes
 *   ?slug=june-29    target a specific camp instead of the auto Friday→Monday one
 *   ?only=a@b,c@d    restrict the live send to these parent emails (retry failures)
 *
 * Always dry-run first to eyeball the recipient list + copy before a live send
 * (paying-family / child-PII comms — see LSN-014 + Minor-Data Governance).
 */
export const GET = withCronAlert("camp-reminder", async (req) => {
  const params = req.nextUrl.searchParams;
  const dryRun = params.get("dryRun") === "1";
  const slug = params.get("slug") ?? undefined;
  const only = params
    .get("only")
    ?.split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const result = await runCampReminder({ slug, dryRun, only });

  // ok:false = config refusal (already 500'd before; now it also alerts).
  // ok:true live runs can still carry per-recipient/roster-sync failures that
  // used to ride back as counts inside a 200.
  const failures: CronFailure[] = [];
  let attempted = 0;
  let succeeded = 0;
  if (!result.ok) {
    failures.push({ signature: result.reason, detail: result.message });
  } else if ("sent" in result) {
    attempted = result.recipientCount;
    succeeded = result.sent;
    if (result.failed > 0) {
      failures.push({
        signature: "reminder_send_failed",
        detail: `${result.failed} of ${result.recipientCount} pending reminder(s) failed to send`,
      });
    }
    if (result.synced.failed > 0) {
      failures.push({
        signature: "roster_sync_row_failed",
        detail: `${result.synced.failed} roster row(s) failed to sync from Stripe`,
      });
    }
  }

  return {
    attempted,
    succeeded,
    failures,
    body: { ...result },
  };
});
