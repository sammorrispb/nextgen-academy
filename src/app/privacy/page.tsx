import type { Metadata } from "next";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Next Gen Pickleball Academy collects, uses, and protects your family's information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="bg-ngpa-navy min-h-screen">
      <section className="px-5 sm:px-8 pt-16 pb-20 max-w-3xl mx-auto">
        <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">
          Legal
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">
          Privacy Policy
        </h1>
        <p className="text-ngpa-white/60 text-sm mt-3">
          Last updated September 21, 2026
        </p>

        <div className="mt-8 space-y-8 text-ngpa-white/80 leading-relaxed">
          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              What we collect
            </h2>
            <p>
              When you register for a program, book an evaluation, sign our
              waiver, or contact us, we collect the information you give us:
              parent name, email, phone number, your child&rsquo;s first name
              and birth year, emergency contacts, and anything you add about
              allergies or medical needs. Payments are processed by Stripe —
              we never see or store your card number. We also collect basic
              website analytics (pages visited, how you found us) to understand
              what families need.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              How we use it
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To run your programs: rosters, schedules, and session updates.</li>
              <li>
                To communicate: confirmations, reminders, weather changes, and
                the occasional note about new programs. We&rsquo;ll only text
                you if you opt in, and every text says how to stop.
              </li>
              <li>
                To keep kids safe: emergency contacts and medical notes are
                visible to your child&rsquo;s coaches and no one else.
              </li>
              <li>To improve the academy: aggregated, anonymized analytics.</li>
            </ul>
            <p className="mt-3">
              We do not sell your information. We do not share it with
              advertisers. Coaches and staff see only what they need to run
              your child&rsquo;s sessions.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Children&rsquo;s privacy
            </h2>
            <p>
              Our programs are for kids ages 6&ndash;16, and a parent or
              guardian completes every registration. We collect only what a
              youth sports program needs to operate safely, and we never
              knowingly collect information directly from a child under 13
              without a parent involved. If you believe a child gave us
              information directly, email us and we&rsquo;ll delete it.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Photos and video
            </h2>
            <p>
              We sometimes photograph sessions for our website and social
              media. If you&rsquo;d rather your child not appear, tell any
              coach or email us — we keep a do-not-photograph list and we honor
              it, no questions asked.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Texts and emails
            </h2>
            <p>
              Transactional messages (confirmations, schedule changes, weather
              calls) go to the contact details you gave at registration.
              Marketing texts only go to families who opted in — reply STOP to
              any text to end them, and you can unsubscribe from emails with
              one click. Opting out of marketing never affects your
              registrations.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Your rights
            </h2>
            <p>
              Email us any time to see what we have about your family, correct
              it, or ask us to delete it. We&rsquo;ll confirm within a few
              business days. Some records (like payment receipts) we&rsquo;re
              required to keep for tax and accounting purposes.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Contact
            </h2>
            <p>
              Questions about this policy? Email{" "}
              <a
                href={`mailto:${site.email}`}
                className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
              >
                {site.email}
              </a>{" "}
              or call{" "}
              <a
                href={`tel:${site.phone.replace(/\D/g, "")}`}
                className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
              >
                {site.phone}
              </a>
              .
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
