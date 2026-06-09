import Image from "next/image";
import type { Metadata } from "next";
import CrewInterestForm from "@/components/CrewInterestForm";
import JsonLd from "@/components/JsonLd";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Find your kid's pickleball crew — Next Gen, Montgomery County, MD",
  description:
    "Tell us your kid's level and which days work. When Coach Sam has 3 other kids who match, he texts the WhatsApp link — same four kids every week, same court, same time.",
  alternates: { canonical: "/crew" },
  openGraph: {
    title: "Find your kid's pickleball crew — Next Gen Pickleball Academy",
    description:
      "Same four kids every week. Tell us when works and Coach Sam looks for the other three.",
    url: "https://nextgenpbacademy.com/crew",
  },
};

const VALUE_BULLETS = [
  "Same four kids every week — consistency builds skills faster than rotating classes",
  "Coach Sam matches level + schedule before the crew forms — no awkward mismatches",
  "Vote on the WhatsApp link when it goes live — one tap, no commitment until 4 are in",
];

export default function CrewPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Find your kid's pickleball crew — Next Gen Pickleball Academy",
          url: "https://nextgenpbacademy.com/crew",
          description:
            "Tell us your kid's level and which days work. When Coach Sam has 3 other kids who match, the crew locks in.",
          publisher: {
            "@type": "Organization",
            name: "Next Gen Pickleball Academy",
            url: "https://nextgenpbacademy.com",
          },
        }}
      />

      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/multi-court-outdoor.jpeg"
            alt=""
            fill
            priority
            className="object-cover object-center opacity-50 lg:opacity-75"
            sizes="100vw"
          />
          <div className="absolute inset-0 lg:hidden bg-photo-overlay" />
          <div className="absolute inset-0 hidden lg:block bg-photo-overlay-side" />
        </div>
        <div className="absolute inset-x-0 top-0 h-96 bg-teal-glow pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ngpa-teal/15 ring-1 ring-ngpa-teal/40 backdrop-blur-sm text-ngpa-teal text-xs font-bold tracking-[0.18em] uppercase mb-5">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-ngpa-teal animate-pulse" />
                Crew Interest
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.02] tracking-tight">
                Same four kids every week.{" "}
                <span className="text-ngpa-teal">Tell us what works.</span>
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-ngpa-white/85 leading-relaxed max-w-xl">
                If none of the open polls fit your schedule, fill this out
                instead. Coach Sam looks for 3 more kids at your kid&rsquo;s level
                who can make the same day and court &mdash; when there are
                enough takers, he texts the WhatsApp link to vote you in.
              </p>

              <ul className="mt-8 space-y-3.5">
                {VALUE_BULLETS.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 text-ngpa-white text-base sm:text-lg"
                  >
                    <span
                      aria-hidden="true"
                      className="shrink-0 mt-1 w-6 h-6 rounded-full bg-ngpa-teal flex items-center justify-center"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-ngpa-deep"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ngpa-white/70">
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  MCPS venues across MoCo
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  No commitment until the crew locks in
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  Built by parents
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 lg:sticky lg:top-28 scroll-mt-24">
              <div className="rounded-3xl border-2 border-ngpa-teal/30 bg-ngpa-deep/60 backdrop-blur-md p-1 shadow-2xl shadow-ngpa-teal/10">
                <div className="px-5 pt-6 pb-3 text-center">
                  <p className="font-heading text-xl font-black text-ngpa-white tracking-tight">
                    Find my kid&rsquo;s crew
                  </p>
                  <p className="text-ngpa-white/65 text-sm mt-1.5">
                    Takes 45 seconds. We&rsquo;ll text the WhatsApp link when
                    your slot has takers.
                  </p>
                </div>
                <CrewInterestForm source="Web" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-ngpa-teal/8 blur-3xl"
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Why crews
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Consistency builds trust. Trust builds risk-taking.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed">
            Same four kids every week is how skills actually compound. Rotating
            classes feel busy but they don&rsquo;t build the same chemistry
            &mdash; or the same growth. That&rsquo;s why we&rsquo;d rather grow
            slow with a tight crew than fill a room with strangers. Better than
            yesterday&mdash;together.
          </p>
          <p className="mt-8 text-base text-ngpa-white/65">
            Questions?{" "}
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline transition-colors"
            >
              Call or text Coach Sam at {site.phone}
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
