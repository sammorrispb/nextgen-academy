import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Drop-in Confirmed · Next Gen Pickleball Academy",
  description: "Your drop-in is reserved. See you on the court.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ cs?: string }>;
}

export default async function ScheduleSuccessPage({ searchParams }: PageProps) {
  const { cs } = await searchParams;

  let parentName = "";
  let childName = "";
  let sessionTitle = "";
  let sessionDate = "";
  let sessionStart = "";
  let location = "";

  if (cs && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const checkout = await stripe.checkout.sessions.retrieve(cs);
      const m = checkout.metadata ?? {};
      parentName = String(m.parent_name ?? "");
      childName = String(m.child_first_name ?? "");
      sessionTitle = String(m.session_title ?? "");
      sessionDate = String(m.session_date ?? "");
      sessionStart = String(m.session_start ?? "");
      location = String(m.session_location ?? "");
    } catch (err) {
      console.error("[schedule/success] failed to load checkout", err);
    }
  }

  return (
    <section className="bg-ngpa-navy py-20 px-4 sm:px-6 lg:px-8 min-h-[60vh]">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ngpa-lime text-ngpa-black text-xs font-bold tracking-wider uppercase mb-4">
          <span aria-hidden="true">🎾</span>
          Drop-in confirmed
        </div>

        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-ngpa-white">
          See you on the court
          {childName ? `, ${childName}` : ""}!
        </h1>

        {(sessionTitle || sessionDate) && (
          <div className="mt-8 bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-left">
            {sessionTitle && (
              <p className="text-base font-bold text-ngpa-white mb-2">
                {sessionTitle}
              </p>
            )}
            {sessionDate && (
              <p className="text-sm text-ngpa-muted">
                <span className="text-ngpa-white font-semibold">When: </span>
                {formatLongDate(sessionDate)}
                {sessionStart ? ` · ${sessionStart}` : ""}
              </p>
            )}
            {location && (
              <p className="text-sm text-ngpa-muted mt-1">
                <span className="text-ngpa-white font-semibold">Where: </span>
                {location}
              </p>
            )}
            {parentName && (
              <p className="text-sm text-ngpa-muted mt-1">
                <span className="text-ngpa-white font-semibold">Booked by: </span>
                {parentName}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 text-sm text-ngpa-muted leading-relaxed max-w-md mx-auto">
          <p>
            A confirmation email is on its way. Drop-in payments are
            non-refundable. Bring water, court shoes, and a paddle if you
            have one — we have loaners if you don&rsquo;t.
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-ngpa-lime text-ngpa-black font-bold hover:bg-ngpa-cyan transition-colors text-base"
          >
            Book another session
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full border-2 border-ngpa-slate text-ngpa-white font-bold hover:border-ngpa-lime hover:text-ngpa-lime transition-colors text-base"
          >
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
