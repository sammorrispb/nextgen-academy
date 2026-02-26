import { yellowBallPricing } from "@/data/schedule";
import { site } from "@/data/site";

export default function YellowBallCTA() {
  return (
    <div className="bg-yellow-50 border border-yellow-200/60 rounded-2xl p-8">
      <h3 className="font-heading text-2xl font-bold text-yellow-700 mb-3">
        Ready for Tournament Play?
      </h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Yellow Ball is our coach-curated competitive track for players 12+ rated
        3.0 or above. Small groups of 3&ndash;5 athletes, custom scheduling,
        and focused preparation for tournament play.
      </p>

      {/* Pricing table */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {yellowBallPricing.map((tier) => (
          <div
            key={tier.players}
            className="bg-white rounded-lg p-3 text-center border border-yellow-100"
          >
            <div className="text-xs text-gray-500 mb-1">
              {tier.players} players
            </div>
            <div className="font-heading font-bold text-yellow-700">
              {tier.price}
            </div>
          </div>
        ))}
      </div>

      <a
        href={`mailto:${site.email}?subject=Yellow%20Ball%20Inquiry`}
        className="inline-block px-6 py-3 bg-yellow-600 text-white font-bold rounded-full hover:bg-yellow-700 transition-colors"
      >
        Email Us About Yellow Ball
      </a>
    </div>
  );
}
