import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Camp Confirmed · Next Gen Pickleball Academy",
  description: "Your camper is registered. See you on the court.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ cs?: string }>;
}

export default async function CampSuccessPage({ searchParams }: PageProps) {
  const { cs } = await searchParams;

  let childName = "";
  let campTitle = "";
  let campWeek = "";
  let optionLabel = "";
  let amountPaid = "";

  if (cs && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const checkout = await stripe.checkout.sessions.retrieve(cs);
      const m = checkout.metadata ?? {};
      childName = String(m.child_first_name ?? "");
      campTitle = String(m.camp_title ?? "");
      campWeek = String(m.camp_week ?? "");
      optionLabel = String(m.option_label ?? "");
      amountPaid = ((checkout.amount_total ?? 0) / 100).toFixed(2);
    } catch (err) {
      console.error("[camp/success] failed to load checkout", err);
    }
  }

  return (
    <section className="bg-ngpa-navy py-20 px-4 sm:px-6 lg:px-8 min-h-[60vh]">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ngpa-teal/15 text-ngpa-teal-bright text-xs font-bold tracking-wider uppercase mb-4">
          Camp confirmed
        </div>

        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-ngpa-white">
          See you at camp{childName ? `, ${childName}` : ""}!
        </h1>

        {(campTitle || campWeek) && (
          <div className="mt-8 bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-left">
            {campTitle && (
              <p className="text-base font-bold text-ngpa-white mb-2">
                {campTitle}
                {optionLabel ? ` · ${optionLabel}` : ""}
              </p>
            )}
            {campWeek && (
              <p className="text-sm text-ngpa-muted">
                <span className="text-ngpa-white font-semibold">When: </span>
                {campWeek} (Mon–Thu)
              </p>
            )}
            <p className="text-sm text-ngpa-muted mt-1">
              <span className="text-ngpa-white font-semibold">Where: </span>
              Gaithersburg, MD — we&rsquo;ll email the exact site before camp.
            </p>
            {amountPaid && amountPaid !== "0.00" && (
              <p className="text-sm text-ngpa-muted mt-1">
                <span className="text-ngpa-white font-semibold">Paid: </span>$
                {amountPaid}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 text-sm text-ngpa-muted leading-relaxed max-w-md mx-auto">
          <p>
            A confirmation email is on its way with everything you need. Camp
            runs rain or shine. Questions? Text Coach Sam at 301-325-4731.
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/camp"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-ngpa-teal text-ngpa-deep font-bold hover:bg-ngpa-teal-bright transition-colors text-base"
          >
            Register another week
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
