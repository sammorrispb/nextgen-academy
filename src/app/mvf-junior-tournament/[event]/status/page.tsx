import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MvfSeriesReceipt from "@/components/MvfSeriesReceipt";
import { findMvfJuniorSeriesEvent } from "@/data/mvf-junior-series";

export const metadata: Metadata = { title: { absolute: "MVF tournament invoice status" }, robots: { index: false, follow: false }, referrer: "no-referrer" };

// Laid out like the October 24 tournament's status page
// (/mvf-junior-tournament/success): status first, then the tournament-day
// panel. The receipt itself stays client-side so the capability token in the
// URL fragment never reaches the server.
export default async function Page({ params }: { params: Promise<{ event: string }> }) {
  const { event: slug } = await params;
  const event = findMvfJuniorSeriesEvent(slug);
  if (!event) notFound();
  return (
    <main className="bg-ngpa-navy min-h-screen">
      <article className="px-5 sm:px-8 pt-16 pb-10 max-w-2xl mx-auto">
        <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">
          Tournament registration status
        </p>
        <h1 className="font-heading text-lg font-bold text-ngpa-white/80 mt-3">Tournament invoice status · MVF Junior Tournament — {event.monthLabel}</h1>
        <MvfSeriesReceipt event={event.slug} />
      </article>

      <section className="px-5 sm:px-8 pb-10 max-w-2xl mx-auto" aria-labelledby="tournament-day-heading">
        <div className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate/60">
          <h2 id="tournament-day-heading" className="font-heading text-xl font-black text-ngpa-white">Tournament day</h2>
          {/* The fragment token is verified by MvfSeriesReceipt. This server
              panel cannot identify its saved release; do not substitute the
              current listing or active policies for that invoice's terms. */}
          <p className="text-ngpa-white/70 text-sm mt-3">
            Check your invoice and any event notices for the date, time, venue and policies for your registration.
          </p>
          <Link href={`/mvf-junior-tournament/${event.slug}`} className="inline-flex items-center min-h-[48px] text-ngpa-teal-bright underline underline-offset-4 mt-2">
            View current public tournament details
          </Link>
        </div>
      </section>

      <section className="px-5 sm:px-8 pb-20 max-w-2xl mx-auto">
        <Link
          href="/schedule"
          className="inline-block px-6 py-3 bg-ngpa-teal text-ngpa-deep font-heading font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
        >
          See what else is open &rarr;
        </Link>
      </section>
    </main>
  );
}
