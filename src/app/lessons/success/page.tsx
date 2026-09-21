import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Lesson Booked",
  description: "Your Next Gen lesson invoice is on its way — a coach will reach out to schedule the hour.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ inv?: string }>;
}

export default async function LessonSuccessPage({ searchParams }: PageProps) {
  const { inv } = await searchParams;

  let lessonTitle = "your lesson";
  let childName = "";
  let parentEmail = "";
  let payUrl: string | null = null;
  let paid = false;

  // The Stripe lookup only personalises the page. Everything a parent actually
  // needs — pay the invoice, expect a coach text — renders from the static
  // copy below, so a missing `inv` or a slow Stripe call downgrades the
  // greeting rather than leaving a confirmation screen with nothing on it.
  if (inv && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const invoice = await stripe.invoices.retrieve(inv);
      const m = invoice.metadata ?? {};
      childName = String(m.child_first_name ?? "");
      lessonTitle =
        m.lesson_title === "Group Lesson" ? "group lesson" : "private lesson";
      parentEmail = invoice.customer_email ?? "";
      payUrl = invoice.hosted_invoice_url ?? null;
      paid = invoice.status === "paid";
    } catch {
      // fall through to the generic confirmation
    }
  }

  return (
    <section className="bg-ngpa-deep min-h-[60vh] flex items-center px-4 sm:px-6 lg:px-10 py-20">
      <div className="max-w-xl mx-auto text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-6 w-16 h-16 rounded-full bg-ngpa-teal/15 ring-1 ring-ngpa-teal/40 flex items-center justify-center"
        >
          <svg
            className="w-8 h-8 text-ngpa-teal"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight">
          You&rsquo;re booked{childName ? `, ${childName}` : ""}.
        </h1>
        <p className="mt-4 text-lg text-ngpa-white/75 leading-relaxed">
          {paid ? (
            <>
              Payment for {lessonTitle} went through. Pick your lesson time
              below — a coach confirms one of your proposed times, usually
              within a day.
            </>
          ) : (
            <>
              Your {lessonTitle} invoice
              {parentEmail ? (
                <>
                  {" "}is on its way to{" "}
                  <span className="text-ngpa-white font-bold">{parentEmail}</span>
                </>
              ) : (
                " is ready"
              )}
              . Pay it online and a Next Gen coach will text you within one
              business day to lock in the hour. Didn&rsquo;t get the invoice
              email? Text Coach Sam at{" "}
              <a
                href="tel:+13013254731"
                className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright"
              >
                301-325-4731
              </a>
              .
            </>
          )}
        </p>
        {paid && inv && (
          <div className="mt-8">
            <Link
              href={`/lessons/book?inv=${encodeURIComponent(inv)}`}
              className="inline-flex items-center justify-center px-8 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
            >
              Pick your lesson time
            </Link>
            <p className="mt-3 text-sm text-ngpa-white/60">
              Propose up to three times — a coach confirms within a day.
            </p>
          </div>
        )}
        {!paid && payUrl && (
          <div className="mt-8">
            <a
              href={payUrl}
              className="inline-flex items-center justify-center px-8 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
            >
              Pay the invoice now
            </a>
          </div>
        )}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
          >
            See this week&rsquo;s sessions
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-8 py-3.5 border border-ngpa-slate/60 text-ngpa-white font-bold rounded-full hover:border-ngpa-teal hover:text-ngpa-teal transition-colors min-h-[48px]"
          >
            Back home
          </Link>
        </div>
      </div>
    </section>
  );
}
