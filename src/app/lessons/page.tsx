import type { Metadata } from "next";
import Link from "next/link";
import LessonPolicyNotice from "@/components/LessonPolicyNotice";
import { EVALUATION_SMS_URL } from "@/data/scheduling";
import {
  GROUP_LESSON_PRICE_PER_PLAYER_USD,
  LESSON_PRODUCTS,
  PRIVATE_LESSON_PRICE_USD,
} from "@/data/lessons";

export const metadata: Metadata = {
  title: "Private & Group Lessons",
  description: `One-hour pickleball lessons for kids 6–16 in Montgomery County, MD — $${PRIVATE_LESSON_PRICE_USD} private or $${GROUP_LESSON_PRICE_PER_PLAYER_USD} per player in a small group, scheduled around your family.`,
  alternates: { canonical: "/lessons" },
};

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
            Private, semi-private &amp; small group
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.02] tracking-tight">
            Lessons that meet your kid{" "}
            <span className="text-ngpa-teal">where they are</span>.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-ngpa-white/80 leading-relaxed max-w-2xl mx-auto">
            One hour with a Next Gen coach — private or in a small
            level-matched group.{" "}
            <strong className="text-ngpa-white">
              {`$${PRIVATE_LESSON_PRICE_USD} for a private hour, $${GROUP_LESSON_PRICE_PER_PLAYER_USD} per player in a group`}
            </strong>
            , for players ages 6&ndash;16. Choose up to three available times;
            Coach Sam confirms the time and location, then sends your invoice.
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
                    ${product.priceUsd}
                    <span className="text-base font-bold text-ngpa-white/60">
                      {" "}
                      / {product.priceUnit}
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

          <div className="max-w-2xl mx-auto rounded-2xl bg-ngpa-panel/80 border border-ngpa-slate/60 p-6 sm:p-8 text-center">
            <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight">
              Find an hour that fits your family.
            </h2>
            <p className="mt-4 text-base text-ngpa-white/75 leading-relaxed">
              Request a private lesson for one player, a semi-private lesson for
              two, or a small-group lesson for three to eight. Choose up to three
              times from Coach Sam&rsquo;s calendar. Your request does not reserve
              a court or charge your card.
            </p>
            <p className="mt-3 text-base text-ngpa-white/75 leading-relaxed">
              Coach Sam confirms the time and location before sending your
              invoice. Group lessons are ${GROUP_LESSON_PRICE_PER_PLAYER_USD} per
              player for the hour. A parent or guardian must have the NGA waiver
              on file before the lesson is confirmed.
            </p>
            <LessonPolicyNotice />
            <Link
              href="/lessons/book"
              className="mt-6 inline-flex items-center justify-center px-8 py-4 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[52px]"
            >
              Request a lesson time &rarr;
            </Link>
            <p className="mt-4 text-sm text-ngpa-white/65 leading-relaxed">
              A parent or guardian submits the request. Use your own name,
              email, and phone number when requesting a lesson for your child.
            </p>
          </div>

          <div className="max-w-2xl mx-auto mt-10 text-center">
            <p className="text-sm text-ngpa-white/60 leading-relaxed">
              Lessons run at Montgomery County courts and The Pickl Park in
              Frederick. Not sure which lesson fits?{" "}
              <Link
                href={EVALUATION_SMS_URL}
                className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline"
              >
                Text to schedule a free 30-minute evaluation
              </Link>{" "}
              and we&rsquo;ll place your player — no commitment.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
