"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { describeRemoveOutcome, type OutcomeView } from "@/lib/admin-monday-girls-outcome";

type Mode = "already_refunded" | "none";

const TONE: Record<OutcomeView["tone"], string> = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  error: "text-red-400",
};

/**
 * Per-row "Remove…" on the Monday Girls roster. Records what happened — it never
 * moves money. Refund in the Stripe Dashboard first, then mark it here.
 */
export default function RemovePlayerControl({
  pageId,
  childFirstName,
  status,
}: {
  pageId: string;
  childFirstName: string;
  status: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // A Cancelled family can only move to Refunded (money came back later), so the
  // mode select is hidden for it and this default is the only option.
  const [mode, setMode] = useState<Mode>("already_refunded");
  const [notifyParent, setNotifyParent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<OutcomeView | null>(null);

  if (status === "Refunded") return null;

  async function submit() {
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch("/api/admin/monday-girls/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, mode, notifyParent }),
      });
      const json = await res.json().catch(() => null);
      const view = describeRemoveOutcome(res.ok, json, notifyParent);
      setOutcome(view);
      // Re-read from Notion so "done" is the row's real Status, not local state.
      if (view.tone !== "error") router.refresh();
    } catch {
      setOutcome({ tone: "error", text: "Network error — nothing was confirmed." });
    } finally {
      setBusy(false);
    }
  }

  const selectCls =
    "rounded-lg bg-ngpa-panel border border-ngpa-slate/60 px-2 py-2 text-sm min-h-12 text-ngpa-white";

  return (
    <div className="min-w-[10rem]">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="min-h-12 text-sm font-bold text-red-300 hover:text-red-200"
        >
          {status === "Cancelled" ? "Mark refunded…" : "Remove…"}
        </button>
      ) : (
        <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-3 space-y-2 w-64">
          <p className="text-[11px] text-red-300/90">
            Takes {childFirstName || "this player"} off the roster. This does not refund — do that
            in the Stripe Dashboard first.
          </p>
          {status !== "Cancelled" && (
            <select
              className={`${selectCls} w-full`}
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="already_refunded">Already refunded in Stripe</option>
              <option value="none">Withdrew — no refund</option>
            </select>
          )}
          <label className="flex items-center gap-2 text-xs text-ngpa-white/75 min-h-12">
            <input
              type="checkbox"
              checked={notifyParent}
              onChange={(e) => setNotifyParent(e.target.checked)}
              className="h-5 w-5"
            />
            Email the parent a cancellation note
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-full bg-red-500 text-white font-black min-h-12 px-4 text-sm disabled:opacity-40"
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setOutcome(null);
              }}
              className="min-h-12 text-sm text-ngpa-white/60 hover:text-ngpa-white"
            >
              Close
            </button>
          </div>
          {outcome && <p className={`text-sm ${TONE[outcome.tone]}`}>{outcome.text}</p>}
        </div>
      )}
    </div>
  );
}
