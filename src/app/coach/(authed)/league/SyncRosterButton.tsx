"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncRosterAction } from "./actions";

export default function SyncRosterButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function sync() {
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const r = await syncRosterAction({ slug });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      const notes = [
        `${r.sent} player${r.sent === 1 ? "" : "s"} synced`,
        r.skipped ? `${r.skipped} skipped (name needs fixing in Notion)` : null,
        r.refused ? `${r.refused} erased on Link & Dink, not re-added` : null,
      ].filter(Boolean);
      setMessage(notes.join(" · "));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={sync}
        disabled={pending}
        className="px-4 py-2 rounded-full bg-ngpa-lime text-ngpa-deep text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50 min-h-[44px]"
      >
        {pending ? "Syncing…" : "Sync roster"}
      </button>
      {message && <span className="text-emerald-300 text-xs">{message}</span>}
      {error && <span className="text-red-400 text-xs max-w-xs text-right">{error}</span>}
    </div>
  );
}
