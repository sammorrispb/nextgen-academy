import { ease } from "@/data/ease";

export default function EaseValues() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {ease.map((item, i) => (
        <div
          key={i}
          className="group relative bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl p-6 border border-ngpa-slate/60 hover:border-ngpa-teal/50 transition-all duration-300 overflow-hidden"
        >
          {/* Glow accent */}
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-ngpa-teal/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="relative">
            <div className="font-heading text-5xl font-black text-ngpa-teal leading-none mb-3">
              {item.letter}
            </div>
            <div className="font-heading text-lg font-bold text-ngpa-white mb-2 tracking-tight">
              {item.title}
            </div>
            <p className="text-sm text-ngpa-white/70 leading-relaxed">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
