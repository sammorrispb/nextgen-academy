"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface MaybeRow {
  pageId: string;
  parentName: string;
  parentEmail: string;
  childFirstName: string;
  addedOnIso: string;
}

/**
 * Families Sam is still talking to. A maybe holds no seat, carries no money and
 * never gets an automatic email — it's a note that lives beside the roster.
 * Only a parent name, a child's first name and an optional email are stored.
 */
export default function MaybesPanel({ maybes }: { maybes: MaybeRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ parentName: "", childFirstName: "", parentEmail: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);

  async function post(body: Record<string, string>, key: string, okText: string) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/monday-girls/maybe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && json?.ok) {
        setMsg({ text: okText, err: false });
        router.refresh();
        return true;
      }
      setMsg({ text: json?.error || "Something went wrong — nothing was saved.", err: true });
    } catch {
      setMsg({ text: "Network error — nothing was saved.", err: true });
    } finally {
      setBusy(null);
    }
    return false;
  }

  const inputCls =
    "w-full rounded-lg bg-ngpa-deep border border-ngpa-slate/60 px-3 py-2 text-sm text-ngpa-white outline-none focus:border-ngpa-teal min-h-12";

  return (
    <section className="mt-10">
      <h2 className="font-heading text-xl font-black">Maybes</h2>
      <p className="text-ngpa-white/60 text-sm mt-1">
        Families you&rsquo;re talking to who haven&rsquo;t registered. Not counted as seats. When
        one registers, dismiss her here.
      </p>

      {maybes.length === 0 ? (
        <p className="mt-4 text-sm text-ngpa-white/55">No maybes right now.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ngpa-slate/30 rounded-xl border border-ngpa-slate/50">
          {maybes.map((m) => (
            <li key={m.pageId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
              <span className="font-heading font-bold">{m.childFirstName || "—"}</span>
              <span className="text-sm text-ngpa-white/70">{m.parentName}</span>
              {m.parentEmail && (
                <a
                  href={`mailto:${m.parentEmail}`}
                  className="text-sm text-ngpa-teal underline break-all"
                >
                  {m.parentEmail}
                </a>
              )}
              <button
                onClick={() => post({ action: "dismiss", pageId: m.pageId }, m.pageId, "Dismissed.")}
                disabled={busy !== null}
                className="ml-auto min-h-12 text-sm font-bold text-ngpa-white/60 hover:text-ngpa-white disabled:opacity-40"
              >
                {busy === m.pageId ? "Dismissing…" : "Dismiss"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          const saved = await post({ action: "add", ...form }, "add", "Added.");
          if (saved) setForm({ parentName: "", childFirstName: "", parentEmail: "" });
        }}
      >
        <input
          className={inputCls}
          placeholder="Child first name"
          aria-label="Child first name"
          value={form.childFirstName}
          onChange={(e) => setForm({ ...form, childFirstName: e.target.value })}
          maxLength={50}
          required
        />
        <input
          className={inputCls}
          placeholder="Parent name"
          aria-label="Parent name"
          value={form.parentName}
          onChange={(e) => setForm({ ...form, parentName: e.target.value })}
          maxLength={100}
          required
        />
        <input
          className={inputCls}
          placeholder="Parent email (optional)"
          aria-label="Parent email"
          type="email"
          value={form.parentEmail}
          onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
        />
        <button
          type="submit"
          disabled={busy !== null}
          className="rounded-full bg-ngpa-teal text-ngpa-deep font-black min-h-12 px-5 text-sm disabled:opacity-40"
        >
          {busy === "add" ? "Adding…" : "Add maybe"}
        </button>
      </form>
      {msg && (
        <p className={`mt-2 text-sm ${msg.err ? "text-red-400" : "text-emerald-300"}`}>{msg.text}</p>
      )}
    </section>
  );
}
