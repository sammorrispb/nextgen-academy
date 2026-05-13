import Image from "next/image";
import type { Metadata } from "next";
import YellowBallInquiryForm from "@/components/YellowBallInquiryForm";

export const metadata: Metadata = {
  title: "Yellow Ball Inquiry — Next Gen Pickleball Academy",
  description:
    "Request an evaluation for the Yellow Ball tournament track. For players 12+ rated 3.0 or above. A coach will reach out within 24 hours.",
};

const FEATURES = [
  "Coach-curated competitive track",
  "Small groups of 3–5 athletes",
  "Custom scheduling around tournaments",
  "Focused tournament prep & drilling",
];

export default function YellowBallInquiryPage() {
  return (
    <>
      {/* ─── Hero ─────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        {/* Yellow accent backdrop */}
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-32 w-[36rem] h-[36rem] rounded-full bg-ngpa-skill-yellow/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-ngpa-teal/10 blur-3xl"
        />

        {/* Pickleball cluster accent — desktop only, anchors the Yellow Ball theme */}
        <div
          aria-hidden="true"
          className="hidden lg:block absolute -bottom-16 -left-12 w-72 h-72 rounded-full overflow-hidden opacity-30 -rotate-12 pointer-events-none ring-1 ring-ngpa-skill-yellow/20 shadow-2xl shadow-ngpa-skill-yellow/10"
        >
          <Image
            src="/images/pickleballs-cluster.webp"
            alt=""
            fill
            sizes="288px"
            className="object-cover"
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left: pitch */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ngpa-skill-yellow/15 ring-1 ring-ngpa-skill-yellow/40 backdrop-blur-sm text-ngpa-skill-yellow text-xs font-bold tracking-[0.18em] uppercase mb-5">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-ngpa-skill-yellow" />
                Yellow Ball &middot; Tournament Track
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.02] tracking-tight">
                Eval first.
                <br />
                <span className="text-ngpa-skill-yellow">Play up from there.</span>
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-ngpa-white/85 leading-relaxed max-w-xl">
                Yellow Ball is our coach-curated competitive track for players 12+
                rated 3.0 or above. Tell us about your player and we&rsquo;ll set
                up the eval.
              </p>

              <ul className="mt-8 space-y-3">
                {FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-ngpa-white text-base sm:text-lg"
                  >
                    <span
                      aria-hidden="true"
                      className="shrink-0 mt-1 w-6 h-6 rounded-full bg-ngpa-skill-yellow flex items-center justify-center"
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
                    <span className="leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Pricing strip — $40 group rate (Orange/Green/Yellow). Private rates not published. */}
              <div className="mt-10">
                <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-white/60 mb-3">
                  Pricing
                </p>
                <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-xl p-5 border border-ngpa-skill-yellow/30 max-w-md">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="font-mono font-bold text-3xl text-ngpa-skill-yellow">
                      $40
                    </span>
                    <span className="text-sm text-ngpa-white/65">per 1-hour group slot</span>
                  </div>
                  <p className="text-xs text-ngpa-white/60 leading-relaxed">
                    Drop-in &middot; non-refundable &middot; same group rate for Orange, Green &amp; Yellow Ball. Private-lesson rates quoted after the evaluation.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: form */}
            <div className="lg:col-span-5 lg:sticky lg:top-28">
              <div className="rounded-3xl border-2 border-ngpa-skill-yellow/30 bg-ngpa-deep/60 backdrop-blur-md p-1 shadow-2xl shadow-ngpa-skill-yellow/10">
                <div className="px-5 pt-6 pb-3 text-center">
                  <p className="font-heading text-xl font-black text-ngpa-white tracking-tight">
                    Request the Yellow Ball eval
                  </p>
                  <p className="text-ngpa-white/65 text-sm mt-1.5">
                    A coach will reach out within 24 hours.
                  </p>
                </div>
                <YellowBallInquiryForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
