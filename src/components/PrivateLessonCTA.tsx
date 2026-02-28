import { privateLessonPricing, yellowBallPricing } from "@/data/schedule";
import { site } from "@/data/site";

export default function PrivateLessonCTA() {
  return (
    <div className="bg-ngpa-panel border border-ngpa-slate rounded-2xl p-8">
      <h3 className="font-heading text-2xl font-bold text-ngpa-white mb-3">
        Private Lessons
      </h3>
      <p className="text-ngpa-muted leading-relaxed mb-4">
        Accelerate your child&rsquo;s development with focused, one-on-one or
        small-group coaching. No minimum commitment&nbsp;&mdash; book as many
        sessions as you&rsquo;d like.
      </p>
      <p className="text-sm text-ngpa-lime font-medium mb-4">
        Commit to 4 weeks and save $20/player on the total.
      </p>
      <p className="text-sm text-ngpa-muted leading-relaxed mb-6">
        Optional DUPR rating available for private lesson students at no extra
        cost&nbsp;&mdash; just a few free setup steps required.
      </p>

      {/* 1-on-1 pricing */}
      <h4 className="text-sm font-bold text-ngpa-white uppercase tracking-wide mb-3">
        1-on-1 Lessons
      </h4>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-ngpa-slate rounded-lg p-3 text-center border border-ngpa-slate">
          <div className="text-xs text-ngpa-muted mb-1">
            {privateLessonPricing.single.label}
          </div>
          <div className="font-mono font-bold text-ngpa-lime">
            {privateLessonPricing.single.price}
          </div>
        </div>
        <div className="bg-ngpa-slate rounded-lg p-3 text-center border border-ngpa-slate">
          <div className="text-xs text-ngpa-muted mb-1">
            {privateLessonPricing.pack.label}
          </div>
          <div className="font-mono font-bold text-ngpa-lime">
            {privateLessonPricing.pack.price}
          </div>
        </div>
      </div>

      {/* Group pricing */}
      <h4 className="text-sm font-bold text-ngpa-white uppercase tracking-wide mb-3">
        Group Lessons (per player)
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {yellowBallPricing.map((tier) => (
          <div
            key={tier.players}
            className="bg-ngpa-slate rounded-lg p-3 text-center border border-ngpa-slate"
          >
            <div className="text-xs text-ngpa-muted mb-1">
              {tier.players} players
            </div>
            <div className="font-mono font-bold text-ngpa-lime">
              {tier.price}
            </div>
          </div>
        ))}
      </div>

      <a
        href={`mailto:${site.email}?subject=Private%20Lesson%20Inquiry`}
        className="inline-block px-6 py-3 bg-ngpa-lime text-ngpa-black font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
      >
        Book a Private Lesson
      </a>
    </div>
  );
}
