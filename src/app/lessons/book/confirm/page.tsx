import type { Metadata } from "next";
import Link from "next/link";
import { verifyBookingToken } from "@/lib/lesson-booking-token";
import { formatLongDate } from "@/lib/format-date";
import CoachBookingDecision from "@/components/CoachBookingDecision";

export const metadata: Metadata = {
  title: "Lesson Booking Request",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function CoachBookingConfirmPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const payload = token ? verifyBookingToken(token) : null;

  if (!token || !payload || payload.type !== "request") {
    return (
      <section className="bg-ngpa-deep min-h-[60vh] flex items-center px-4 py-20">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="font-heading text-3xl font-black text-ngpa-white">Link expired or invalid</h1>
          <p className="mt-4 text-ngpa-white/70">
            This booking link doesn&apos;t check out. Open the latest booking-request email for a fresh link.
          </p>
          <Link href="/lessons" className="inline-block mt-8 text-ngpa-teal font-semibold hover:underline">
            ← Back to lessons
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-ngpa-deep min-h-[70vh] px-4 sm:px-6 lg:px-10 py-12">
      <div className="max-w-2xl mx-auto">
        <p className="text-ngpa-teal font-semibold tracking-wide text-sm uppercase">Coach decision</p>
        <h1 className="font-heading text-3xl font-black text-ngpa-white tracking-tight mt-2">
          {payload.childFirstName}&apos;s {payload.lessonTitle.toLowerCase()}
        </h1>
        <div className="mt-4 rounded-2xl bg-ngpa-white/5 ring-1 ring-ngpa-white/10 p-5 text-sm text-ngpa-white/80 space-y-1">
          <p><strong className="text-ngpa-white">Parent:</strong> {payload.parentName} — {payload.parentEmail} — {payload.parentPhone}</p>
          <p><strong className="text-ngpa-white">Requested:</strong> {formatLongDate(payload.createdAt.slice(0, 10))}</p>
          {payload.notes && <p><strong className="text-ngpa-white">Notes:</strong> {payload.notes}</p>}
          <p className="text-ngpa-white/50">Invoice: {payload.invoiceId}</p>
        </div>
        <div className="mt-8">
          <CoachBookingDecision
            token={token}
            slots={payload.slots.map((s) => ({
              date: s.date,
              time: s.time,
              label: `${formatLongDate(s.date)} at ${s.time}`,
            }))}
          />
        </div>
      </div>
    </section>
  );
}
