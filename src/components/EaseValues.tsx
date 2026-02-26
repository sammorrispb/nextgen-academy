import { ease } from "@/data/ease";

export default function EaseValues() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {ease.map((item, i) => (
        <div
          key={i}
          className="bg-ngpa-panel rounded-xl p-6 border border-ngpa-slate"
        >
          <div className="font-heading text-3xl font-900 text-ngpa-lime mb-1">
            {item.letter}
          </div>
          <div className="font-heading text-base font-bold text-ngpa-white mb-2">
            {item.title}
          </div>
          <p className="text-sm text-ngpa-muted leading-relaxed">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
