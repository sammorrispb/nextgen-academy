import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SchoolsLeadForm from "@/components/SchoolsLeadForm";
import JsonLd from "@/components/JsonLd";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title:
    "Pickleball for Schools, Rec Centers & Summer Camps — Montgomery County, MD",
  description:
    "Bring certified youth pickleball coaches to your school, rec center, or summer camp in Montgomery County, MD. One-off clinics, weekly residencies, and full camp weeks. All equipment provided. Insured, background-checked coaches. Request a quote.",
  alternates: { canonical: "/schools" },
  openGraph: {
    title:
      "Pickleball for Schools, Rec Centers & Summer Camps — Next Gen Academy",
    description:
      "We bring the courts, paddles, and coaches to you. Schools, rec centers, summer camps in Montgomery County, MD.",
    url: "https://nextgenpbacademy.com/schools",
  },
};

const audiences = [
  {
    title: "Schools",
    blurb:
      "PE units, after-school clubs, faculty PD, and family-night events. We design around your bell schedule and teacher ratios.",
    bullets: [
      "K–12, MCPS-friendly",
      "Standards-aligned skill progressions",
      "Turn-key — bring your gym or blacktop",
    ],
    icon: (
      <svg
        className="w-8 h-8 text-ngpa-lime"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 14l9-5-9-5-9 5 9 5z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
        />
      </svg>
    ),
  },
  {
    title: "Rec Centers",
    blurb:
      "Branded youth programs — drop-in clinics, after-school series, school-break camps. We can run them under your registration system or ours.",
    bullets: [
      "Mini & full-court formats",
      "Coaches handle skill assessment + grouping",
      "Marketing copy + photos for your channels",
    ],
    icon: (
      <svg
        className="w-8 h-8 text-ngpa-lime"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    title: "Summer Camps",
    blurb:
      "Drop us into your camp week as a featured sport. Half-day, full-day, or multi-day pickleball blocks for any size group.",
    bullets: [
      "All paddles + balls + portable nets included",
      "Indoor or outdoor — gym, blacktop, or courts",
      "Tournament-format finale on request",
    ],
    icon: (
      <svg
        className="w-8 h-8 text-ngpa-lime"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3l8 4v6c0 4-3 7-8 8-5-1-8-4-8-8V7l8-4z"
        />
      </svg>
    ),
  },
];

const formats = [
  {
    title: "One-off Clinic",
    duration: "1–3 hours",
    fit: "Field days, family nights, school breaks, sport showcases.",
  },
  {
    title: "Weekly Residency",
    duration: "4–10 weeks",
    fit: "PE units, after-school clubs, rec-center sessions.",
  },
  {
    title: "Multi-Week Unit",
    duration: "2–3 weeks",
    fit: "Compressed PE rotations, in-season league prep.",
  },
  {
    title: "Camp Week (M–F)",
    duration: "Half or full days",
    fit: "Summer camps, school-break camps, holiday programs.",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "You request a quote",
    body: "Tell us your group size, age range, and rough timing. Takes about 90 seconds.",
  },
  {
    step: "2",
    title: "We send a proposal",
    body: "Quote, recommended format, sample lesson plan, COI on request — within 1 business day.",
  },
  {
    step: "3",
    title: "We coach, you watch kids light up",
    body: "Coaches arrive with all equipment. You handle space and rosters; we handle the rest.",
  },
];

const faq = [
  {
    q: "Do you bring equipment?",
    a: "Yes. Paddles, balls, and portable nets are included for every booking. We can use a gym, blacktop, multipurpose room, or outdoor court — whatever you have.",
  },
  {
    q: "Are coaches background-checked and insured?",
    a: "Yes. All Next Gen coaches are background-checked and we carry general liability insurance. We can issue a Certificate of Insurance naming your organization upon request.",
  },
  {
    q: "What ages do you work with?",
    a: "Our specialty is ages 8–16. We also run intro clinics for high schoolers and faculty PD sessions for K–12 teachers.",
  },
  {
    q: "What's the typical group size?",
    a: "Up to 30 students per coach for clinic-style instruction. For larger groups we bring additional coaches at a 1:15 ratio so every kid stays active.",
  },
  {
    q: "How much does it cost?",
    a: "Pricing depends on group size, duration, format, and travel. Request a quote and we'll send a number within one business day — no obligation.",
  },
  {
    q: "How far do you travel?",
    a: "Anywhere in Montgomery County and nearby DC/PG. Beyond that, we travel for multi-day bookings — ask.",
  },
];

export default function SchoolsPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Group Pickleball Instruction",
          provider: {
            "@type": "SportsActivityLocation",
            name: site.name,
            url: site.website,
            telephone: site.phone,
            email: site.email,
            areaServed: {
              "@type": "AdministrativeArea",
              name: "Montgomery County, MD",
            },
          },
          audience: [
            { "@type": "EducationalAudience", educationalRole: "K-12 school" },
            { "@type": "Audience", audienceType: "Recreation center" },
            { "@type": "Audience", audienceType: "Summer camp" },
          ],
          areaServed: {
            "@type": "AdministrativeArea",
            name: "Montgomery County, MD",
          },
          url: "https://nextgenpbacademy.com/schools",
        }}
      />

      {/* ─── Hero ───────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ngpa-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(170,220,0,0.08)_0%,transparent_70%)]" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-start">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ngpa-lime text-ngpa-black text-xs font-bold tracking-wider uppercase mb-5">
                For Schools, Rec Centers &amp; Camps
              </div>

              <Image
                src="/images/logo.png"
                alt="Next Gen Pickleball Academy"
                width={400}
                height={115}
                className="w-48 sm:w-60 h-auto mb-5"
                priority
              />

              <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-900 text-ngpa-white leading-tight">
                Bring real pickleball coaching{" "}
                <span className="text-ngpa-lime">to your kids</span>.
              </h1>

              <p className="mt-5 text-base sm:text-lg text-ngpa-muted leading-relaxed">
                We come to you. <strong className="text-ngpa-white">Schools, rec centers, and summer camps</strong>{" "}
                across Montgomery County. One-off clinics, weekly residencies,
                or full camp weeks — we bring the paddles, balls, and portable
                nets.
              </p>

              <ul className="mt-6 space-y-3">
                {[
                  "Certified, background-checked coaches",
                  "All equipment provided — gym, blacktop, or court",
                  "K–12 progressions; 1:15 coach-to-kid ratio",
                  "Insured (COI available on request)",
                ].map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 text-ngpa-white"
                  >
                    <svg
                      className="w-5 h-5 text-ngpa-lime shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm sm:text-base leading-relaxed">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-ngpa-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-ngpa-lime"
                    aria-hidden="true"
                  />
                  Summer slots fill fast — book by April
                </span>
              </div>
            </div>

            <div
              id="quote-form"
              className="lg:sticky lg:top-24 scroll-mt-20"
            >
              <div className="bg-ngpa-panel rounded-2xl p-1 border border-ngpa-lime/30 shadow-2xl shadow-ngpa-lime/5">
                <div className="px-5 pt-5 pb-2 text-center">
                  <p className="font-heading text-lg font-bold text-ngpa-white">
                    Request a Quote
                  </p>
                  <p className="text-ngpa-muted text-sm mt-1">
                    We&rsquo;ll respond within 1 business day.
                  </p>
                </div>
                <SchoolsLeadForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Who we work with ──────────────────────── */}
      <section className="bg-ngpa-navy py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white text-center mb-3">
            Who we work with
          </h2>
          <p className="text-center text-ngpa-muted max-w-2xl mx-auto mb-10">
            Same coaches, same curriculum, tailored to your setting.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {audiences.map((a) => (
              <div
                key={a.title}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 flex flex-col"
              >
                <div className="mb-4">{a.icon}</div>
                <h3 className="font-heading text-xl font-bold text-ngpa-white mb-2">
                  {a.title}
                </h3>
                <p className="text-sm text-ngpa-muted leading-relaxed mb-4">
                  {a.blurb}
                </p>
                <ul className="space-y-2 mt-auto">
                  {a.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-sm text-ngpa-white"
                    >
                      <span className="text-ngpa-lime mt-0.5">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Formats ───────────────────────────────── */}
      <section className="bg-ngpa-black py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white text-center mb-3">
            What we deliver
          </h2>
          <p className="text-center text-ngpa-muted max-w-2xl mx-auto mb-10">
            Pick a format. We&rsquo;ll quote it.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {formats.map((f) => (
              <div
                key={f.title}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate p-5"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-ngpa-lime mb-2">
                  {f.duration}
                </p>
                <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-ngpa-muted leading-relaxed">
                  {f.fit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ──────────────────────────── */}
      <section className="bg-ngpa-navy py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white text-center mb-10">
            How it works
          </h2>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {howItWorks.map((s) => (
              <li
                key={s.step}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ngpa-lime text-ngpa-black font-heading font-bold text-lg mb-3">
                  {s.step}
                </div>
                <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-ngpa-muted leading-relaxed">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── Trust strip ───────────────────────────── */}
      <section className="bg-ngpa-black py-10 px-4 sm:px-6 lg:px-8 border-y border-ngpa-slate">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: "Insured", l: "COI on request" },
            { v: "Background-Checked", l: "Every coach" },
            { v: "K–12", l: "Standards-aligned" },
            { v: "1:15", l: "Coach-to-kid ratio" },
          ].map((t) => (
            <div key={t.v}>
              <p className="font-heading text-lg sm:text-xl font-bold text-ngpa-lime">
                {t.v}
              </p>
              <p className="text-xs sm:text-sm text-ngpa-muted mt-1">
                {t.l}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────── */}
      <section className="bg-ngpa-navy py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white text-center mb-10">
            Frequently asked
          </h2>
          <div className="space-y-3">
            {faq.map((item) => (
              <details
                key={item.q}
                className="bg-ngpa-panel rounded-xl border border-ngpa-slate p-5 group"
              >
                <summary className="cursor-pointer font-heading font-bold text-ngpa-white text-base sm:text-lg list-none flex items-start justify-between gap-3">
                  <span>{item.q}</span>
                  <span
                    className="text-ngpa-lime text-2xl leading-none group-open:rotate-45 transition-transform"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="text-sm sm:text-base text-ngpa-muted mt-3 leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>

          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faq.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.a,
                },
              })),
            }}
          />
        </div>
      </section>

      {/* ─── Final CTA ─────────────────────────────── */}
      <section className="bg-ngpa-black py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-3">
            Ready to bring pickleball to your group?
          </h2>
          <p className="text-ngpa-muted mb-6 max-w-xl mx-auto">
            Tell us a few details. We&rsquo;ll send a quote within 1 business
            day.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="#quote-form"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-ngpa-lime text-ngpa-black font-heading font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
            >
              Request a Quote
            </Link>
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-ngpa-lime text-ngpa-lime font-heading font-bold rounded-full hover:bg-ngpa-lime hover:text-ngpa-black transition-colors"
            >
              Or call {site.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
