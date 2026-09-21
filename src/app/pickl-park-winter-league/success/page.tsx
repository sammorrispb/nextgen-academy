import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import {
  PICKL_PARK_WINTER_LEAGUE_SATURDAYS,
  PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL,
  PICKL_PARK_WINTER_LEAGUE_TITLE,
  PICKL_PARK_WINTER_LEAGUE_VENUE,
  findPicklParkWinterLeagueTrack,
} from "@/data/pickl-park-winter-league-2026";

export const metadata: Metadata = {
  title: "You're In — Winter Youth League",
  description:
    "Your player is registered for the Next Gen Winter Youth League at The Pickl Park. See you Saturday.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MONTH_DAY: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
};

function saturdayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", MONTH_DAY);
}

interface PageProps {
  searchParams: Promise<{ inv?: string; track?: string }>;
}

export default async function PicklParkWinterLeagueSuccessPage({
  searchParams,
}: PageProps) {
  const { inv, track: trackSlug } = await searchParams;

  let childName = "";
  let trackLabel = "";
  let trackTime = "";
  let amountPaid = "";
  let parentEmail = "";
  let payUrl: string | null = null;
  let paid = false;

  // The Stripe lookup only personalises the page. Everything a parent
  // actually needs — the six Saturdays, the track time, the venue — renders
  // from the league config below, so a missing lookup or a slow Stripe call
  // downgrades the greeting rather than leaving a confirmation screen with
  // nothing on it.
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      if (inv) {
        const invoice = await stripe.invoices.retrieve(inv);
        const m = invoice.metadata ?? {};
        childName = String(m.child_first_name ?? "");
        trackLabel = String(m.track_label ?? "");
        trackTime = String(m.track_time ?? "");
        paid = invoice.status === "paid";
        amountPaid = (
          (paid ? invoice.amount_paid : invoice.amount_due) / 100
        ).toFixed(2);
        parentEmail = invoice.customer_email ?? "";
        payUrl = invoice.hosted_invoice_url ?? null;
      }
    } catch (err) {
      console.error("[pickl-park-winter-league/success] failed to load payment", err);
    }
  }

  const trackFromUrl = trackSlug ? findPicklParkWinterLeagueTrack(trackSlug) : undefined;
  if (!trackLabel && trackFromUrl) {
    trackLabel = trackFromUrl.label;
    trackTime = trackFromUrl.timeLabel;
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
          {PICKL_PARK_WINTER_LEAGUE_TITLE}
          {trackLabel ? ` — ${trackLabel}` : ""}, {trackTime},{" "}
          {PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL}.
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
          A confirmation email with every date and what to bring is on its way.
          If it hasn&rsquo;t landed in a few minutes, check spam &mdash; then
          text Coach Sam at{" "}
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
            Your Saturdays
          </h2>
          <ul className="mt-3 space-y-2">
            {PICKL_PARK_WINTER_LEAGUE_SATURDAYS.map((iso) => (
              <li
                key={iso}
                className="flex items-center gap-3 text-ngpa-white/85"
              >
                <span className="h-2 w-2 rounded-full bg-ngpa-teal shrink-0" />
                <time dateTime={iso}>{saturdayLabel(iso)}</time>
              </li>
            ))}
          </ul>
          <p className="text-ngpa-white/70 text-sm mt-4">
            <strong className="text-ngpa-white">Where:</strong>{" "}
            {PICKL_PARK_WINTER_LEAGUE_VENUE}
          </p>
          <p className="text-ngpa-white/70 text-sm mt-3">
            Indoors — weather never cancels a session. Bring a refillable water
            bottle and court shoes; we have loaner paddles.
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
