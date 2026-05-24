import Image from "next/image";
import type { Metadata } from "next";
import NewsletterForm from "@/components/NewsletterForm";
import JsonLd from "@/components/JsonLd";
import { site } from "@/data/site";

const NEWSLETTER_TITLE = "Free Youth Pickleball Newsletter — Montgomery County, MD";
const NEWSLETTER_DESCRIPTION =
  "Free email for parents of kids ages 5–16 in Montgomery County, MD: this week's pickleball sessions, monthly training spots, and coach tips. No spam.";
const NEWSLETTER_SHARE_DESCRIPTION =
  "Montgomery County's youth pickleball crew is growing. Get your kid in — session times, training spots, and coach tips, free.";

export const metadata: Metadata = {
  title: { absolute: NEWSLETTER_TITLE },
  description: NEWSLETTER_DESCRIPTION,
  alternates: { canonical: "/newsletter" },
  openGraph: {
    title: NEWSLETTER_TITLE,
    description: NEWSLETTER_SHARE_DESCRIPTION,
    url: "https://nextgenpbacademy.com/newsletter",
  },
  twitter: {
    card: "summary_large_image",
    title: NEWSLETTER_TITLE,
    description: NEWSLETTER_SHARE_DESCRIPTION,
  },
};

const VALUE_BULLETS = [
  "This week's drop-in session times, before they fill",
  "First dibs on monthly training spots when new cohorts open",
  "Coach tips and how your kid gets better — no spam",
];

export default function NewsletterPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Free Youth Pickleball Newsletter — Next Gen Pickleball Academy",
          url: "https://nextgenpbacademy.com/newsletter",
          description:
            "Join Montgomery County's growing youth pickleball crew. Session times, monthly training spots, and coach tips — free.",
          publisher: {
            "@type": "Organization",
            name: "Next Gen Pickleball Academy",
            url: "https://nextgenpbacademy.com",
          },
        }}
      />

      {/* ─── Hero + Form ─────────────── */}
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        {/* Photo backdrop */}
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
            {/* Left: offer */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ngpa-teal/15 ring-1 ring-ngpa-teal/40 backdrop-blur-sm text-ngpa-teal text-xs font-bold tracking-[0.18em] uppercase mb-5">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-ngpa-teal animate-pulse" />
                Free Newsletter
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.02] tracking-tight">
                Montgomery County&rsquo;s youth pickleball crew is growing.{" "}
                <span className="text-ngpa-teal">Get your kid in.</span>
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-ngpa-white/85 leading-relaxed max-w-xl">
                One free email keeps you in the loop &mdash; where to play this
                week, when monthly training spots open, and the small things
                that move your kid&rsquo;s game forward. For parents of kids
                ages 5&ndash;16 across MoCo.
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

              {/* Trust bar */}
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ngpa-white/70">
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  MCPS venues across MoCo
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  No spam, unsubscribe anytime
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  Built by parents
                </span>
              </div>
            </div>

            {/* Right: form */}
            <div className="lg:col-span-5 lg:sticky lg:top-28 scroll-mt-24">
              <div className="rounded-3xl border-2 border-ngpa-teal/30 bg-ngpa-deep/60 backdrop-blur-md p-1 shadow-2xl shadow-ngpa-teal/10">
                <div className="px-5 pt-6 pb-3 text-center">
                  <p className="font-heading text-xl font-black text-ngpa-white tracking-tight">
                    Join the free newsletter
                  </p>
                  <p className="text-ngpa-white/65 text-sm mt-1.5">
                    Takes 10 seconds. Check your inbox for a welcome note.
                  </p>
                </div>
                <NewsletterForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Why join strip ───────────────────────── */}
      <section className="relative bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-ngpa-teal/8 blur-3xl"
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Why join
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Say yes to the free thing first.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed">
            No pressure, no cost. Get a feel for how we coach, see where and when
            the crew plays, and decide on your own time. When you&rsquo;re ready
            to book a session, everything you need is one tap away.
          </p>
          <p className="mt-8 text-base text-ngpa-white/65">
            Questions?{" "}
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
