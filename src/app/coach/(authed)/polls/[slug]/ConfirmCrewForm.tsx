"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmCrewAction } from "./actions";
import type { PollResponse } from "@/lib/notion-crew-polls";

interface ConfirmCrewFormProps {
  pollSlug: string;
  yesResponses: PollResponse[];
}

export default function ConfirmCrewForm({
  pollSlug,
  yesResponses,
}: ConfirmCrewFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(yesResponses.map((r) => r.id)),
  );
  const [firstSessionDate, setFirstSessionDate] = useState("");
  const [message, setMessage] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit() {
    setMessage("");
    if (selected.size === 0) {
      setMessage("Pick at least one parent");
      return;
    }
    startTransition(async () => {
      const result = await confirmCrewAction({
        pollSlug,
        selectedResponseIds: Array.from(selected),
        firstSessionDate,
      });
      setMessage(result.message);
      if (result.ok) {
        setTimeout(() => router.refresh(), 600);
      }
    });
  }

  if (yesResponses.length === 0) {
    return (
      <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70">
        No Yes votes yet — wait for the headcount before confirming.
      </div>
    );
  }

  return (
    <div className="bg-ngpa-panel/80 rounded-2xl border border-ngpa-slate/60 p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-ngpa-teal mb-3">
        Confirm crew
      </p>
      <p className="text-sm text-ngpa-white/70 mb-4">
        Pick which Yes voters make the crew. They&rsquo;ll get an email pointing
        to <code className="text-ngpa-teal">/schedule</code> to book session 1.
        Make sure the 4 weekly Sessions rows are already in the NGA Sessions
        Schedule DB before you confirm.
      </p>

      <div className="space-y-2 mb-4">
        {yesResponses.map((r) => (
          <label
            key={r.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-ngpa-slate/50 bg-ngpa-deep/40 cursor-pointer hover:border-ngpa-teal/40 transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              className="w-5 h-5 accent-ngpa-teal"
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ngpa-white text-sm">
                {r.childFirstName}{" "}
                <span className="text-ngpa-white/55 font-normal">
                  · {r.childLevel || "level?"} · age{" "}
                  {r.childBirthYear
                    ? new Date().getFullYear() - r.childBirthYear
                    : "?"}
                </span>
              </p>
              <p className="text-xs text-ngpa-white/65 truncate">
                {r.parentName} · {r.email}
              </p>
            </div>
          </label>
        ))}
      </div>

      <label className="block font-heading text-sm font-bold text-ngpa-white mb-1.5">
        First session date
      </label>
      <input
        type="date"
        value={firstSessionDate}
        onChange={(e) => setFirstSessionDate(e.target.value)}
        className="w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3 text-ngpa-white mb-4"
      />

      {message && (
        <p className="text-sm text-ngpa-teal mb-4" role="status">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        className="w-full px-6 py-3.5 bg-ngpa-lime text-ngpa-deep font-heading font-bold rounded-full hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed min-h-[48px]"
      >
        {pending
          ? "Confirming..."
          : `Confirm crew · email ${selected.size} parent${selected.size === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
