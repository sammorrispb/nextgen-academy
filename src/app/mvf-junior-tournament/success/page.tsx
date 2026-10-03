import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import {
  COURTS_TEXT,
  GUARANTEED_GAMES_TEXT,
  MEDALS_TEXT,
  MVF_JUNIOR_TOURNAMENT_ADDRESS,
  MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_DATE_ISO,
  MVF_JUNIOR_TOURNAMENT_KIND,
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_TITLE,
  MVF_JUNIOR_TOURNAMENT_VENUE,
  NO_REFUNDS_TEXT,
  RAIN_OR_SHINE_TEXT,
  findMvfTournamentDivision,
} from "@/data/mvf-junior-tournament-2026";

export const metadata: Metadata = {
  title: "Tournament registration status — MVF Junior Tournament",
  description: `Check your payment status and tournament details for the Next Gen MVF Junior Tournament at ${MVF_JUNIOR_TOURNAMENT_VENUE}.`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ inv?: string | string[]; division?: string | string[] }>;
}

type ReceiptState = "unavailable" | "paid" | "pending" | "closed";

function safePayUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["invoice.stripe.com", "pay.stripe.com"].includes(url.hostname) ? value : null;
  } catch {
    return null;
  }
}

export default async function MvfJuniorTournamentSuccessPage({
  searchParams,
}: PageProps) {
  const { inv } = await searchParams;
  let state: ReceiptState = "unavailable";
  let divisionLabel = "";
  let amount = "";
  let payUrl: string | null = null;

  // A redirect is not proof of payment. Scope the read to this event, keep
  // the public receipt free of child/contact fields, and fail unavailable.
  if (typeof inv === "string" && /^in_[A-Za-z0-9]+$/.test(inv) && inv.length <= 255 && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const invoice = await stripe.invoices.retrieve(inv);
      const m = invoice.metadata ?? {};
      const division = findMvfTournamentDivision(m.division);
      if (invoice.id === inv && m.kind === MVF_JUNIOR_TOURNAMENT_KIND &&
          m.event_date === MVF_JUNIOR_TOURNAMENT_DATE_ISO && division && invoice.currency === "usd") {
        if (invoice.status === "paid" || invoice.status === "open") {
          const cents = invoice.status === "paid" ? invoice.amount_paid : invoice.amount_due;
          if (Number.isSafeInteger(cents) && cents >= 0 && (invoice.status === "paid" || cents > 0)) {
            state = invoice.status === "paid" ? "paid" : "pending";
            amount = (cents / 100).toFixed(2);
            divisionLabel = division.label;
            if (state === "pending") payUrl = safePayUrl(invoice.hosted_invoice_url);
          }
        } else if (["draft", "void", "uncollectible"].includes(invoice.status ?? "")) {
          state = "closed";
        }
      }
    } catch {
      // Provider errors can contain invoice or customer details.
      console.error("[mvf-junior-tournament/success] payment status unavailable");
    }
  }

  const heading = state === "paid" ? "Payment received" : state === "pending"
    ? "One step left: pay your entry fee" : state === "closed"
      ? "Contact Coach Sam about your invoice" : "We couldn't verify your payment status";

  return (
    <main className="bg-ngpa-navy min-h-screen">
      <section className="px-5 sm:px-8 pt-16 pb-10 max-w-2xl mx-auto">
        <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">
          Tournament registration status
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">
          {heading}
        </h1>
        <p className="text-ngpa-white/80 text-lg mt-4">
          {MVF_JUNIOR_TOURNAMENT_TITLE}
          {divisionLabel ? ` — ${divisionLabel}` : ""},{" "}
          {MVF_JUNIOR_TOURNAMENT_DATE_LABEL},{" "}
          {MVF_JUNIOR_TOURNAMENT_TIME_LABEL}.
          {state === "paid" ? ` Payment received: $${amount}.` : ""}
        </p>
        {state === "pending" && (
          <p className="text-ngpa-white/70 mt-3">
            Your entry fee is ${amount}. Pay your invoice to lock your
            player&rsquo;s spot. Check your invoice email, including spam.
            {payUrl && (
              <>
                {" "}
                <a
                  href={payUrl}
                  className="text-ngpa-teal-bright underline hover:text-ngpa-teal font-bold"
                >
                  Pay the entry fee
                </a>
              </>
            )}
          </p>
        )}
        {state === "closed" && (
          <p className="text-ngpa-white/70 mt-3">
            This invoice isn&rsquo;t available to pay here. Contact Coach Sam
            to check your registration before submitting another form.
          </p>
        )}
        {state === "unavailable" && (
          <p className="text-ngpa-white/70 mt-3">
            This page can&rsquo;t confirm a payment or a reserved spot. Check
            your Stripe invoice and payment receipt, or try this page again.
            If you haven&rsquo;t submitted a form, start at the{" "}
            <Link href="/mvf-junior-tournament" className="text-ngpa-teal-bright underline hover:text-ngpa-teal">
              tournament registration page
            </Link>.
          </p>
        )}
        <p className="text-ngpa-white/70 mt-3">
          {state === "paid" ? "Keep your Stripe payment receipt and check your email for tournament details. " : ""}
          If you need help checking your invoice or registration, text Coach Sam at{" "}
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
            {MVF_JUNIOR_TOURNAMENT_VENUE}, {MVF_JUNIOR_TOURNAMENT_ADDRESS}.{" "}
            {COURTS_TEXT}
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
