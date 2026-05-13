import TrackedCTA from "@/components/TrackedCTA";

export default function YellowBallCTA() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-ngpa-panel via-ngpa-deep to-ngpa-panel border border-ngpa-skill-yellow/30 rounded-3xl p-8 sm:p-10">
      {/* Yellow accent glow */}
      <div
        aria-hidden="true"
        className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-ngpa-skill-yellow/10 blur-3xl"
      />

      <div className="relative">
        <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase text-ngpa-skill-yellow mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-ngpa-skill-yellow" aria-hidden="true" />
          Yellow Ball &middot; Tournament Track
        </span>

        <h3 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
          Ready for Tournament Play?
        </h3>
        <p className="text-ngpa-white/75 text-base sm:text-lg leading-relaxed mb-6 max-w-2xl">
          Yellow Ball is our coach-curated competitive track for players 12+ rated
          3.0 or above. Small groups of 3&ndash;5 athletes, custom scheduling,
          and focused preparation for tournament play.
        </p>

        <div className="bg-ngpa-deep/60 rounded-xl p-5 mb-7 border border-ngpa-slate/60 max-w-md">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="font-mono font-bold text-3xl text-ngpa-skill-yellow">
              $40
            </span>
            <span className="text-sm text-ngpa-white/65">per 1-hour slot</span>
          </div>
          <p className="text-xs text-ngpa-white/60 leading-relaxed">
            Drop-in &middot; non-refundable &middot; same group rate for Orange, Green &amp; Yellow Ball. Private-lesson rates quoted after the evaluation.
          </p>
        </div>

        <TrackedCTA
          href="/yellowball/inquiry"
          label="yellowball_request_eval"
          section="yellowball_cta"
          asNextLink
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-ngpa-skill-yellow text-ngpa-deep font-bold rounded-full hover:brightness-110 transition-all shadow-xl shadow-ngpa-skill-yellow/20"
        >
          Request an Eval
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </TrackedCTA>
      </div>
    </div>
  );
}
