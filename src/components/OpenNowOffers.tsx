import Link from "next/link";
import {
  buildOpenNowOffers,
  fallRegistrationOpen,
} from "@/lib/open-now-offers";

/**
 * What a parent can act on TODAY, shown beside the waitlist form.
 *
 * The empty-state waitlist is the primary conversion surface whenever the
 * drop-in schedule is dark, and until now it offered a parent nothing but a
 * wait. Offer data + gating lives in `@/lib/open-now-offers` so this block and
 * the waitlist confirmation email always list the same things.
 *
 * Deliberately no seat counts: those live behind a Notion read, and a
 * fabricated count is worse than none. /fall shows the real numbers.
 */
export default function OpenNowOffers() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const offers = buildOpenNowOffers(todayIso, fallRegistrationOpen());

  if (offers.length === 0) return null;

  return (
    <section
      aria-labelledby="open-now-heading"
      className="mt-6 bg-ngpa-panel/60 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7"
    >
      <p className="font-heading text-xs font-bold text-ngpa-lime uppercase tracking-[0.2em] mb-2 text-center">
        Open right now
      </p>
      <h3
        id="open-now-heading"
        className="font-heading text-lg sm:text-xl font-black text-ngpa-white mb-5 tracking-tight text-center"
      >
        You don&rsquo;t have to wait to get started.
      </h3>

      <ul className="space-y-3.5">
        {offers.map((offer) => (
          <li key={offer.href}>
            <Link
              href={offer.href}
              className="group block rounded-xl bg-ngpa-deep/60 border border-ngpa-slate/60 p-4 sm:p-5 hover:border-ngpa-teal/60 hover:bg-ngpa-deep transition-all min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ngpa-teal"
            >
              <p className="font-heading text-[10px] font-bold text-ngpa-teal uppercase tracking-[0.16em] mb-1.5">
                {offer.eyebrow}
              </p>
              <p className="font-heading text-base font-black text-ngpa-white tracking-tight mb-1.5">
                {offer.title}
              </p>
              <p className="text-sm text-ngpa-white/70 leading-relaxed mb-3">
                {offer.detail}
              </p>
              <span className="inline-flex items-center gap-1.5 font-heading text-sm font-bold text-ngpa-cyan group-hover:text-ngpa-teal-bright transition-colors">
                {offer.cta}
                <span aria-hidden="true">&rarr;</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
