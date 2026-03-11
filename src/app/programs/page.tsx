import type { Metadata } from "next";
import { seo } from "@/data/seo";
import JsonLd from "@/components/JsonLd";
import SectionHeading from "@/components/SectionHeading";
import LevelGrid from "@/components/LevelGrid";
import YellowBallCTA from "@/components/YellowBallCTA";
import PrivateLessonCTA from "@/components/PrivateLessonCTA";
import CTABanner from "@/components/CTABanner";

export const metadata: Metadata = {
  title: seo.programs.title,
  description: seo.programs.description,
  alternates: { canonical: "/programs" },
};

const provider = {
  "@type": "SportsActivityLocation",
  name: "Next Gen Pickleball Academy",
  url: "https://nextgenpbacademy.com",
};

const courseListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: [
    {
      "@type": "Course",
      name: "Red Ball — Youth Pickleball (Ages 5+)",
      description: "First paddle, first rally, first love of the game. Movement, hand-eye coordination, and basic rules of play.",
      provider,
      offers: [
        { "@type": "Offer", name: "Drop-in", price: "35", priceCurrency: "USD" },
        { "@type": "Offer", name: "Season", price: "300", priceCurrency: "USD" },
      ],
    },
    {
      "@type": "Course",
      name: "Orange Ball — Youth Pickleball (Ages 7+)",
      description: "From rallying to competing — rules mastery, sustained rallying, and full-court movement.",
      provider,
      offers: [
        { "@type": "Offer", name: "Drop-in", price: "40", priceCurrency: "USD" },
        { "@type": "Offer", name: "Season", price: "350", priceCurrency: "USD" },
      ],
    },
    {
      "@type": "Course",
      name: "Green Ball — Youth Pickleball (Ages 9+)",
      description: "Strategy meets competition. Shot selection, court positioning, and doubles teamwork.",
      provider,
      offers: [
        { "@type": "Offer", name: "Drop-in", price: "50", priceCurrency: "USD" },
        { "@type": "Offer", name: "Season", price: "450", priceCurrency: "USD" },
      ],
    },
    {
      "@type": "Course",
      name: "Yellow Ball — Tournament Track (Ages 12+)",
      description: "Coach-curated competitive groups of 3–5 athletes with custom scheduling and focused tournament prep.",
      provider,
    },
  ],
};

export default function ProgramsPage() {
  return (
    <>
      <JsonLd data={courseListJsonLd} />
      {/* Header */}
      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            as="h1"
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

      {/* Private Lessons */}
      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <PrivateLessonCTA />
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
