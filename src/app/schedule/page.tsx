import type { Metadata } from "next";
import { seo } from "@/data/seo";
import SectionHeading from "@/components/SectionHeading";
import CTABanner from "@/components/CTABanner";
import RegistrationNotice from "@/components/RegistrationNotice";

export const metadata: Metadata = {
  title: seo.schedule.title,
  description: seo.schedule.description,
  alternates: { canonical: "/schedule" },
};

export default function SchedulePage() {
  return (
    <>
      <h1 className="sr-only">Class Schedule &amp; Registration</h1>

      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            title="Upcoming Sessions"
            subtitle="Sessions rotate seasonally — reach out for the current cohort."
          />

          <RegistrationNotice />

          <div className="bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-center">
            <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
              Locations Rotate Seasonally
            </h3>
            <p className="text-sm text-ngpa-muted leading-relaxed">
              Sessions move between Montgomery County courts each season.
              Email or text us and we&rsquo;ll share the current location.
            </p>
          </div>
        </div>
      </section>

      <CTABanner
        heading="Questions About Registration?"
        description="Tell us about your child and we'll help you find the right group."
        buttonText="Get Started"
        buttonHref="/#contact-form"
        variant="dark"
        trackingSection="schedule_cta_banner"
      />
    </>
  );
}
