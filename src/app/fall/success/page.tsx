import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import { FALL_VENUE } from "@/data/fall-2026";

export const metadata: Metadata = {
  title: "Season Confirmed · Next Gen Pickleball Academy",
  description: "Your player is registered for the fall season. See you Sunday.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ cs?: string }>;
}

export default async function FallSuccessPage({ searchParams }: PageProps) {
  const { cs } = await searchParams;

  let childName = "";
  let seasonTitle = "";
  let seasonLabel = "";
  let groupLabel = "";
  let groupTime = "";
  let amountPaid = "";

  if (cs && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const checkout = await stripe.checkout.sessions.retrieve(cs);
      const m = checkout.metadata ?? {};
      childName = String(m.child_first_name ?? "");
      seasonTitle = String(m.season_title ?? "");
      seasonLabel = String(m.season_label ?? "");
      groupLabel = String(m.group_label ?? "");
      groupTime = String(m.group_time ?? "");
      amountPaid = ((checkout.amount_total ?? 0) / 100).toFixed(2);
    } catch (err) {
      console.error("[fall/success] failed to load checkout", err);
    }
  }

  return (
    <section className="bg-ngpa-navy py-20 px-4 sm:px-6 lg:px-8 min-h-[60vh]">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ngpa-teal/15 text-ngpa-teal-bright text-xs font-bold tracking-wider uppercase mb-4">
          Season confirmed
        </div>

        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-ngpa-white">
          You&rsquo;re in{childName ? `, ${childName}` : ""}!
        </h1>

        {(seasonTitle || seasonLabel) && (
          <div className="mt-8 bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-left">
            {seasonTitle && (
              <p className="text-base font-bold text-ngpa-white mb-2">
                {seasonTitle}
                {groupLabel ? ` · ${groupLabel}` : ""}
              </p>
            )}
            {seasonLabel && (
              <p className="text-sm text-ngpa-muted">
                <span className="text-ngpa-white font-semibold">Season: </span>
                Sundays, {seasonLabel}
                {groupTime ? ` — ${groupTime}` : ""}
              </p>
            )}
            <p className="text-sm text-ngpa-muted mt-1">
              <span className="text-ngpa-white font-semibold">Where: </span>
              {FALL_VENUE}
            </p>
            {amountPaid && amountPaid !== "0.00" && (
              <p className="text-sm text-ngpa-muted mt-1">
                <span className="text-ngpa-white font-semibold">Paid: </span>$
                {amountPaid}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 text-sm text-ngpa-muted leading-relaxed max-w-md mx-auto space-y-3">
          <p>
            A confirmation email is on its way with every Sunday, the rain
            dates, and what to bring each week.
          </p>
          <p>
            Questions? Text Coach Sam at 301-325-4731.
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/fall"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-ngpa-teal text-ngpa-deep font-bold hover:bg-ngpa-teal-bright transition-colors text-base"
          >
            Back to the season page
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full border-2 border-ngpa-slate text-ngpa-white font-bold hover:border-ngpa-teal hover:text-ngpa-teal transition-colors text-base"
          >
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
