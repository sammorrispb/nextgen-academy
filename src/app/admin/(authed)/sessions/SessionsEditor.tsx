"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SESSION_STATUSES,
  type AdminSession,
  type SessionPatch,
  type SessionStatus,
} from "@/lib/notion-sessions-admin";

const EDITABLE: (keyof AdminSession)[] = [
  "title",
  "date",
  "startTime",
  "endTime",
  "location",
  "publicArea",
  "courtCount",
  "maxCourts",
  "status",
  "notes",
];

const STATUS_COLOR: Record<string, string> = {
  Open: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
  Full: "text-red-300 border-red-400/40 bg-red-400/10",
  Cancelled: "text-ngpa-white/50 border-ngpa-slate/50 bg-ngpa-slate/20",
  Completed: "text-sky-300 border-sky-400/40 bg-sky-400/10",
  Passed: "text-amber-300 border-amber-400/40 bg-amber-400/10",
};

interface Registrant {
  id: string;
  url: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number;
  amountPaidUsd: number;
  status: string;
  attendance: string;
}

interface RegistrantPanel {
  open: boolean;
  loading?: boolean;
  err?: string;
  list?: Registrant[];
  otherTitleCount?: number;
}

function prettyDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function SessionsEditor({
  initial,
  focusId,
}: {
  initial: AdminSession[];
  focusId: string | null;
}) {
  const [rows, setRows] = useState<AdminSession[]>(initial);
  // last-saved snapshot per id, for dirty-diffing (state, not a ref, so it's
  // safe to read during render)
  const [saved, setSaved] = useState<Record<string, AdminSession>>(() =>
    Object.fromEntries(initial.map((s) => [s.id, { ...s }])),
  );
  const [state, setState] = useState<Record<string, { busy?: boolean; msg?: string; err?: boolean }>>(
    {},
  );
  const [registrants, setRegistrants] = useState<Record<string, RegistrantPanel>>({});

  async function toggleRegistrants(row: AdminSession) {
    const cur = registrants[row.id];
    if (cur?.open) {
      setRegistrants((m) => ({ ...m, [row.id]: { ...cur, open: false } }));
      return;
    }
    if (cur?.list) {
      setRegistrants((m) => ({ ...m, [row.id]: { ...cur, open: true } }));
      return;
    }
    setRegistrants((m) => ({ ...m, [row.id]: { open: true, loading: true } }));
    // Query by the last-saved title/date — unsaved edits haven't reached the
    // registration rows, which store the title as it read at checkout time.
    const base = saved[row.id] ?? row;
    try {
      const qs = new URLSearchParams({ date: base.date, title: base.title });
      const res = await fetch(`/api/admin/sessions/registrants?${qs}`);
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.registrants)) {
        setRegistrants((m) => ({
          ...m,
          [row.id]: { open: true, list: j.registrants, otherTitleCount: j.otherTitleCount ?? 0 },
        }));
      } else {
        setRegistrants((m) => ({
          ...m,
          [row.id]: { open: true, err: j.error || "Failed to load registrants" },
        }));
      }
    } catch {
      setRegistrants((m) => ({ ...m, [row.id]: { open: true, err: "Network error" } }));
    }
  }

  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`s-${focusId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-ngpa-teal");
      const t = setTimeout(() => el.classList.remove("ring-2", "ring-ngpa-teal"), 2400);
      return () => clearTimeout(t);
    }
  }, [focusId]);

  function patch(id: string, key: keyof AdminSession, value: string | number | null) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  function dirty(row: AdminSession): boolean {
    const base = saved[row.id];
    if (!base) return true;
    return EDITABLE.some((k) => (row[k] ?? "") !== (base[k] ?? ""));
  }

  function buildPatch(row: AdminSession): SessionPatch {
    const base = saved[row.id] ?? row;
    const p: SessionPatch = {};
    for (const k of EDITABLE) {
      if ((row[k] ?? "") !== (base[k] ?? "")) {
        // @ts-expect-error keyed assignment across the shared editable union
        p[k] = row[k];
      }
    }
    return p;
  }

  async function save(row: AdminSession) {
    const p = buildPatch(row);
    if (Object.keys(p).length === 0) return;
    setState((s) => ({ ...s, [row.id]: { busy: true } }));
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, patch: p }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.session) {
        setSaved((m) => ({ ...m, [row.id]: { ...j.session } }));
        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...j.session } : r)));
        setState((s) => ({ ...s, [row.id]: { msg: "Saved ✓" } }));
      } else {
        setState((s) => ({ ...s, [row.id]: { msg: j.error || "Save failed", err: true } }));
      }
    } catch {
      setState((s) => ({ ...s, [row.id]: { msg: "Network error", err: true } }));
    }
  }

  const inputCls =
    "w-full rounded-lg bg-ngpa-deep border border-ngpa-slate/60 px-3 py-2 text-sm text-ngpa-white outline-none focus:border-ngpa-teal";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-ngpa-white/55 mb-1";

  const count = useMemo(() => rows.length, [rows]);

  if (!count) return <p className="text-ngpa-white/60 text-sm">No upcoming sessions found.</p>;

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const st = state[row.id] || {};
        const reg = registrants[row.id] || { open: false };
        const isDirty = dirty(row);
        return (
          <div
            key={row.id}
            id={`s-${row.id}`}
            className="rounded-2xl border border-ngpa-slate/50 bg-ngpa-panel/60 p-4 sm:p-5 transition-shadow"
          >
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="font-heading font-black text-ngpa-teal">{prettyDate(row.date)}</span>
              {row.level && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-ngpa-slate/60 text-ngpa-white/70">
                  {row.level}
                </span>
              )}
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  STATUS_COLOR[row.status] || "border-ngpa-slate/60 text-ngpa-white/70"
                }`}
              >
                {row.status || "—"}
              </span>
              <button
                onClick={() => toggleRegistrants(row)}
                className="ml-auto min-h-12 px-3 -mr-3 text-sm text-ngpa-white/70 hover:text-ngpa-white transition-colors"
                aria-expanded={reg.open || false}
              >
                <b className="text-ngpa-white">{row.registered}</b> registered{" "}
                <span aria-hidden className="inline-block text-xs">
                  {reg.open ? "▲" : "▼"}
                </span>
              </button>
            </div>

            {reg.open && (
              <div className="mb-4 rounded-xl border border-ngpa-slate/50 bg-ngpa-deep/60 p-3 sm:p-4">
                {reg.loading && <p className="text-sm text-ngpa-white/60">Loading registrants…</p>}
                {reg.err && <p className="text-sm text-red-400">{reg.err}</p>}
                {reg.list && reg.list.length === 0 && (
                  <p className="text-sm text-ngpa-white/60">No registrations yet.</p>
                )}
                {reg.list && reg.list.length > 0 && (
                  <ul className="divide-y divide-ngpa-slate/40">
                    {reg.list.map((r) => (
                      <li key={r.id} className="py-2 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                          <b className="text-ngpa-white">{r.childFirstName || "—"}</b>
                          {r.childBirthYear > 0 && (
                            <span className="text-ngpa-white/50 text-xs">b. {r.childBirthYear}</span>
                          )}
                          {r.status !== "Confirmed" && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-400/40 text-amber-300">
                              {r.status || "—"}
                            </span>
                          )}
                          {r.attendance && (
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                r.attendance === "Present"
                                  ? "border-emerald-400/40 text-emerald-300"
                                  : "border-red-400/40 text-red-300"
                              }`}
                            >
                              {r.attendance}
                            </span>
                          )}
                          <span className="ml-auto text-ngpa-white/60 text-xs">
                            ${r.amountPaidUsd}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ngpa-white/70 mt-0.5">
                          <span>{r.parentName || "—"}</span>
                          {r.parentEmail && (
                            <a className="underline decoration-ngpa-slate hover:text-ngpa-white" href={`mailto:${r.parentEmail}`}>
                              {r.parentEmail}
                            </a>
                          )}
                          {r.parentPhone && (
                            <a className="underline decoration-ngpa-slate hover:text-ngpa-white" href={`tel:${r.parentPhone}`}>
                              {r.parentPhone}
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {reg.list && (reg.otherTitleCount ?? 0) > 0 && (
                  <p className="text-[11px] text-ngpa-white/45 mt-2">
                    {reg.otherTitleCount} other registration{reg.otherTitleCount === 1 ? "" : "s"} on
                    this date under a different session title.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>Session title</label>
                <input
                  className={inputCls}
                  value={row.title}
                  onChange={(e) => patch(row.id, "title", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={row.date}
                  onChange={(e) => patch(row.id, "date", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  className={inputCls}
                  value={row.status}
                  onChange={(e) => patch(row.id, "status", e.target.value as SessionStatus)}
                >
                  {!SESSION_STATUSES.includes(row.status as SessionStatus) && (
                    <option value={row.status}>{row.status || "—"}</option>
                  )}
                  {SESSION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Start time</label>
                <input
                  className={inputCls}
                  value={row.startTime}
                  placeholder="6:00 PM"
                  onChange={(e) => patch(row.id, "startTime", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>End time</label>
                <input
                  className={inputCls}
                  value={row.endTime}
                  placeholder="7:00 PM"
                  onChange={(e) => patch(row.id, "endTime", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Location (exact venue)</label>
                <input
                  className={inputCls}
                  value={row.location}
                  placeholder="e.g. Walter Johnson HS, 6400 Rock Spring Dr, Bethesda, MD"
                  onChange={(e) => patch(row.id, "location", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Public area</label>
                <input
                  className={inputCls}
                  value={row.publicArea}
                  placeholder="e.g. Olney, MD"
                  onChange={(e) => patch(row.id, "publicArea", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Courts</label>
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={row.courtCount ?? ""}
                    onChange={(e) =>
                      patch(row.id, "courtCount", e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Max courts</label>
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={row.maxCourts ?? ""}
                    onChange={(e) =>
                      patch(row.id, "maxCourts", e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea
                  className={`${inputCls} min-h-[60px] resize-y`}
                  value={row.notes}
                  onChange={(e) => patch(row.id, "notes", e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => save(row)}
                disabled={!isDirty || st.busy}
                className="rounded-full bg-ngpa-teal text-ngpa-deep font-black px-5 py-2 text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {st.busy ? "Saving…" : isDirty ? "Save changes" : "Saved"}
              </button>
              {st.msg && (
                <span className={`text-sm ${st.err ? "text-red-400" : "text-emerald-300"}`}>
                  {st.msg}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
