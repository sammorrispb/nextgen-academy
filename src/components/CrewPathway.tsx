import Link from "next/link";

/**
 * Crew matching is an inquiry. Availability, age-peer fit, dates and payment
 * terms must be confirmed for the actual offer before a family commits.
 *
 * No price is quoted here. The drop-in rate came off every public surface on
 * 2026-09-08 (Sam) — parents see the amount on the Stripe checkout page — and
 * crew pricing stays qualitative until a real product exists.
 *
 * Routes parents to current listings or the crew-interest form.
 */
export default function CrewPathway() {
  const steps = [
    {
      n: "1",
      label: "Find your starting point",
      body: "See current programs or book a free evaluation. We look at your player's skills, age-peer fit and goals to recommend a starting point.",
      cta: { href: "/schedule", text: "See current options" },
    },
    {
      n: "2",
      label: "Share what works",
      body: "Tell Coach Sam your preferred days, area and level. We review interest alongside current programs and available space to look for a good match.",
      cta: { href: "/crew", text: "Share crew interest" },
    },
    {
      n: "3",
      label: "Confirm the offer",
      body: "When an option fits, confirm its dates, venue, format, price and cancellation terms before registering. Sending interest does not enroll your player or authorize a charge.",
      cta: null,
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {steps.map((step) => (
          <div
            key={step.n}
            className="relative rounded-2xl bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-slate/60 p-6 sm:p-7 hover:border-ngpa-teal/40 transition-colors"
          >
            <div
              aria-hidden="true"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ngpa-teal/15 text-ngpa-teal font-heading font-black text-lg mb-4 border border-ngpa-teal/30"
            >
              {step.n}
            </div>
            <h3 className="font-heading text-lg sm:text-xl font-black text-ngpa-white tracking-tight mb-2">
              {step.label}
            </h3>
            <p className="text-sm sm:text-base text-ngpa-white/70 leading-relaxed">
              {step.body}
            </p>
            {step.cta && (
              <Link
                href={step.cta.href}
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-ngpa-teal hover:text-ngpa-teal-bright transition-colors min-h-[40px]"
              >
                {step.cta.text} →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 max-w-3xl">
        <div className="relative rounded-2xl bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-teal/30 p-6 sm:p-7">
          <div
            aria-hidden="true"
            className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-ngpa-teal"
          />
          <div className="font-heading text-base sm:text-lg font-bold text-ngpa-white mb-1.5">
            Grow together
          </div>
          <p className="text-sm sm:text-base text-ngpa-white/70 leading-relaxed">
            Shared reps and encouraging teammates help players build trust
            and try new skills. Coach Sam looks for a group where your player
            can make progress alongside peers.
          </p>
        </div>
      </div>
    </div>
  );
}
