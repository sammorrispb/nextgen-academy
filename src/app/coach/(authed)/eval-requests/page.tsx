// /coach/eval-requests — Sam's confirm/release queue for parent eval
// REQUESTS (flow change 2026-07-02: the public /free-evaluation/book page
// files Status=Requested claims; nothing is confirmed until Sam acts here).
//
// TODO(coach-inbox): when the Coach Inbox pending-count pattern (parallel
// feat/coach-inbox PR) lands, register this queue's Requested count as an
// inbox badge source — not wired here to avoid touching that PR's files.

import Link from "next/link";
import { fetchRequestedEvalSlots } from "@/lib/notion-eval-slots";
import { formatLongDate } from "@/lib/eval-confirmation-send";
import RequestRow from "./RequestRow";

export const dynamic = "force-dynamic";

export default async function EvalRequestsPage() {
  const requests = await fetchRequestedEvalSlots();

  return (
    <>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Free evaluation
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Eval requests
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-8 max-w-2xl">
        Parents picked these times on the booking page and were promised your
        confirmation within 24 hours. <strong>Confirm</strong> sends the real
        confirmation email with the calendar invite (and stamps the CRM Eval
        Date). <strong>Release</strong> reopens the slot and sends nothing —
        use the contact info to reach out and reschedule personally.
      </p>

      {requests.length === 0 ? (
        <div className="bg-ngpa-panel/80 rounded-2xl border border-ngpa-slate/60 p-8 text-center">
          <p className="text-ngpa-white font-bold mb-1">No pending requests</p>
          <p className="text-ngpa-white/65 text-sm">
            New requests land here the moment a parent picks a time (you also
            get an email). If you expected one, check the NGA Eval Slots db in
            Notion.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((slot) => (
            <RequestRow
              key={`${slot.id}-${slot.bookingId}`}
              slot={slot}
              dateLabel={formatLongDate(slot.date)}
            />
          ))}
        </div>
      )}

      <p className="mt-8 text-sm text-ngpa-white/55">
        <Link href="/coach" className="hover:text-ngpa-teal transition-colors">
          ← Back to dashboard
        </Link>
      </p>
    </>
  );
}
