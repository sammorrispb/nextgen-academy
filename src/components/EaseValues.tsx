import { ease } from "@/data/ease";

export default function EaseValues() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {ease.map((item, i) => (
        <div
          key={i}
          className="bg-gray-50 rounded-xl p-6 border border-gray-100"
        >
          <div className="font-heading text-3xl font-900 text-ball-red mb-1">
            {item.letter}
          </div>
          <div className="font-heading text-base font-bold text-gray-900 mb-2">
            {item.title}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
