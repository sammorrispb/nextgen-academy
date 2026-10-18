"use client";

import { createContext, useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from "react";

// The day's game length, picked once at the top of the page and read by every
// score form below it. Remembered per device + group + week (a coach scoring
// from one phone), and sent with each score so the server validates against
// the length actually played. Storage can throw in a private tab; the picker
// still works for the visit, it just won't be remembered.

const GameTargetContext = createContext<number | null>(null);

const CHANGE_EVENT = "nga-season-game-target";

function storageKey(group: string, week: number): string {
  return `nga-season-game-target:${group}:${week}`;
}

function readSaved(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

interface ProviderProps {
  group: string;
  week: number;
  targets: readonly number[];
  defaultTarget: number;
  winBy: number;
  children: ReactNode;
}

export function GameTargetProvider({ group, week, targets, defaultTarget, winBy, children }: ProviderProps) {
  const key = storageKey(group, week);
  // The server and the first client render use the default, so hydration
  // matches; the saved choice applies straight after.
  const saved = useSyncExternalStore(subscribe, () => readSaved(key), () => null);
  const [unsaved, setUnsaved] = useState<number | null>(null);
  const picked = unsaved ?? saved;
  const target = picked !== null && targets.includes(picked) ? picked : defaultTarget;

  const choose = useCallback(
    (next: number) => {
      setUnsaved(next);
      try {
        window.localStorage.setItem(key, String(next));
        window.dispatchEvent(new Event(CHANGE_EVENT));
      } catch {
        // storage unavailable — the choice still applies for this visit
      }
    },
    [key],
  );

  return (
    <GameTargetContext.Provider value={target}>
      <div className="mb-8 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/40 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal">Games to</span>
          <div role="radiogroup" aria-label="Games to" className="inline-flex rounded-full border border-ngpa-slate/60 p-1">
            {targets.map((t) => {
              const on = t === target;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => choose(t)}
                  className={
                    on
                      ? "min-h-[40px] min-w-[52px] rounded-full bg-ngpa-lime px-4 font-mono text-sm font-bold text-ngpa-deep"
                      : "min-h-[40px] min-w-[52px] rounded-full px-4 font-mono text-sm font-bold text-ngpa-white/70 hover:text-ngpa-teal"
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-ngpa-white/60">win by {winBy}</span>
        </div>
      </div>
      {children}
    </GameTargetContext.Provider>
  );
}

/** The picked length, or null outside a provider (the server then accepts any allowed length). */
export function useGameTarget(): number | null {
  return useContext(GameTargetContext);
}
