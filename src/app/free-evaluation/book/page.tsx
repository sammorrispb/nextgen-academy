import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import EvalBookForm, { type DisplaySlot } from "@/components/EvalBookForm";
import { fetchOpenEvalSlots } from "@/lib/notion-eval-slots";
import { formatLongDate } from "@/lib/eval-confirmation-send";
import { breadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { site } from "@/data/site";

const PAGE_TITLE = "Book Your Free Evaluation — Next Gen Pickleball Academy";
const PAGE_DESCRIPTION =
  "Request an open time for your child's free 30-minute pickleball evaluation in Montgomery County, MD. Coach Sam confirms within 24 hours — no phone tag.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/free-evaluation/book" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "https://nextgenpbacademy.com/free-evaluation/book",
    images: ["/opengraph-image"],
  },
};

// Same 5-min ISR as /schedule — a just-booked slot can display for up to
// 5 minutes; POST /api/eval-book's claim-then-verify turns that stale click
// into a friendly "just taken" and the form refetches fresh slots.
export const revalidate = 300;

export default async function EvalBookPage() {
  // Page render stays fail-soft on a Notion error (no-open-slots state); the
  // client's GET refetch is the path that distinguishes error from empty.
  const { slots } = await fetchOpenEvalSlots();
  const displaySlots: DisplaySlot[] = slots.map((s) => ({
    id: s.id,
    date: s.date,
    dateLabel: formatLongDate(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    location: s.location,
  }));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Free Evaluation", url: `${SITE_URL}/free-evaluation` },
          { name: "Book", url: `${SITE_URL}/free-evaluation/book` },
        ])}
      />

      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-x-0 top-0 h-96 bg-teal-glow pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Free Evaluation
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            Pick your time.
            <br />
            <span className="text-ngpa-teal">Coach Sam takes it from there.</span>
          </h1>
          <p className="mt-5 text-lg text-ngpa-white/85 leading-relaxed max-w-xl">
            30 minutes with a real coach, ages 6&ndash;16, no cost. Request
            any open time below — Coach Sam confirms within 24 hours, then
            your confirmation email and calendar invite arrive.
          </p>

          <div className="mt-10">
            {displaySlots.length > 0 ? (
              <EvalBookForm initialSlots={displaySlots} />
            ) : (
              <div className="bg-ngpa-panel/80 backdrop-blur rounded-2xl p-8 border border-ngpa-slate/60 text-center">
                <h2 className="font-heading text-2xl font-black text-ngpa-white mb-3 tracking-tight">
                  No open times right now
                </h2>
                <p className="text-ngpa-white/75 text-base mb-6 max-w-md mx-auto">
                  New evaluation slots go up every week. Leave your info and
                  we&rsquo;ll reach out within 24 hours to find a time that
                  works.
                </p>
                <Link
                  href="/free-evaluation"
                  className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
                >
                  Request an evaluation
                </Link>
              </div>
            )}
          </div>

          <p className="mt-10 text-center text-base text-ngpa-white/65">
            Don&rsquo;t see a time that works?{" "}
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline transition-colors"
            >
              Call or text Sam at {site.phone}
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
