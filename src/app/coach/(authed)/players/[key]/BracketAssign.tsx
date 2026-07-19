"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPlayerBracketAction } from "./actions";
import { PLAYER_LEVELS, type PlayerLevel } from "@/lib/notion-player-bracket";

interface Props {
  parentEmail: string;
  parentPhone: string;
  parentName: string;
  childFirstName: string;
  level: PlayerLevel | "";
}

// Skill-color chip styling per ball color (dark-surface only — see BRAND_GUIDELINES).
const LEVEL_STYLE: Record<PlayerLevel, { on: string; dot: string }> = {
  Red: { on: "bg-ngpa-skill-red/20 text-ngpa-skill-red border-ngpa-skill-red/60", dot: "bg-ngpa-skill-red" },
  Orange: { on: "bg-ngpa-skill-orange/20 text-ngpa-skill-orange border-ngpa-skill-orange/60", dot: "bg-ngpa-skill-orange" },
  Green: { on: "bg-ngpa-skill-green/20 text-ngpa-skill-green border-ngpa-skill-green/60", dot: "bg-ngpa-skill-green" },
  Yellow: { on: "bg-ngpa-skill-yellow/20 text-ngpa-skill-yellow border-ngpa-skill-yellow/60", dot: "bg-ngpa-skill-yellow" },
};

export default function BracketAssign({
  parentEmail,
  parentPhone,
  parentName,
  childFirstName,
  level,
}: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<PlayerLevel | "">(level);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function assign(next: PlayerLevel) {
    // Tapping the active color again clears it.
    const nextLevel = current === next ? null : next;
    startTransition(async () => {
      setError(null);
      const result = await setPlayerBracketAction({
        parentEmail,
        parentPhone,
        parentName,
        childFirstName,
        level: nextLevel,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCurrent(result.level ?? "");
      router.refresh();
    });
  }

  const base =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors disabled:opacity-50 min-h-[32px]";
  const off =
    "bg-transparent text-ngpa-white/45 border-ngpa-slate/50 hover:text-ngpa-white/80 hover:border-ngpa-slate";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-ngpa-white/45 mr-0.5">
        Bracket
      </span>
      {PLAYER_LEVELS.map((lvl) => {
        const active = current === lvl;
        return (
          <button
            key={lvl}
            type="button"
            onClick={() => assign(lvl)}
            disabled={pending}
            aria-pressed={active}
            title={active ? `Clear ${lvl} bracket` : `Assign ${lvl} bracket`}
            className={active ? `${base} ${LEVEL_STYLE[lvl].on}` : `${base} ${off}`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${LEVEL_STYLE[lvl].dot}`} />
            {lvl}
          </button>
        );
      })}
      {current === "" && (
        <span className="text-[11px] text-ngpa-white/40 ml-0.5">Not set</span>
      )}
      {error && <span className="text-red-400 text-[10px] ml-1">{error}</span>}
    </div>
  );
}
