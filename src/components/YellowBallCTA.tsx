import TrackedCTA from "@/components/TrackedCTA";

export default function YellowBallCTA() {
  return (
    <div className="bg-ngpa-panel border border-ngpa-slate rounded-2xl p-8">
      <h3 className="font-heading text-2xl font-bold text-ngpa-white mb-3">
        Ready for Tournament Play?
      </h3>
      <p className="text-ngpa-muted leading-relaxed mb-4">
        Yellow Ball is our coach-curated competitive track for players 12+ rated
        3.0 or above. Small groups of 3&ndash;5 athletes, custom scheduling,
        and focused preparation for tournament play.
      </p>

      <div className="bg-ngpa-slate rounded-lg p-4 mb-6">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-mono font-bold text-2xl text-ngpa-skill-yellow">
            $35
          </span>
          <span className="text-sm text-ngpa-muted">per session</span>
        </div>
        <p className="text-xs text-ngpa-muted leading-relaxed">
          Billed monthly &middot; same rate as every other NGA level &middot; cancel anytime
        </p>
      </div>

      <TrackedCTA
        href="/yellowball/inquiry"
        label="yellowball_request_eval"
        section="yellowball_cta"
        asNextLink
        className="inline-block px-6 py-3 bg-ngpa-lime text-ngpa-black font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
      >
        Request an eval
      </TrackedCTA>
    </div>
  );
}
