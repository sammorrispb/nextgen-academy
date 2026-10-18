"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDayAction } from "./actions";

interface Props {
  group: string;
  week: number;
  /** Who was checked in when the day was last saved. */
  presentIds: string[];
  nextRound: number;
}

// Extra time at the end of the list: one tap adds a round after the last one
// on the sheet, planned server-side from who is checked in. Nothing already on
// the sheet is replanned or cleared (saveDay's append mode). To change who is
// here first, use the planner at the top of the page.
export default function AddRoundButton({ group, week, presentIds, nextRound }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!window.confirm(`Add round ${nextRound} with the ${presentIds.length} kids checked in?`)) return;
    startTransition(async () => {
      setError(null);
      const result = await saveDayAction({ group, week, presentIds, rounds: 1, append: true });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={add}
        disabled={pending || presentIds.length < 2}
        className="inline-flex items-center gap-2 rounded-full border border-ngpa-lime/60 px-5 py-2.5 text-sm font-bold text-ngpa-lime transition-colors hover:bg-ngpa-lime/15 disabled:opacity-50 min-h-[48px]"
      >
        {pending ? "Adding…" : `+ Add round ${nextRound}`}
      </button>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}
