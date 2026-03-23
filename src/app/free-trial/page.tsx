import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { locations } from "@/data/locations";
import { fetchFreeTrialSessions } from "@/lib/courtreserve";
import { testimonials } from "@/data/testimonials";
import { site } from "@/data/site";
import SectionHeading from "@/components/SectionHeading";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";
import FreeTrialForm from "@/components/FreeTrialForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: seo.freeTrial.title,
  description: seo.freeTrial.description,
  alternates: { canonical: "/free-trial" },
  openGraph: {
    title: "Free Trial Session | Next Gen Pickleball Academy",
    description:
      "Try a free youth pickleball session at Dill Dinkers in Rockville or North Bethesda. Ages 10 and under, no experience needed.",
    type: "website",
    images: [
      {
        url: "/images/og-image.png",
        width: 512,
        height: 512,
        alt: "Next Gen Pickleball Academy — Free Trial",
      },
    ],
  },
};

// Sessions fetched live from CourtReserve (Red Ball + Orange Ball)

const STEPS = [
  {
    number: "1",
    title: "RSVP Below",
    description: "Pick a session date that works for your family.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
        />
      </svg>
    ),
  },
  {
    number: "2",
    title: "Show Up & Play",
    description:
      "Your child joins our beginner group, learns the rules and fundamentals, and plays real games with other kids their age.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
        />
      </svg>
    ),
  },
  {
    number: "3",
    title: "Get Placed",
    description:
      "Our coaches assess your child during the session and follow up with a group recommendation afterward.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
        />
      </svg>
    ),
  },
];

export default async function FreeTrialPage() {
  const activeSessions = await fetchFreeTrialSessions();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: "Free Trial Session — Next Gen Pickleball Academy",
          description:
            "Try a free youth pickleball session for ages 10 and under. No experience needed.",
          organizer: {
            "@type": "SportsActivityLocation",
            name: "Next Gen Pickleball Academy",
            url: "https://nextgenpbacademy.com",
          },
          location: locations.map((loc) => ({
            "@type": "Place",
            name: `Dill Dinkers ${loc.name}`,
            address: {
              "@type": "PostalAddress",
              streetAddress: loc.address,
              addressLocality: loc.city,
              addressRegion: loc.state,
              postalCode: loc.zip,
              addressCountry: "US",
            },
          })),
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
          isAccessibleForFree: true,
        }}
      />

      {/* ─── Hero ─────────────────────────────────── */}
      <section className="bg-ngpa-navy py-20 sm:py-28 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-ngpa-lime font-heading font-bold text-sm uppercase tracking-widest mb-4">
            Free Trial Session
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-ngpa-white leading-tight mb-6">
            Your Kid&rsquo;s First Pickleball Session is{" "}
            <span className="text-ngpa-lime">Free</span>
          </h1>
          <p className="text-ngpa-muted text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
            No experience needed. Ages 10 and under. Show up, learn the basics,
            and play real games&nbsp;&mdash;&nbsp;on&nbsp;us.
          </p>
          <a
            href="#rsvp"
            className="inline-block px-10 py-4 bg-ngpa-lime text-ngpa-black font-heading font-bold text-lg rounded-full hover:bg-ngpa-cyan transition-colors"
          >
            RSVP Now
          </a>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────── */}
      <section className="bg-ngpa-panel py-16 sm:py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            title="How It Works"
            subtitle="Three simple steps to your child's first session."
            centered
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="bg-ngpa-slate/50 rounded-xl p-6 text-center border border-ngpa-slate"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-ngpa-lime/10 text-ngpa-lime mb-4">
                  {step.icon}
                </div>
                <div className="font-mono text-ngpa-lime text-sm font-bold mb-2">
                  Step {step.number}
                </div>
                <h3 className="font-heading text-xl font-bold text-ngpa-white mb-2">
                  {step.title}
                </h3>
                <p className="text-ngpa-muted text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── About the Free Trial ─────────────────── */}
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            title="About the Free Trial"
            subtitle="This is a real session, not just an evaluation."
          />
          <div className="space-y-6 text-ngpa-muted leading-relaxed">
            <p>
              Your child will play with our{" "}
              <span className="text-ngpa-white font-semibold">
                Red/Orange ball group
              </span>{" "}
              alongside other beginners ages 10 and under. They&rsquo;ll learn
              the rules, work on fundamentals, and play real games — all in one
              session.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-ngpa-panel rounded-xl p-5 border border-ngpa-slate">
                <h4 className="font-heading text-sm font-bold text-ngpa-white uppercase tracking-wider mb-3">
                  Locations
                </h4>
                <ul className="space-y-2 text-sm">
                  {locations.map((loc) => (
                    <li key={loc.name}>
                      <span className="text-ngpa-white font-semibold">
                        {loc.venue} {loc.name}
                      </span>
                      <br />
                      {loc.address}, {loc.city}, {loc.state} {loc.zip}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-ngpa-panel rounded-xl p-5 border border-ngpa-slate">
                <h4 className="font-heading text-sm font-bold text-ngpa-white uppercase tracking-wider mb-3">
                  What to Bring
                </h4>
                <ul className="space-y-2 text-sm">
                  <li>Athletic shoes (closed-toe, non-marking soles)</li>
                  <li>Comfortable athletic clothing</li>
                  <li>Water bottle</li>
                  <li className="text-ngpa-lime font-semibold">
                    We provide all paddles and balls!
                  </li>
                </ul>
              </div>
            </div>
            <p>
              A coach will assess your child during the session and follow up
              within 24 hours with a group recommendation and details on how to
              continue.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Social Proof ─────────────────────────── */}
      <section className="bg-ngpa-panel py-16 sm:py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title="What Parents Say" centered />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {testimonials.map((t, i) => (
              <blockquote
                key={i}
                className="bg-ngpa-slate/50 rounded-xl p-6 border border-ngpa-slate"
              >
                <p className="text-ngpa-white text-sm leading-relaxed mb-4 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <footer className="text-ngpa-muted text-xs font-semibold">
                  {t.attribution}
                </footer>
              </blockquote>
            ))}
          </div>
          <p className="text-center text-ngpa-muted text-sm max-w-xl mx-auto">
            <span className="text-ngpa-lime font-semibold">Did you know?</span>{" "}
            MCPS made pickleball a varsity sport at all 25 high schools — give
            your child a head start.
          </p>
        </div>
      </section>

      {/* ─── RSVP Form ────────────────────────────── */}
      <section
        id="rsvp"
        className="bg-ngpa-navy py-16 sm:py-20 px-4 scroll-mt-20"
      >
        <div className="max-w-xl mx-auto">
          <SectionHeading
            title="Reserve Your Spot"
            subtitle="Pick a session and we'll save a spot for your child. It only takes a minute."
            centered
          />
          <FreeTrialForm sessions={activeSessions} locations={locations} />
        </div>
      </section>

      {/* ─── Questions CTA ────────────────────────── */}
      <CTABanner
        heading="Have Questions?"
        description={`Reach out anytime — email ${site.email} or call ${site.phone}. We're happy to help.`}
        buttonText="Contact Us"
        buttonHref="/contact"
        variant="dark"
      />

      {/* ─── Tracking Placeholders ────────────────── */}
      {/*
        META PIXEL — Uncomment and replace YOUR_PIXEL_ID when ready:

        import Script from "next/script";

        <Script id="fb-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','YOUR_PIXEL_ID');fbq('track','PageView');`}
        </Script>

        GOOGLE ANALYTICS — Uncomment and replace G-XXXXXXXXXX when ready:

        <Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" strategy="afterInteractive" />
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-XXXXXXXXXX');`}
        </Script>
      */}
    </>
  );
}
