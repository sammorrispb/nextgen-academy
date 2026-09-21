import type { Metadata } from "next";
import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import LessonPurchaseForm from "@/components/LessonPurchaseForm";
import { LESSON_PRODUCTS, LESSON_PRICE_USD } from "@/data/lessons";

export const metadata: Metadata = {
  title: "Private & Group Lessons",
  description:
    "One-hour private or group pickleball lessons for kids 6–16 in Montgomery County, MD — $60 per hour. A Next Gen coach, scheduled around your family.",
  alternates: { canonical: "/lessons" },
};

// Ships dark until at least one lesson Stripe price exists — no family should
// reach a lesson form that cannot charge.
const lessonsLive =
  !!process.env.STRIPE_PRIVATE_LESSON_PRICE_ID ||
  !!process.env.STRIPE_GROUP_LESSON_PRICE_ID;

export default function LessonsPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-ngpa-deep pt-16 sm:pt-24 pb-12 px-4 sm:px-6 lg:px-10">
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-ngpa-teal/10 blur-3xl"
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="font-heading text-sm sm:text-base font-bold text-ngpa-teal tracking-tight mb-3">
            1-on-1 or small group
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.02] tracking-tight">
            Lessons that meet your kid{" "}
            <span className="text-ngpa-teal">where they are</span>.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-ngpa-white/80 leading-relaxed max-w-2xl mx-auto">
            One hour with a Next Gen coach — private or in a small
            level-matched group.{" "}
            <strong className="text-ngpa-white">
              ${LESSON_PRICE_USD} per hour
            </strong>
            , scheduled around your family. Pay online now; a coach texts you
            within one business day to lock in the hour.
          </p>
        </div>
      </section>

      <section className="bg-ngpa-navy py-14 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
            {(["private", "group"] as const).map((t) => {
              const product = LESSON_PRODUCTS[t];
              return (
                <div
                  key={t}
                  className="rounded-2xl bg-ngpa-panel/80 border border-ngpa-slate/60 p-6 sm:p-8"
                >
                  <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight">
                    {product.title}
                  </h2>
                  <p className="mt-1 font-heading text-3xl font-black text-ngpa-teal">
                    ${LESSON_PRICE_USD}
                    <span className="text-base font-bold text-ngpa-white/60">
                      {" "}
                      / hour
                    </span>
                  </p>
                  <p className="text-xs text-ngpa-white/55 mt-1">
                    {product.priceNote}
                  </p>
                  <p className="mt-4 text-ngpa-white/75 leading-relaxed">
                    {product.blurb}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {product.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2.5 text-sm text-ngpa-white/75"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1 w-1.5 h-1.5 rounded-full bg-ngpa-teal shrink-0"
                        />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {lessonsLive ? (
            <div className="max-w-2xl mx-auto">
              <SectionHeading
                eyebrow="Book now"
                title="Grab your hour."
                subtitle="Pick private or group, tell us when you're free, pay securely — then a coach reaches out to schedule."
                centered
              />
              <LessonPurchaseForm />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto rounded-2xl bg-ngpa-panel/80 border border-ngpa-slate/60 p-8 text-center">
              <p className="font-heading text-xl font-black text-ngpa-white">
                Online lesson booking opens soon
              </p>
              <p className="text-ngpa-white/70 mt-2">
                Want a lesson this week? Text Coach Sam at{" "}
                <a
                  href="tel:+13013254731"
                  className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright"
                >
                  301-325-4731
                </a>{" "}
                — private and group hours are ${LESSON_PRICE_USD} for the
                full hour, and group lessons split the ${LESSON_PRICE_USD}{" "}
                between the players.
              </p>
              <Link
                href="/free-evaluation/book"
                className="mt-6 inline-flex items-center justify-center px-8 py-4 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[52px]"
              >
                Or start with a free evaluation &rarr;
              </Link>
            </div>
          )}

          <div className="max-w-2xl mx-auto mt-10 text-center">
            <p className="text-sm text-ngpa-white/60 leading-relaxed">
              Lessons run at Montgomery County courts and The Pickl Park in
              Frederick. Not sure which lesson fits?{" "}
              <Link
                href="/free-evaluation/book"
                className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline"
              >
                Book a free 30-minute evaluation
              </Link>{" "}
              and we&rsquo;ll place your player — no commitment.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
