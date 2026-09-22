import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import {
  GUARANTEED_GAMES_TEXT,
  MEDALS_TEXT,
  MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_TITLE,
  MVF_JUNIOR_TOURNAMENT_VENUE,
  NO_REFUNDS_TEXT,
  RAIN_OR_SHINE_TEXT,
  findMvfTournamentDivision,
} from "@/data/mvf-junior-tournament-2026";

export const metadata: Metadata = {
  title: "You're In — MVF Junior Tournament",
  description:
    "Your player is registered for the Next Gen MVF Junior Tournament at Apple Ridge Courts. See you Saturday.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ inv?: string; division?: string }>;
}

export default async function MvfJuniorTournamentSuccessPage({
  searchParams,
}: PageProps) {
  const { inv, division: divisionSlug } = await searchParams;

  let childName = "";
  let divisionLabel = "";
  let amountPaid = "";
  let parentEmail = "";
  let payUrl: string | null = null;
  let paid = false;

  // The Stripe lookup only personalises the page. Everything a parent
  // actually needs — the date, time, venue — renders from the tournament
  // config below, so a missing lookup or a slow Stripe call downgrades the
  // greeting rather than leaving a confirmation screen with nothing on it.
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      if (inv) {
        const invoice = await stripe.invoices.retrieve(inv);
        const m = invoice.metadata ?? {};
        const first = String(m.child_first_name ?? "");
        const last = String(m.child_last_name ?? "");
        childName = `${first} ${last}`.trim();
        divisionLabel = String(m.division_label ?? "");
        paid = invoice.status === "paid";
        amountPaid = (
          (paid ? invoice.amount_paid : invoice.amount_due) / 100
        ).toFixed(2);
        parentEmail = invoice.customer_email ?? "";
        payUrl = invoice.hosted_invoice_url ?? null;
      }
    } catch (err) {
      console.error("[mvf-junior-tournament/success] failed to load payment", err);
    }
  }

  const divisionFromUrl = divisionSlug
    ? findMvfTournamentDivision(divisionSlug)
    : undefined;
  if (!divisionLabel && divisionFromUrl) {
    divisionLabel = divisionFromUrl.label;
  }

  return (
    <main className="bg-ngpa-navy min-h-screen">
      <section className="px-5 sm:px-8 pt-16 pb-10 max-w-2xl mx-auto">
        <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">
          You&rsquo;re in
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">
          {childName ? `${childName} has a spot` : "Registration confirmed"}
        </h1>
        <p className="text-ngpa-white/80 text-lg mt-4">
          {MVF_JUNIOR_TOURNAMENT_TITLE}
          {divisionLabel ? ` — ${divisionLabel}` : ""},{" "}
          {MVF_JUNIOR_TOURNAMENT_DATE_LABEL},{" "}
          {MVF_JUNIOR_TOURNAMENT_TIME_LABEL}.
          {paid && amountPaid ? ` Paid $${amountPaid}.` : ""}
        </p>
        {!paid && inv && (
          <p className="text-ngpa-white/70 mt-3">
            Your invoice
            {parentEmail ? (
              <>
                {" "}is on its way to{" "}
                <span className="text-ngpa-white font-bold">{parentEmail}</span>
              </>
            ) : (
              " is ready"
            )}
            {amountPaid ? ` ($${amountPaid})` : ""} — pay it online to lock the
            spot.
            {payUrl && (
              <>
                {" "}
                <a
                  href={payUrl}
                  className="text-ngpa-teal-bright underline hover:text-ngpa-teal font-bold"
                >
                  Pay now
                </a>
              </>
            )}
          </p>
        )}
        <p className="text-ngpa-white/70 mt-3">
          A confirmation email with what to bring is on its way. If it
          hasn&rsquo;t landed in a few minutes, check spam &mdash; then text
          Coach Sam at{" "}
          <a
            href="tel:+13013254731"
            className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
          >
            301-325-4731
          </a>
          .
        </p>
      </section>

      <section className="px-5 sm:px-8 pb-10 max-w-2xl mx-auto">
        <div className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate/60">
          <h2 className="font-heading text-xl font-black text-ngpa-white">
            Tournament day
          </h2>
          <p className="text-ngpa-white/70 text-sm mt-3">
            <strong className="text-ngpa-white">When:</strong>{" "}
            {MVF_JUNIOR_TOURNAMENT_DATE_LABEL},{" "}
            {MVF_JUNIOR_TOURNAMENT_TIME_LABEL}
          </p>
          <p className="text-ngpa-white/70 text-sm mt-2">
            <strong className="text-ngpa-white">Where:</strong>{" "}
            {MVF_JUNIOR_TOURNAMENT_VENUE}
          </p>
          <p className="text-ngpa-white/70 text-sm mt-2">
            <strong className="text-ngpa-white">Format:</strong> rotating
            partner round robin. {GUARANTEED_GAMES_TEXT} {MEDALS_TEXT}
          </p>
          <p className="text-ngpa-white/70 text-sm mt-2">
            <strong className="text-ngpa-white">{NO_REFUNDS_TEXT}</strong>{" "}
            {RAIN_OR_SHINE_TEXT}
          </p>
          <p className="text-ngpa-white/70 text-sm mt-2">
            Bring a refillable water bottle and court shoes; we have loaner
            paddles.
          </p>
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
