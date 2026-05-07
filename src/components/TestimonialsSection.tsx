import { testimonials } from "@/data/testimonials";

export default function TestimonialsSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
      {testimonials.map((t, i) => (
        <figure
          key={i}
          className="relative bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl p-7 border border-ngpa-slate/60 hover:border-ngpa-teal/40 transition-colors overflow-hidden"
        >
          {/* Quote mark accent */}
          <span
            className="text-ngpa-teal/30 text-7xl font-heading font-black leading-none absolute -top-2 left-4 select-none"
            aria-hidden="true"
          >
            &ldquo;
          </span>
          <blockquote className="relative z-10">
            <p className="text-ngpa-white text-base leading-relaxed mb-5 pt-5">
              {t.quote}
            </p>
            <footer className="text-sm text-ngpa-white/60 border-t border-ngpa-slate/50 pt-4">
              {t.attribution}
            </footer>
          </blockquote>
        </figure>
      ))}
    </div>
  );
}
