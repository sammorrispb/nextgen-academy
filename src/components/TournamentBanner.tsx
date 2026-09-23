import Link from "next/link";
import {
  MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  NONRESIDENT_PRICE_USD,
  RESIDENT_PRICE_USD,
} from "@/data/mvf-junior-tournament-2026";

/**
 * Sitewide announcement bar for the MVF Junior Tournament.
 *
 * Sam 2026-09-23: the tournament must be a banner on the NGA site — it is
 * NGA-sold (registration + Stripe invoice payment on /mvf-junior-tournament),
 * and the Link & Dink event shells must not look like the free place to
 * register. This bar points every page at the NGA registration page.
 *
 * TEMPORARY: remove after the event (Sat Oct 24, 2026).
 */
export default function TournamentBanner() {
  return (
    <div className="bg-ngpa-lime text-ngpa-deep">
      <Link
        href="/mvf-junior-tournament"
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-4 py-2 text-center"
      >
        <span className="font-heading text-xs sm:text-sm font-black uppercase tracking-widest">
          MVF Junior Tournament
        </span>
        <span className="text-xs sm:text-sm font-semibold">
          {MVF_JUNIOR_TOURNAMENT_DATE_LABEL} &middot; 10U &amp; 14U &middot; $
          {RESIDENT_PRICE_USD} MV resident / ${NONRESIDENT_PRICE_USD}{" "}
          non-resident
        </span>
        <span className="font-heading text-xs sm:text-sm font-black underline underline-offset-2">
          Register &rarr;
        </span>
      </Link>
    </div>
  );
}
