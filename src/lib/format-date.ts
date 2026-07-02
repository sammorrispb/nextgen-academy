/**
 * Shared date formatting for ISO date strings (YYYY-MM-DD, or full ISO —
 * anything beyond the date is sliced off). Anchors at 12:00Z so the rendered
 * day never shifts on Vercel's UTC build/runtime servers (the recurring
 * date-only off-by-one hazard); garbage input echoes back unformatted rather
 * than rendering "Invalid Date".
 *
 * TODO(F10 follow-up, out of scope for the inbox PR to avoid churning
 * unrelated pages): migrate the remaining local formatLongDate copies here —
 * same short form in src/app/commit/[token]/page.tsx,
 * src/app/schedule/cancel/page.tsx, src/app/schedule/success/page.tsx,
 * src/app/schedule/[slug]/page.tsx, src/app/camp/page.tsx,
 * src/app/camp/[slug]/page.tsx, src/app/coach/cancel-session/[token]/page.tsx,
 * src/app/coach/(authed)/[slug]/page.tsx, src/components/ReserveButton.tsx,
 * src/components/SessionDetailsModal.tsx,
 * src/app/api/cron/crew-autoreserve/route.ts,
 * src/app/api/stripe/webhook/route.ts, src/lib/crew-confirm.ts,
 * src/lib/eval-confirmation-send.ts (exported — repoint its importers),
 * src/lib/cancel-dropin.ts, src/lib/session-cancel.ts,
 * src/lib/session-reschedule.ts; long-form (weekday/month "long") variants in
 * src/app/api/cron/weekly-newsletter/route.ts,
 * src/app/api/cron/dropin-reminder/route.ts,
 * src/app/api/cron/coach-pre-event/route.ts,
 * src/app/api/cron/dropin-post-session/route.ts — parameterize or add a
 * formatLongDateVerbose alongside.
 */
export function formatLongDate(date: string): string {
  if (!date) return "";
  const iso = date.slice(0, 10);
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
