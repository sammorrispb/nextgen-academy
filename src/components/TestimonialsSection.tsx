import { testimonials } from "@/data/testimonials";

export default function TestimonialsSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
      {testimonials.map((t, i) => (
        <div
          key={i}
          className="bg-ngpa-panel rounded-xl p-6 border border-ngpa-slate relative"
        >
          {/* Quote mark accent */}
          <span
            className="text-ngpa-lime/20 text-6xl font-heading font-bold leading-none absolute top-3 left-4 select-none"
            aria-hidden="true"
          >
            &ldquo;
          </span>
          <blockquote className="relative z-10">
            <p className="text-ngpa-white leading-relaxed mb-4 pt-4">
              {t.quote}
            </p>
            <footer className="text-sm text-ngpa-muted">{t.attribution}</footer>
          </blockquote>
        </div>
      ))}
    </div>
  );
}
