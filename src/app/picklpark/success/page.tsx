import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import {
  PICKLPARK_MAKEUP_DATES,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_SATURDAYS,
  PICKLPARK_VENUE,
} from "@/data/picklpark-2026";
import { PICKLPARK_SEASON_TITLE } from "@/data/picklpark-season-2026";

export const metadata: Metadata = {
  title: "Season Confirmed · Next Gen Pickleball Academy",
  description:
    "Your player is registered for the Pickl Park Saturday season. See you Saturday.",
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
  searchParams: Promise<{ cs?: string }>;
}

export default async function PicklParkSuccessPage({ searchParams }: PageProps) {
  const { cs } = await searchParams;

  let childName = "";
  let groupLabel = "";
  let groupTime = "";
  let amountPaid = "";

  // The Stripe lookup only personalises the page. Everything a parent actually
  // needs — the six Saturdays, the makeup date, the venue — renders from the
  // season config below, so a missing `cs` or a slow Stripe call downgrades the
  // greeting rather than leaving a confirmation screen with nothing on it.
  if (cs && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const checkout = await stripe.checkout.sessions.retrieve(cs);
      const m = checkout.metadata ?? {};
      childName = String(m.child_first_name ?? "");
      groupLabel = String(m.group_label ?? "");
      groupTime = String(m.group_time ?? "");
      amountPaid = ((checkout.amount_total ?? 0) / 100).toFixed(2);
    } catch (err) {
      console.error("[picklpark/success] failed to load checkout", err);
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

        <div className="mt-8 bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-left">
          <p className="text-base font-bold text-ngpa-white mb-2">
            {PICKLPARK_SEASON_TITLE}
            {groupLabel ? ` · ${groupLabel}` : ""}
          </p>
          <p className="text-sm text-ngpa-muted">
            <span className="text-ngpa-white font-semibold">Season: </span>
            Saturdays, {PICKLPARK_SEASON_LABEL}
            {groupTime ? ` — ${groupTime}` : ""}
          </p>
          <p className="text-sm text-ngpa-muted mt-1">
            <span className="text-ngpa-white font-semibold">Where: </span>
            {PICKLPARK_VENUE}
          </p>
          {amountPaid && amountPaid !== "0.00" && (
            <p className="text-sm text-ngpa-muted mt-1">
              <span className="text-ngpa-white font-semibold">Paid: </span>$
              {amountPaid}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-ngpa-slate/60">
            <p className="text-sm text-ngpa-white font-semibold mb-2">
              Your Saturdays
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {PICKLPARK_SATURDAYS.map((d) => (
                <li key={d} className="text-sm text-ngpa-muted font-mono">
                  <time dateTime={d}>{saturdayLabel(d)}</time>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ngpa-muted/80 mt-3">
              Makeup date if a Saturday can&rsquo;t run:{" "}
              {PICKLPARK_MAKEUP_DATES.map((d, i) => (
                <span key={d}>
                  {i > 0 && " or "}
                  <time dateTime={d}>{saturdayLabel(d)}</time>
                </span>
              ))}
              .
            </p>
          </div>
        </div>

        <div className="mt-6 text-sm text-ngpa-muted leading-relaxed max-w-md mx-auto space-y-3">
          <p>
            A confirmation email is on its way with everything to bring each
            week. Add the dates above to your calendar and you&rsquo;re set.
          </p>
          <p>
            Questions? Text Coach Sam at 301-325-4731.
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/picklpark"
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
