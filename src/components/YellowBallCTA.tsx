import Link from "next/link";
import { yellowBallPricing } from "@/data/schedule";

export default function YellowBallCTA() {
  return (
    <div className="bg-ngpa-panel border border-ngpa-slate rounded-2xl p-8">
      <h3 className="font-heading text-2xl font-bold text-ngpa-white mb-3">
        Ready for Tournament Play?
      </h3>
      <p className="text-ngpa-muted leading-relaxed mb-2">
        Yellow Ball is our coach-curated competitive track for players 12+ rated
        3.0 or above. Small groups of 3&ndash;5 athletes, custom scheduling,
        and focused preparation for tournament play.
      </p>
      <p className="text-sm text-ngpa-skill-yellow font-semibold mb-4">
        $45/session (with 4 players) &middot; Minimum 4-session initial commitment
      </p>

      {/* Pricing table */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {yellowBallPricing.map((tier) => (
          <div
            key={tier.players}
            className="bg-ngpa-slate rounded-lg p-3 text-center border border-ngpa-slate"
          >
            <div className="text-xs text-ngpa-muted mb-1">
              {tier.players} players
            </div>
            <div className="font-mono font-bold text-ngpa-skill-yellow">
              {tier.price}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-ngpa-muted mb-6">
        Minimum 4-week commitment required.
      </p>

      <Link
        href="/yellowball/inquiry"
        className="inline-block px-6 py-3 bg-ngpa-lime text-ngpa-black font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
      >
        Request an eval
      </Link>
    </div>
  );
}
