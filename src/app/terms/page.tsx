import type { Metadata } from "next";
import { site } from "@/data/site";
import ProgramPolicySummary from "@/components/ProgramPolicySummary";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for participating in Next Gen Pickleball Academy programs.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="bg-ngpa-navy min-h-screen">
      <section className="px-5 sm:px-8 pt-16 pb-20 max-w-3xl mx-auto">
        <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">
          Legal
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">
          Terms of Service
        </h1>
        <p className="text-ngpa-white/60 text-sm mt-3">
          Last updated October 6, 2026
        </p>

        <div className="mt-8 space-y-8 text-ngpa-white/80 leading-relaxed">
          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              The program
            </h2>
            <p>
              Next Gen Pickleball Academy runs youth pickleball coaching —
              evaluations, group sessions, lessons, leagues, and camps — for
              kids ages 6&ndash;16 in Montgomery County, Maryland and nearby
              areas. Program details (schedule, location, ages, what&rsquo;s
              included) live on each program&rsquo;s page, and those details
              are part of these terms for that program.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Registration and payment
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                A parent or legal guardian must complete every registration
                and the one-time waiver before a child&rsquo;s first session.
              </li>
              <li>
                Follow the registration and payment instructions for your
                specific program. Some NGA programs use Stripe checkout;
                others send an invoice. Partner classes use the host&rsquo;s
                registration and payment system.
              </li>
              <li>
                An inquiry, evaluation, lesson request or unpaid invoice does
                not confirm enrollment or payment. Check the program&rsquo;s
                confirmation requirements before making plans.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Cancellations, weather, and refunds
            </h2>
            <ProgramPolicySummary />
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Safety and conduct
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Every family signs our waiver and provides emergency contacts
                before the first session.
              </li>
              <li>
                We coach to our EASE values — Ethics, Attitude, Skills,
                Excellence. Bullying, unsafe play, or disrespect toward
                coaches, players, or families can mean removal from a program.
                Refund requests follow the applicable terms described above.
              </li>
              <li>
                Parents are partners, not spectators: please keep sideline
                coaching positive and let our coaches coach.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Liability
            </h2>
            <p>
              Pickleball is a physical sport and injuries happen. By
              registering, you acknowledge the inherent risks and agree to our
              waiver. To the fullest extent the law allows, our liability is
              limited to the fees you paid for the program in question.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Changes
            </h2>
            <p>
              We may update these terms as the academy grows; the version on
              this page is the current summary. Existing registrations retain
              the terms supplied at registration and any later agreed changes.
              Big changes get an email to registered families.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">
              Contact
            </h2>
            <p>
              Questions? Email{" "}
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
