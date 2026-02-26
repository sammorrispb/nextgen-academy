import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { coaches } from "@/data/coaches";
import SectionHeading from "@/components/SectionHeading";
import EaseValues from "@/components/EaseValues";
import CoachCard from "@/components/CoachCard";
import CTABanner from "@/components/CTABanner";

export const metadata: Metadata = {
  title: seo.about.title,
  description: seo.about.description,
};

export default function AboutPage() {
  return (
    <>
      {/* Founders Story */}
      <section className="bg-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Our Story"
            subtitle="Two dads building the program they wished existed for their own kids."
          />

          <div className="max-w-3xl">
            <p className="text-gray-600 leading-relaxed mb-4">
              Next Gen was started by two dads, <strong>Sam and Amine</strong>,
              building a roadmap for our own kids: structured lessons, a positive
              culture, and a clear path from curiosity to competition.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              We created the place we wanted for our families&mdash;a safe,
              inclusive community where parents, coaches, and kids work as a
              team, and where &ldquo;Next Gen&rdquo; means both the{" "}
              <strong>next generation</strong> of players and a commitment to
              being <strong>better than yesterday</strong>.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Our approach is built on the{" "}
              <strong>Parent&ndash;Coach&ndash;Kid Triangle</strong>&mdash;a
              simple operating system that teaches parents how to support growth,
              play themselves, play with their kids, and set goals together so
              families grow through the sport.
            </p>
          </div>
        </div>
      </section>

      {/* Coaches */}
      <section className="bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading title="Meet the Coaches" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {coaches.map((coach) => (
              <CoachCard key={coach.name} coach={coach} />
            ))}
          </div>
        </div>
      </section>

      {/* EASE Values */}
      <section className="bg-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="The EASE Framework"
            subtitle="Four core values that guide everything we do."
          />
          <EaseValues />
        </div>
      </section>

      {/* Teaching Philosophy */}
      <section className="bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading title="How We Teach" />
          <div className="max-w-3xl space-y-6">
            <div className="border-l-4 border-ball-red bg-white rounded-r-xl p-5">
              <div className="font-heading text-base font-bold text-gray-900 mb-1">
                Define &rarr; Demonstrate &rarr; Drill
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                We explain the why, show the how, then practice until
                it&rsquo;s second nature.
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <h4 className="font-heading font-bold text-gray-900 mb-2">
                Clear Pathway
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Four color-coded levels (Red &rarr; Orange &rarr; Green &rarr;
                Yellow) give every player a visible path from first rally to
                tournament play. Each level builds on the skills mastered in
                the previous one.
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <h4 className="font-heading font-bold text-gray-900 mb-2">
                Family Involvement
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Parents aren&rsquo;t spectators&mdash;they&rsquo;re partners.
                Through our Parent&ndash;Coach&ndash;Kid Triangle, families
                learn the game together with weekly drills, goal-setting, and
                regular progress check-ins.
              </p>
            </div>
          </div>
        </div>
      </section>

      <CTABanner
        heading="Join the Next Gen Family"
        description="Schedule a free evaluation and see what makes our program different."
        buttonText="Contact Us"
        buttonHref="/contact"
      />
    </>
  );
}
