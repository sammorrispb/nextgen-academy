import { levels } from "@/data/levels";
import LevelCard from "./LevelCard";

export default function LevelGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {levels.map((level) => (
        <LevelCard key={level.key} level={level} />
      ))}
    </div>
  );
}
