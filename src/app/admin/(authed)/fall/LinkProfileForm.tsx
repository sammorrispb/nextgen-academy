"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface LinkCandidate {
  pageId: string;
  childFirstName: string;
  group: string;
  status: string;
  amountPaidUsd: number;
}

interface Props {
  candidates: LinkCandidate[];
}

interface LinkOk {
  ok: true;
  rowsRewritten: number;
  trialChildName: string;
  targetChildName: string;
  renameHint: boolean;
}

// Move a trial player's season results onto the paid registration that followed
// them. Both rows are picked by hand — the server re-reads and re-validates
// everything, so this component only has to name the pair.
export default function LinkProfileForm({ candidates }: Props) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<LinkOk | null>(null);
  const [pending, startTransition] = useTransition();

  const label = (c: LinkCandidate) =>
    `${c.childFirstName || "(no name)"} · ${c.group || "no group"} · ${c.status || "—"} · $${c.amountPaidUsd}`;

  function submit() {
    if (!from || !to) return;
    const a = candidates.find((c) => c.pageId === from);
    const b = candidates.find((c) => c.pageId === to);
    if (
      !window.confirm(
        `Move every game from "${a ? a.childFirstName : from}" onto "${b ? b.childFirstName : to}"?\n\n` +
          `The trial row is then marked Cancelled. Played scores are not touched.`,
      )
    )
      return;

    startTransition(async () => {
      setError(null);
      setDone(null);
      const res = await fetch("/api/admin/fall/link-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromPageId: from, toPageId: to }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<LinkOk> & { error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Link failed (${res.status})`);
        return;
      }
      setDone(json as LinkOk);
      setFrom("");
      setTo("");
      router.refresh();
    });
  }

  const select = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    exclude: string,
  ) => (
    <select
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        setDone(null);
        setError(null);
      }}
      className="min-h-[44px] rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-3 py-2 text-sm text-ngpa-white focus:border-ngpa-teal focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {candidates
        .filter((c) => c.pageId !== exclude)
        .map((c) => (
          <option key={c.pageId} value={c.pageId}>
            {label(c)}
          </option>
        ))}
    </select>
  );

  return (
    <section className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4 sm:p-6 mb-8">
      <h2 className="font-heading text-lg font-black text-ngpa-white tracking-tight mb-1">
        Link a trial profile
      </h2>
      <p className="text-sm text-ngpa-white/60 mb-4">
        A kid who played before their family paid earned their results against the row
        that existed that day. This moves those games onto the real registration and
        marks the trial row Cancelled. Scores are never changed.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ngpa-white/70">
          Trial row (results move FROM here)
          {select(from, setFrom, "Choose a row…", to)}
        </label>
        <label className="flex flex-col gap-1 text-xs text-ngpa-white/70">
          Paid registration (TO here)
          {select(to, setTo, "Choose a row…", from)}
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !from || !to}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-ngpa-lime text-ngpa-deep font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 min-h-[44px]"
        >
          {pending ? "Linking…" : "Link profiles"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      {done && (
        <div className="mt-3 text-sm text-emerald-300">
          <p>
            Moved {done.rowsRewritten} row{done.rowsRewritten === 1 ? "" : "s"} onto{" "}
            {done.targetChildName || "the paid registration"}.
          </p>
          {done.renameHint && (
            <p className="text-amber-300 mt-1">
              Heads up: those results were earned as &ldquo;{done.trialChildName}&rdquo; but the
              paid row reads &ldquo;{done.targetChildName}&rdquo;. Rename it in Notion if two kids
              share a first name.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
