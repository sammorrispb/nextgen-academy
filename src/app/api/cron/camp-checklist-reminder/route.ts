import { withCronAlert, type CronFailure } from "@/lib/cron-alert";
import { runCampChecklistReminder } from "@/lib/camp-checklist-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 7am-ET coach checklist nudge. Vercel cron fires daily (0 11 * * * UTC = 7am
 * EDT; summer camps run on EDT) and no-ops on days with no scheduled camp.
 * Emails the coach allowlist a link to /coach/camp-checklist before drop-off.
 * Auth = Bearer CRON_SECRET (Vercel injects it; a manual curl needs the header).
 *
 * Query params (manual runs):
 *   ?dryRun=1          preview recipients + rendered sample, no send
 *   ?date=2026-06-29   override ET "today" (test a specific camp day)
 *
 * No parent/child data is involved — recipients are coaches only.
 */
export const GET = withCronAlert("camp-checklist-reminder", async (req) => {
  const params = req.nextUrl.searchParams;
  const dryRun = params.get("dryRun") === "1";
  const today = params.get("date") ?? undefined;

  const result = await runCampChecklistReminder({ today, dryRun });

  // A live run that Resend rejected comes back ok:true + sent:false — the one
  // swallowed shape here. Config refusal (ok:false) already 500'd; now alerts.
  const failures: CronFailure[] = [];
  let attempted = 0;
  let succeeded = 0;
  if (!result.ok) {
    failures.push({ signature: result.reason, detail: result.message });
  } else if ("sent" in result) {
    attempted = 1;
    succeeded = result.sent ? 1 : 0;
    if (!result.sent) {
      failures.push({
        signature: "resend_rejected",
        detail: `checklist nudge to ${result.recipientCount} coach(es) was rejected by Resend`,
      });
    }
  }

  return {
    ok: failures.length === 0,
    attempted,
    succeeded,
    failures,
    body: { ...result },
  };
});
