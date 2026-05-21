"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRegistrationAction } from "./actions";

interface Props {
  checkoutSessionId: string;
  childFirstName: string;
  amountPaidUsd: number;
}

export default function CancelButton({
  checkoutSessionId,
  childFirstName,
  amountPaidUsd,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!checkoutSessionId) return null;
  const who = childFirstName || "this player";

  function run(opts: Parameters<typeof cancelRegistrationAction>[1]) {
    startTransition(async () => {
      setError(null);
      const result = await cancelRegistrationAction(checkoutSessionId, opts);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function onCustom() {
    const dollars = parseFloat(custom);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a dollar amount");
      return;
    }
    if (dollars > amountPaidUsd) {
      setError(`Max $${amountPaidUsd.toFixed(2)}`);
      return;
    }
    run({ refund: "partial", amountCents: Math.round(dollars * 100) });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ngpa-white/45 hover:text-red-300 transition-colors"
        title="Cancel or refund this registration"
      >
        Cancel
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5 text-xs">
      <button
        type="button"
        onClick={() => run({ refund: "full" })}
        disabled={pending}
        className="px-2.5 py-1 rounded-full bg-ngpa-teal/15 text-ngpa-teal border border-ngpa-teal/40 font-bold hover:bg-ngpa-teal/25 disabled:opacity-60 transition-colors whitespace-nowrap"
      >
        {pending ? "…" : `Refund $${amountPaidUsd.toFixed(0)} + cancel`}
      </button>

      <div className="flex items-center gap-1">
        <span className="text-ngpa-white/50">$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max={amountPaidUsd}
          step="0.01"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="0.00"
          disabled={pending}
          className="w-16 px-2 py-1 rounded-md bg-ngpa-deep/60 border border-ngpa-slate/60 text-ngpa-white text-right focus:border-ngpa-teal outline-none"
        />
        <button
          type="button"
          onClick={onCustom}
          disabled={pending}
          className="px-2 py-1 rounded-full border border-ngpa-teal/40 text-ngpa-teal font-bold hover:bg-ngpa-teal/15 disabled:opacity-60 transition-colors"
        >
          Refund
        </button>
      </div>

      <button
        type="button"
        onClick={() => run({ refund: "none" })}
        disabled={pending}
        className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/40 font-bold hover:bg-red-500/25 disabled:opacity-60 transition-colors whitespace-nowrap"
        title="Remove from roster without refunding"
      >
        Cancel {who}, no refund
      </button>

      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        disabled={pending}
        className="text-ngpa-white/60 hover:text-ngpa-white transition-colors"
      >
        Keep
      </button>

      {error && <span className="text-red-400 text-right max-w-[10rem]">{error}</span>}
    </div>
  );
}
