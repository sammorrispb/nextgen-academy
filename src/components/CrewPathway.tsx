import Link from "next/link";

/**
 * "Crew Pathway" pitch — explains the 3-step funnel from one-off drop-in →
 * crew formation (via WhatsApp poll) → 4-week soft commit with auto-reserve.
 *
 * Per CLAUDE.md the only quotable price is the $20 drop-in; we tease "crew
 * pricing" qualitatively but never put a $25/$160/monthly number in front
 * of parents until a real product exists.
 *
 * Routes parents to /schedule (the actionable entry — book the first
 * session). The poll link and 4-week commit are reached via WhatsApp shares
 * and the post-session email respectively, not from this section.
 */
export default function CrewPathway() {
  const steps = [
    {
      n: "1",
      label: "Book a drop-in",
      body: "Try a single session ($20, 1-hour slot, 4-player cap). No commitment — see if the format clicks for your kid.",
      cta: { href: "/schedule", text: "See open sessions" },
    },
    {
      n: "2",
      label: "We form your crew",
      body: "After your first session, Sam looks for 3 more kids at your level who can make the same day and court. When the crew is set, we text the group.",
      cta: null,
    },
    {
      n: "3",
      label: "Lock in 4 weeks",
      body: "One tap to save a card and auto-reserve the same slot for the next 4 weeks — same time, same court, same crew. Skip any week and we refund automatically. Stop the auto-reserve any time.",
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
            Why crews, not classes
          </div>
          <p className="text-sm sm:text-base text-ngpa-white/70 leading-relaxed">
            Same four kids every week. Consistency builds trust, trust builds
            risk-taking, risk-taking is how skills actually compound. We&rsquo;d
            rather grow slow with a tight crew than fill a room with strangers.
          </p>
        </div>
      </div>
    </div>
  );
}
