import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import {
  MONDAY_GIRLS_MONDAYS,
  MONDAY_GIRLS_RAIN_DATES,
  MONDAY_GIRLS_SEASON_LABEL,
  MONDAY_GIRLS_SKIPPED_DATE,
  MONDAY_GIRLS_SKIPPED_REASON,
  MONDAY_GIRLS_VENUE,
} from "@/data/monday-girls-2026";
import { MONDAY_GIRLS_SEASON_TITLE } from "@/data/monday-girls-season-2026";

export const metadata: Metadata = {
  title: "You're In · Next Gen Pickleball Academy",
  description:
    "Your player is registered for the Monday Girls Beginner Group. See you Monday.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MONTH_DAY: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
};

function mondayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", MONTH_DAY);
}

interface PageProps {
  searchParams: Promise<{ cs?: string }>;
}

export default async function MondayGirlsSuccessPage({
  searchParams,
}: PageProps) {
  const { cs } = await searchParams;

  let childName = "";
  let groupTime = "";
  let amountPaid = "";

  // The Stripe lookup only personalises the page. Everything a parent actually
  // needs — the six Mondays, the skipped week, the venue — renders from the
  // season config below, so a missing `cs` or a slow Stripe call downgrades the
  // greeting rather than leaving a confirmation screen with nothing on it.
  if (cs && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const checkout = await stripe.checkout.sessions.retrieve(cs);
      const m = checkout.metadata ?? {};
      childName = String(m.child_first_name ?? "");
      groupTime = String(m.group_time ?? "");
      amountPaid = ((checkout.amount_total ?? 0) / 100).toFixed(2);
    } catch (err) {
      console.error("[monday-girls/success] failed to load checkout", err);
    }
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
          {MONDAY_GIRLS_SEASON_TITLE} &mdash; Mondays{" "}
          {groupTime || "6:00–7:00 PM"}, {MONDAY_GIRLS_SEASON_LABEL}.
          {amountPaid ? ` Paid $${amountPaid}.` : ""}
        </p>
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
            Your Mondays
          </h2>
          <ul className="mt-3 space-y-2">
            {MONDAY_GIRLS_MONDAYS.map((iso) => (
              <li
                key={iso}
                className="flex items-center gap-3 text-ngpa-white/85"
              >
                <span className="h-2 w-2 rounded-full bg-ngpa-teal shrink-0" />
                <time dateTime={iso}>{mondayLabel(iso)}</time>
              </li>
            ))}
          </ul>
          <p className="text-ngpa-white/70 text-sm mt-4">
            <strong className="text-ngpa-white">
              No session{" "}
              <time dateTime={MONDAY_GIRLS_SKIPPED_DATE}>
                {mondayLabel(MONDAY_GIRLS_SKIPPED_DATE)}
              </time>
              .
            </strong>{" "}
            {MONDAY_GIRLS_SKIPPED_REASON}
          </p>
          <p className="text-ngpa-white/70 text-sm mt-3">
            <strong className="text-ngpa-white">Where:</strong>{" "}
            {MONDAY_GIRLS_VENUE}
          </p>
          <p className="text-ngpa-white/70 text-sm mt-3">
            Rained out? We make it up on{" "}
            {MONDAY_GIRLS_RAIN_DATES.map(mondayLabel).join(" or ")} and text you
            before you leave the house.
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
