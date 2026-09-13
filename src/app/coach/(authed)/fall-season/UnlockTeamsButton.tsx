"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockTeamsAction } from "./actions";

export default function UnlockTeamsButton({ group }: { group: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Unlock the teams? You'll re-check attendance and lock again.")) return;
          startTransition(async () => {
            setError(null);
            const result = await unlockTeamsAction({ group });
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.refresh();
          });
        }}
        className="px-4 py-2 rounded-full border border-ngpa-slate/60 text-xs font-bold hover:border-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 min-h-[36px]"
      >
        {pending ? "Unlocking…" : "Unlock teams"}
      </button>
      {error && <span className="text-red-400 text-[11px]">{error}</span>}
    </div>
  );
}
