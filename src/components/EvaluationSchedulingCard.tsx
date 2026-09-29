import { EVALUATION_SMS_URL } from "@/data/scheduling";
import { site } from "@/data/site";

export default function EvaluationSchedulingCard() {
  return (
    <div className="rounded-3xl border-2 border-ngpa-teal/30 bg-ngpa-panel/80 p-6 sm:p-8 text-center">
      <p className="font-heading text-2xl font-bold text-ngpa-white tracking-tight">
        Let&rsquo;s find a time to play.
      </p>
      <p className="mt-4 text-base text-ngpa-white/80 leading-relaxed">
        Text Coach Sam to arrange your child&rsquo;s free 30-minute evaluation.
        Share the days that work for your family and your preferred area.
        We&rsquo;ll agree on the time and court by text.
      </p>
      <a
        href={EVALUATION_SMS_URL}
        className="mt-6 inline-flex items-center justify-center min-h-[48px] rounded-full bg-ngpa-teal px-6 py-3 font-bold text-ngpa-deep hover:bg-ngpa-teal-bright transition-colors"
      >
        Text to schedule a free evaluation
      </a>
      <p className="mt-4 font-mono text-lg text-ngpa-white">{site.phone}</p>
      <p className="mt-3 text-sm text-ngpa-white/65 leading-relaxed">
        Ages 6&ndash;16. All equipment provided. No cost, no commitment.
      </p>
    </div>
  );
}
