"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lockFinalAction, previewFinalAction } from "./actions";
import type { FinalPreview } from "@/lib/season-league-view";

// The Finale's final game (Sam, 2026-11-02): one tap shows who plays — the
// top four kids checked in for the round robin, #1 & #4 vs #2 & #3 — and one
// locks it. There is no second check-in grid: the round robin's is the one
// list of who is here today. A dead-even tie at the #4/#5 cut is settled on
// court; the coach then picks who takes the spot.

const primary =
  "px-5 py-2.5 rounded-full bg-ngpa-lime text-ngpa-deep text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50 min-h-[44px]";
const secondary =
  "px-5 py-2.5 rounded-full border border-ngpa-slate/60 text-sm font-bold text-ngpa-white hover:border-ngpa-teal hover:text-ngpa-teal transition-colors disabled:opacity-50 min-h-[44px]";

export default function FinalLocker({ group }: { group: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<FinalPreview | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function show(pick: string[]) {
    startTransition(async () => {
      setError(null);
      setPreview(await previewFinalAction({ group, chosen: pick }));
    });
  }

  function lock() {
    if (!window.confirm("Lock the final? You can unlock it until it's scored.")) return;
    startTransition(async () => {
      setError(null);
      const result = await lockFinalAction({ group, chosen });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  const tie = preview && !preview.ok ? preview.tie : undefined;
  const label = (p: Extract<FinalPreview, { ok: true }>, i: number) =>
    p.teams[i].members.map((id) => p.names[id] ?? "?").join(" & ");

  return (
    <div className="space-y-4">
      {preview?.ok ? (
        <div className="rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/60 px-4 py-3">
          <p className="text-sm">
            <span className="font-bold text-ngpa-white">{label(preview, 0)}</span>
            <span className="text-ngpa-white/45"> vs </span>
            <span className="font-bold text-ngpa-white">{label(preview, 1)}</span>
          </p>
          {preview.warning && <p className="mt-2 text-xs text-amber-200">{preview.warning}</p>}
        </div>
      ) : (
        preview && <p className="text-sm text-amber-200">{preview.message}</p>
      )}

      {tie && (
        <fieldset className="space-y-2">
          <legend className="text-xs text-ngpa-white/65 mb-1">
            Who plays? Pick {tie.spots}.
          </legend>
          {tie.kids.map((k) => (
            <label key={k.id} className="flex items-center gap-2 text-sm text-ngpa-white min-h-[36px]">
              <input
                type="checkbox"
                className="accent-ngpa-teal"
                checked={chosen.includes(k.id)}
                onChange={() =>
                  setChosen((c) => (c.includes(k.id) ? c.filter((x) => x !== k.id) : [...c, k.id].slice(-tie.spots)))
                }
              />
              {k.name}
            </label>
          ))}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => show(chosen)} disabled={pending} className={preview?.ok ? secondary : primary}>
          {pending && !preview ? "Loading…" : preview ? "Refresh" : "Show the final"}
        </button>
        {preview?.ok && (
          <button type="button" onClick={lock} disabled={pending} className={primary}>
            {pending ? "Locking…" : "Lock the final"}
          </button>
        )}
        {error && <span className="text-red-400 text-xs">{error}</span>}
      </div>
    </div>
  );
}
