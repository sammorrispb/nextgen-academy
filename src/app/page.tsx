import Hero from "@/components/Hero";
import EaseValues from "@/components/EaseValues";
import LevelGrid from "@/components/LevelGrid";
import SectionHeading from "@/components/SectionHeading";
import CTABanner from "@/components/CTABanner";

export default function Home() {
  return (
    <>
      <Hero />

      {/* EASE Values */}
      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Our Coaching Philosophy"
            subtitle="We don't just teach pickleball. We develop athletes."
          />
          <EaseValues />

          {/* Teaching method callout */}
          <div className="mt-8 border-l-4 border-ngpa-lime bg-ngpa-slate/50 rounded-r-xl p-5">
            <div className="font-heading text-base font-bold text-ngpa-white mb-1">
              Define &rarr; Demonstrate &rarr; Drill
            </div>
            <p className="text-sm text-ngpa-muted leading-relaxed">
              We explain the why, show the how, then practice until it&rsquo;s second nature.
            </p>
          </div>
        </div>
      </section>

      {/* Program Levels */}
      <section className="bg-ngpa-black py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Find Your Level"
            subtitle="Four color-coded levels guide your child from first paddle to tournament play."
          />
          <LevelGrid variant="compact" />
        </div>
      </section>

      {/* CTA */}
      <CTABanner
        heading="Ready to Start?"
        description="Schedule a free evaluation and find the right level for your child. Drop in anytime or commit to the full season."
        buttonText="View Schedule & Register"
        buttonHref="/schedule"
      />
    </>
  );
}
