"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRegistrationAction } from "./actions";

interface Props {
  checkoutSessionId: string;
  childFirstName: string;
}

export default function CancelButton({
  checkoutSessionId,
  childFirstName,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!checkoutSessionId) return null;

  function onCancel() {
    startTransition(async () => {
      setError(null);
      const result = await cancelRegistrationAction(checkoutSessionId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/40 font-bold hover:bg-red-500/25 disabled:opacity-60 transition-colors"
        >
          {pending ? "…" : `Cancel ${childFirstName || "row"}`}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={pending}
          className="px-2.5 py-1 rounded-full text-ngpa-white/60 hover:text-ngpa-white transition-colors"
        >
          Keep
        </button>
        {error && <span className="text-red-400 ml-1">{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs text-ngpa-white/45 hover:text-red-300 transition-colors"
      title="Cancel this registration"
    >
      Cancel
    </button>
  );
}
