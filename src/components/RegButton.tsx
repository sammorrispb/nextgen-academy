import { levels, type BallColor } from "@/data/levels";

interface RegButtonProps {
  ballColor: BallColor;
  url: string;
}

export default function RegButton({ ballColor, url }: RegButtonProps) {
  const level = levels.find((l) => l.key === ballColor);
  const color = level?.color ?? "#FF4040";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105"
      style={{
        backgroundColor: color,
        color: '#000000',
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {level?.label ?? "Register"}
    </a>
  );
}
