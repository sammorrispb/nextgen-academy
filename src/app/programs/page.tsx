import type { Metadata } from "next";
import { seo } from "@/data/seo";
import SectionHeading from "@/components/SectionHeading";
import LevelGrid from "@/components/LevelGrid";
import YellowBallCTA from "@/components/YellowBallCTA";
import CTABanner from "@/components/CTABanner";

export const metadata: Metadata = {
  title: seo.programs.title,
  description: seo.programs.description,
};

export default function ProgramsPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Our Programs"
            subtitle="Four color-coded levels guide your child from first paddle to tournament play. Every level builds on the last."
          />

          {/* Color legend */}
          <div className="flex flex-wrap gap-6 mb-10 text-sm">
            {[
              { label: "Red Ball", color: "#FF4040", ages: "Ages 5+" },
              { label: "Orange Ball", color: "#FF8C00", ages: "Ages 7+" },
              { label: "Green Ball", color: "#00C853", ages: "Ages 9+" },
              { label: "Yellow Ball", color: "#FFD600", ages: "Ages 12+" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-ngpa-white">{item.label}</span>
                <span className="text-ngpa-muted">{item.ages}</span>
              </div>
            ))}
          </div>

          <LevelGrid variant="expanded" />
        </div>
      </section>

      {/* Yellow Ball CTA */}
      <section className="bg-ngpa-black py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <YellowBallCTA />
        </div>
      </section>

      <CTABanner
        heading="Not Sure Which Level?"
        description="Schedule a free evaluation. Our coaches will assess your child and recommend the perfect starting point."
        buttonText="Contact Us"
        buttonHref="/contact"
        variant="dark"
      />
    </>
  );
}
