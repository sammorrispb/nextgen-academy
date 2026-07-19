import Link from "next/link";
import { fetchAllDropInsInRange } from "@/lib/notion-dropins";
import { buildFamilyDirectory, encodeParentKey } from "@/lib/player-profiles";
import {
  fetchAllPlayerLevels,
  buildLevelIndex,
  type PlayerLevel,
} from "@/lib/notion-player-bracket";
import FamiliesTable, { type FamilyRow } from "./FamiliesTable";

export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function PlayersIndexPage() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 365);
  const to = new Date(now);
  to.setDate(to.getDate() + 60);
  const currentYear = now.getFullYear();

  const [rows, playerLevels] = await Promise.all([
    fetchAllDropInsInRange(isoDate(from), isoDate(to)),
    fetchAllPlayerLevels(),
  ]);
  const families = buildFamilyDirectory(rows);
  const levelIndex = buildLevelIndex(playerLevels, encodeParentKey);

  const familyRows: FamilyRow[] = families.map((f) => {
    const children = f.children.map((c) => {
      const level = (levelIndex.get(`${f.key}::${c.name.trim().toLowerCase()}`) ?? "") as
        | PlayerLevel
        | "";
      const age = c.birthYear > 0 ? currentYear - c.birthYear : 0;
      return { name: c.name, age, level };
    });
    const levels = Array.from(
      new Set(children.map((c) => c.level).filter((l): l is PlayerLevel => l !== "")),
    );
    return {
      key: f.key,
      parentName: f.parentName,
      children,
      levels,
      ages: children.map((c) => c.age).filter((a) => a > 0),
      hasUnassigned: children.some((c) => c.level === ""),
      dateAdded: f.firstSessionDate,
      lastAttended: f.lastAttendedDate,
      lastSession: f.lastSessionDate,
      registrations: f.registrations,
    };
  });

  return (
    <>
      <Link
        href="/coach"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← All sessions
      </Link>

      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Families
      </h1>
      <p className="text-base text-ngpa-white/70 mb-8">
        Every family who has registered — search, filter by bracket or age, and
        sort by activity.
      </p>

      {familyRows.length === 0 ? (
        <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70">
          No registrations yet.
        </div>
      ) : (
        <FamiliesTable families={familyRows} />
      )}
    </>
  );
}
