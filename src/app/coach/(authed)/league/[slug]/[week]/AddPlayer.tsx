"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addGuestAction, guestCandidatesAction } from "../../actions";
import type { GuestCandidate } from "@/lib/rotation-league/view";
import { LEAGUE_PLAYER_CHANGES_ENABLED, PLAYER_CHANGES_UNAVAILABLE } from "@/lib/rotation-league/capabilities";

// Add someone for tonight who isn't on this group's roster: a child from the
// other ball group, or anyone by first name (the coach filling a court). They
// are checked in and play like anyone, but are never ranked (a guest). Once
// added, a guest stays on this season's check-in list for later weeks.
export default function AddPlayer({ slug, week, onRoster }: { slug: string; week: number; onRoster: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<GuestCandidate[] | null>(null);
  const [pick, setPick] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const listed = new Set(onRoster);
  const choices = (candidates ?? []).filter((c) => !listed.has(c.external_ref));

  function start() {
    setOpen(true);
    setError(null);
    startTransition(async () => {
      const r = await guestCandidatesAction({ slug });
      if (!r.ok) {
        setCandidates([]);
        setError(r.message);
        return;
      }
      setCandidates(r.candidates);
    });
  }

  function add() {
    startTransition(async () => {
      setError(null);
      const r = await addGuestAction(
        pick ? { slug, week, externalRef: pick } : { slug, week, firstName: first, lastName: last },
      );
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setPick("");
      setFirst("");
      setLast("");
      setOpen(false);
      router.refresh();
    });
  }

  const button = "px-4 py-2 rounded-full text-sm font-bold transition-all disabled:opacity-50 min-h-[44px]";
  const field =
    "rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-3 py-2 text-sm text-ngpa-white min-h-[44px] w-full sm:w-auto";

  if (!LEAGUE_PLAYER_CHANGES_ENABLED) {
    return <p role="status" className="mt-3 text-sm text-ngpa-white/70">{PLAYER_CHANGES_UNAVAILABLE.message}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={start}
        className={`${button} mt-3 border border-ngpa-slate/60 text-ngpa-white hover:border-ngpa-teal`}
      >
        + Add a player
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-ngpa-teal/50 bg-ngpa-panel/40 p-4 space-y-3 max-w-xl">
      <p className="text-sm text-ngpa-white">
        Add someone for tonight. They play like anyone else but aren&rsquo;t ranked in the standings.
      </p>
      <label className="block text-xs text-ngpa-white/70">
        From the other group
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          disabled={pending || candidates === null}
          className={`${field} mt-1 block`}
        >
          <option value="">{candidates === null ? "Loading…" : choices.length ? "Pick a player" : "No one to add"}</option>
          {choices.map((c) => (
            <option key={c.external_ref} value={c.external_ref}>
              {c.name} ({c.group})
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-ngpa-white/50">or type a name</p>
      <div className="flex flex-wrap gap-2">
        <input
          value={first}
          onChange={(e) => {
            setFirst(e.target.value);
            if (e.target.value) setPick("");
          }}
          placeholder="First name"
          aria-label="First name"
          maxLength={40}
          disabled={pending || pick !== ""}
          className={field}
        />
        <input
          value={last}
          onChange={(e) => setLast(e.target.value)}
          placeholder="Last name (optional)"
          aria-label="Last name (optional)"
          maxLength={40}
          disabled={pending || pick !== ""}
          className={field}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          disabled={pending || (!pick && first.trim() === "")}
          className={`${button} bg-ngpa-lime text-ngpa-deep hover:brightness-110`}
        >
          {pending && candidates !== null ? "Adding…" : "Add and check in"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className={`${button} text-ngpa-white/65 hover:text-ngpa-white`}
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
