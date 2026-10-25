"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkInAction } from "../../actions";

interface Player {
  external_ref: string;
  name: string;
  present: boolean;
  guest?: boolean;
}

// Tap a name to check them in, tap again to take them out. Optimistic: the
// chip flips at once and flips back if Link & Dink refuses.
export default function CheckInList({ slug, week, players }: { slug: string; week: number; players: Player[] }) {
  const router = useRouter();
  const [present, setPresent] = useState<Record<string, boolean>>(
    Object.fromEntries(players.map((p) => [p.external_ref, p.present])),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const count = Object.values(present).filter(Boolean).length;

  function toggle(ref: string) {
    const next = !present[ref];
    setPresent((s) => ({ ...s, [ref]: next }));
    setError(null);
    startTransition(async () => {
      const r = await checkInAction({ slug, week, externalRef: ref, present: next });
      if (!r.ok) {
        setPresent((s) => ({ ...s, [ref]: !next }));
        setError(r.message);
        return;
      }
      router.refresh();
    });
  }

  if (players.length === 0) {
    return <p className="text-sm text-ngpa-white/60">No players yet. Go back and tap &ldquo;Sync roster&rdquo;.</p>;
  }

  return (
    <div>
      <p className="text-sm text-ngpa-white/70 mb-3">
        <span className="font-bold text-ngpa-white">{count}</span> here
      </p>
      <div className="flex flex-wrap gap-2">
        {players.map((p) => {
          const on = present[p.external_ref];
          return (
            <button
              key={p.external_ref}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p.external_ref)}
              className={
                on
                  ? "px-4 py-2 rounded-full bg-ngpa-teal text-ngpa-deep text-sm font-bold min-h-[48px]"
                  : "px-4 py-2 rounded-full border border-ngpa-slate/60 text-sm text-ngpa-white/70 hover:border-ngpa-teal min-h-[48px]"
              }
            >
              {on ? "✓ " : ""}
              {p.name}
              {p.guest && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">guest</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
