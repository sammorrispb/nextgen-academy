"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PLAYER_LEVELS, type PlayerLevel } from "@/lib/notion-player-bracket";

export interface FamilyRowChild {
  name: string;
  age: number; // 0 = unknown
  level: PlayerLevel | "";
}

export interface FamilyRow {
  key: string;
  parentName: string;
  children: FamilyRowChild[];
  levels: string[]; // distinct assigned brackets across children
  ages: number[]; // known ages across children
  hasUnassigned: boolean;
  dateAdded: string; // ISO
  lastAttended: string; // ISO ("" = never)
  lastSession: string; // ISO
  registrations: number;
}

type SortKey = "recent" | "attended" | "added" | "regs" | "name";

const AGE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "6–8", min: 6, max: 8 },
  { label: "9–11", min: 9, max: 11 },
  { label: "12–14", min: 12, max: 14 },
  { label: "15–16", min: 15, max: 16 },
];

const LEVEL_CHIP: Record<PlayerLevel, string> = {
  Red: "bg-ngpa-skill-red/20 text-ngpa-skill-red border-ngpa-skill-red/60",
  Orange: "bg-ngpa-skill-orange/20 text-ngpa-skill-orange border-ngpa-skill-orange/60",
  Green: "bg-ngpa-skill-green/20 text-ngpa-skill-green border-ngpa-skill-green/60",
  Yellow: "bg-ngpa-skill-yellow/20 text-ngpa-skill-yellow border-ngpa-skill-yellow/60",
};

function formatDate(date: string): string {
  if (!date) return "—";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function FamiliesTable({ families }: { families: FamilyRow[] }) {
  const [query, setQuery] = useState("");
  const [bracket, setBracket] = useState<string>(""); // "" | level | "Unassigned"
  const [ageBucket, setAgeBucket] = useState<string>(""); // "" | bucket label
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const bucket = AGE_BUCKETS.find((b) => b.label === ageBucket);

    const rows = families.filter((f) => {
      if (q) {
        const hay = [f.parentName, ...f.children.map((c) => c.name)]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (bracket) {
        if (bracket === "Unassigned") {
          if (!f.hasUnassigned) return false;
        } else if (!f.levels.includes(bracket)) {
          return false;
        }
      }
      if (bucket) {
        const hit = f.ages.some((a) => a >= bucket.min && a <= bucket.max);
        if (!hit) return false;
      }
      return true;
    });

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "attended":
          return b.lastAttended.localeCompare(a.lastAttended);
        case "added":
          return b.dateAdded.localeCompare(a.dateAdded);
        case "regs":
          return b.registrations - a.registrations;
        case "name":
          return a.parentName.localeCompare(b.parentName);
        case "recent":
        default:
          return b.lastSession.localeCompare(a.lastSession);
      }
    });
    return sorted;
  }, [families, query, bracket, ageBucket, sortBy]);

  const selectClass =
    "rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/80 text-ngpa-white text-sm px-3 py-2 min-h-[44px] focus:outline-none focus:border-ngpa-teal";

  return (
    <>
      <div className="flex flex-col gap-3 mb-6">
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by parent or player name…"
          aria-label="Search families by parent or player name"
          className="w-full rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/80 text-ngpa-white text-base px-4 py-3 min-h-[48px] placeholder:text-ngpa-white/40 focus:outline-none focus:border-ngpa-teal"
        />
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="bracket-filter">Bracket</label>
          <select
            id="bracket-filter"
            value={bracket}
            onChange={(e) => setBracket(e.target.value)}
            className={selectClass}
          >
            <option value="">All brackets</option>
            {PLAYER_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
            <option value="Unassigned">Unassigned</option>
          </select>

          <label className="sr-only" htmlFor="age-filter">Age</label>
          <select
            id="age-filter"
            value={ageBucket}
            onChange={(e) => setAgeBucket(e.target.value)}
            className={selectClass}
          >
            <option value="">All ages</option>
            {AGE_BUCKETS.map((b) => (
              <option key={b.label} value={b.label}>{`Age ${b.label}`}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="sort-by">Sort by</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className={selectClass}
          >
            <option value="recent">Sort: Recent activity</option>
            <option value="attended">Sort: Last attended</option>
            <option value="added">Sort: Date added</option>
            <option value="regs">Sort: Registrations</option>
            <option value="name">Sort: Name (A–Z)</option>
          </select>
        </div>
        <p className="text-xs text-ngpa-white/50">
          {filtered.length} of {families.length} famil{families.length === 1 ? "y" : "ies"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70">
          No families match these filters.
        </div>
      ) : (
        <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-xs uppercase tracking-wider text-ngpa-white/55 bg-ngpa-deep/40">
              <tr>
                <th className="text-left font-bold px-4 sm:px-5 py-3">Family</th>
                <th className="text-left font-bold px-4 sm:px-5 py-3">Players &amp; bracket</th>
                <th className="text-right font-bold px-4 sm:px-5 py-3">Last attended</th>
                <th className="text-right font-bold px-4 sm:px-5 py-3">Added</th>
                <th className="text-right font-bold px-4 sm:px-5 py-3">Regs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ngpa-slate/40">
              {filtered.map((f) => (
                <tr key={f.key} className="hover:bg-ngpa-deep/30 align-top">
                  <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                    <Link
                      href={`/coach/players/${f.key}`}
                      className="text-ngpa-teal font-bold hover:underline"
                    >
                      {f.parentName}
                    </Link>
                  </td>
                  <td className="px-4 sm:px-5 py-3">
                    <div className="flex flex-col gap-1.5">
                      {f.children.length === 0 && <span className="text-ngpa-white/50">—</span>}
                      {f.children.map((c) => (
                        <div key={c.name} className="flex items-center gap-2 flex-wrap">
                          <span className="text-ngpa-white/85 font-medium">{c.name}</span>
                          {c.age > 0 && (
                            <span className="text-xs text-ngpa-white/45">age {c.age}</span>
                          )}
                          {c.level ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${LEVEL_CHIP[c.level]}`}
                            >
                              {c.level}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wider text-ngpa-white/35">
                              no bracket
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right text-ngpa-white/70 whitespace-nowrap">
                    {formatDate(f.lastAttended)}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right text-ngpa-white/70 whitespace-nowrap">
                    {formatDate(f.dateAdded)}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right font-mono text-ngpa-white/85">
                    {f.registrations}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
