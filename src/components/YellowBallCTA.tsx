import { sessionPricing } from "@/data/schedule";
import { site } from "@/data/site";

export default function YellowBallCTA() {
  return (
    <div className="bg-ngpa-panel border border-ngpa-slate rounded-2xl p-8">
      <h3 className="font-heading text-2xl font-bold text-ngpa-white mb-3">
        Simple monthly pricing
      </h3>
      <p className="text-ngpa-muted leading-relaxed mb-4">
        Reserve your child&apos;s weekly day-and-time slot and pay one flat
        per-session rate. We bill at the start of each month for the weeks in
        that month &mdash; no seasons, no packages.
      </p>

      {/* Pricing table */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {sessionPricing.map((tier) => (
          <div
            key={tier.level}
            className="bg-ngpa-slate rounded-lg p-3 text-center border border-ngpa-slate"
          >
            <div className="text-xs text-ngpa-muted mb-1">{tier.level}</div>
            <div className="font-mono font-bold text-ngpa-skill-yellow">
              {tier.price}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-ngpa-muted mb-6">
        To pause or cancel, email{" "}
        <a href={`mailto:${site.email}`} className="text-ngpa-lime hover:underline">
          {site.email}
        </a>{" "}
        at least 5 days before the 1st of the month.
      </p>

      <a
        href={`mailto:${site.email}?subject=Enrollment%20Inquiry`}
        className="inline-block px-6 py-3 bg-ngpa-lime text-ngpa-black font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
      >
        Email Us to Enroll
      </a>
    </div>
  );
}
