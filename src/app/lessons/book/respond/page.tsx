import type { Metadata } from "next";
import Link from "next/link";
import { verifyBookingToken } from "@/lib/lesson-booking-token";
import { formatLongDate } from "@/lib/format-date";
import CounterOfferResponse from "@/components/CounterOfferResponse";

export const metadata: Metadata = {
  title: "Coach's Suggested Time",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string; decision?: string }>;
}

export default async function CounterOfferRespondPage({ searchParams }: PageProps) {
  const { token, decision } = await searchParams;
  const payload = token ? verifyBookingToken(token) : null;

  if (!token || !payload || payload.type !== "counter") {
    return (
      <section className="bg-ngpa-deep min-h-[60vh] flex items-center px-4 py-20">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="font-heading text-3xl font-black text-ngpa-white">Link expired or invalid</h1>
          <p className="mt-4 text-ngpa-white/70">
            This offer link doesn&apos;t check out. Check your email for the latest message from your coach.
          </p>
          <Link href="/lessons" className="inline-block mt-8 text-ngpa-teal font-semibold hover:underline">
            ← Back to lessons
          </Link>
        </div>
      </section>
    );
  }

  const suggested = decision === "decline" ? "decline" : "accept";

  return (
    <section className="bg-ngpa-deep min-h-[70vh] px-4 sm:px-6 lg:px-10 py-12">
      <div className="max-w-xl mx-auto text-center">
        <p className="text-ngpa-teal font-semibold tracking-wide text-sm uppercase">From your coach</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mt-2">
          A different time for {payload.childFirstName}?
        </h1>
        <div className="mt-6 rounded-2xl bg-ngpa-white/5 ring-1 ring-ngpa-white/10 p-6">
          <p className="text-2xl font-bold text-ngpa-white">
            {formatLongDate(payload.date)} at {payload.time}
          </p>
          {payload.note && (
            <p className="mt-3 text-ngpa-white/70 italic">“{payload.note}”</p>
          )}
        </div>
        <div className="mt-8">
          <CounterOfferResponse token={token} suggested={suggested} />
        </div>
      </div>
    </section>
  );
}
