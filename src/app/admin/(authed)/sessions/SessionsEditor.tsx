"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SESSION_STATUSES,
  type AdminSession,
  type SessionPatch,
  type SessionStatus,
} from "@/lib/notion-sessions-admin";
import type { CancelReason } from "@/lib/email/session-cancelled";
import { buildRosterMailto } from "@/lib/roster-mailto";

const CANCEL_REASONS: { value: CancelReason; label: string }[] = [
  { value: "weather", label: "Weather" },
  { value: "venue", label: "Venue issue" },
  { value: "low-enrollment", label: "Low enrollment" },
  { value: "other", label: "Other" },
];

interface ActionPanel {
  kind?: "cancel" | "reschedule";
  busy?: boolean;
  msg?: string;
  err?: boolean;
  reason?: CancelReason;
  note?: string;
  newDate?: string;
  newStart?: string;
  newEnd?: string;
}

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

const LEVEL_ORDER = ["Red", "Orange", "Green", "Yellow"] as const;

const LEVEL_DOT: Record<string, string> = {
  Red: "bg-ngpa-skill-red",
  Orange: "bg-ngpa-skill-orange",
  Green: "bg-ngpa-skill-green",
  Yellow: "bg-ngpa-skill-yellow",
};

/** Bucket date-ascending rows into ordered day groups (encounter order kept). */
function groupByDate(
  rows: AdminSession[],
): { date: string; rows: AdminSession[] }[] {
  const groups: { date: string; rows: AdminSession[] }[] = [];
  const index = new Map<string, number>();
  for (const r of rows) {
    let i = index.get(r.date);
    if (i === undefined) {
      i = groups.length;
      index.set(r.date, i);
      groups.push({ date: r.date, rows: [] });
    }
    groups[i].rows.push(r);
  }
  return groups;
}

/** Per-level registered totals for a day, canonical levels first. */
function levelSummary(
  dayRows: AdminSession[],
): { level: string; registered: number }[] {
  const totals = new Map<string, number>();
  for (const r of dayRows) {
    const key = r.level || "No level";
    totals.set(key, (totals.get(key) ?? 0) + (r.registered || 0));
  }
  const ordered: { level: string; registered: number }[] = [];
  for (const lvl of LEVEL_ORDER) {
    if (totals.has(lvl)) {
      ordered.push({ level: lvl, registered: totals.get(lvl)! });
      totals.delete(lvl);
    }
  }
  for (const [level, registered] of totals) ordered.push({ level, registered });
  return ordered;
}

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
  profileKey: string;
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
  const [action, setAction] = useState<Record<string, ActionPanel>>({});
  // Day groups collapse by default; the day holding the ?focus=<id> row opens so
  // the existing scroll-to-row deep link still lands.
  const [openDays, setOpenDays] = useState<Record<string, boolean>>(() => {
    const f = focusId ? initial.find((s) => s.id === focusId) : undefined;
    return f ? { [f.date]: true } : {};
  });

  function setAct(id: string, patch: Partial<ActionPanel>) {
    setAction((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
  }

  async function doCancel(row: AdminSession) {
    const a = action[row.id] || {};
    const base = saved[row.id] ?? row;
    if (!a.reason) {
      setAct(row.id, { msg: "Pick a reason first.", err: true });
      return;
    }
    setAct(row.id, { busy: true, msg: undefined, err: false });
    try {
      const res = await fetch("/api/admin/sessions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionRowId: row.id,
          sessionTitle: base.title,
          sessionDate: base.date,
          sessionStartTime: base.startTime,
          reason: a.reason,
          note: a.note?.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: "Cancelled" } : r)));
        setSaved((m) => ({ ...m, [row.id]: { ...(m[row.id] ?? row), status: "Cancelled" } }));
        setAct(row.id, { busy: false, kind: undefined, msg: j.message || "Cancelled ✓", err: false });
      } else {
        setAct(row.id, { busy: false, msg: j.message || j.error || "Cancel failed", err: true });
      }
    } catch {
      setAct(row.id, { busy: false, msg: "Network error", err: true });
    }
  }

  async function doReschedule(row: AdminSession) {
    const a = action[row.id] || {};
    const base = saved[row.id] ?? row;
    if (!a.newDate || !a.newStart) {
      setAct(row.id, { msg: "New date and start time are required.", err: true });
      return;
    }
    setAct(row.id, { busy: true, msg: undefined, err: false });
    try {
      const res = await fetch("/api/admin/sessions/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionRowId: row.id,
          sessionTitle: base.title,
          oldDate: base.date,
          oldStartTime: base.startTime,
          newDate: a.newDate,
          newStartTime: a.newStart,
          newEndTime: a.newEnd?.trim() || base.endTime,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        const next = { date: a.newDate!, startTime: a.newStart!, endTime: a.newEnd?.trim() || base.endTime };
        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...next } : r)));
        setSaved((m) => ({ ...m, [row.id]: { ...(m[row.id] ?? row), ...next } }));
        setAct(row.id, { busy: false, kind: undefined, msg: j.message || "Rescheduled ✓", err: false });
      } else {
        setAct(row.id, { busy: false, msg: j.message || j.error || "Reschedule failed", err: true });
      }
    } catch {
      setAct(row.id, { busy: false, msg: "Network error", err: true });
    }
  }

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
      const qs = new URLSearchParams({ date: base.date, title: base.title, sessionId: row.id });
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
    // Footgun guard: a plain Save to Cancelled skips refunds + parent comms.
    // Route any cancel of a session that has registrants through the proper
    // refund+notify engine instead.
    if (p.status === "Cancelled" && (saved[row.id]?.registered ?? row.registered) > 0) {
      setState((s) => ({
        ...s,
        [row.id]: { msg: "Use “Cancel & notify all” to refund + notify parents.", err: true },
      }));
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: saved[row.id]?.status ?? r.status } : r)));
      return;
    }
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

  const renderRow = (row: AdminSession) => {
        const st = state[row.id] || {};
        const reg = registrants[row.id] || { open: false };
        const act = action[row.id] || {};
        const isDirty = dirty(row);
        const isCancelled = row.status === "Cancelled";
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
                          <span className="ml-auto flex gap-3">
                            {r.profileKey && (
                              <a
                                className="underline decoration-ngpa-slate hover:text-ngpa-white"
                                href={`/coach/players/${r.profileKey}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Profile ↗
                              </a>
                            )}
                            {r.url && (
                              <a
                                className="underline decoration-ngpa-slate hover:text-ngpa-white"
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Notion ↗
                              </a>
                            )}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {reg.list &&
                  (() => {
                    const confirmed = reg.list.filter((r) => r.status === "Confirmed").length;
                    const counter = (saved[row.id] ?? row).registered;
                    if (confirmed === counter) return null;
                    return (
                      <p className="text-[11px] font-bold text-amber-300 mt-2">
                        ⚠ Counter shows {counter} but {confirmed} confirmed registration
                        {confirmed === 1 ? "" : "s"} found — the registered counter may have
                        drifted.
                      </p>
                    );
                  })()}
                {reg.list && (reg.otherTitleCount ?? 0) > 0 && (
                  <p className="text-[11px] text-ngpa-white/45 mt-2">
                    {reg.otherTitleCount} other registration{reg.otherTitleCount === 1 ? "" : "s"} on
                    this date under a different session title.
                  </p>
                )}
                {reg.list &&
                  (() => {
                    const base = saved[row.id] ?? row;
                    const mailto = buildRosterMailto({
                      emails: (reg.list ?? [])
                        .filter((r) => r.status === "Confirmed")
                        .map((r) => r.parentEmail),
                      sessionTitle: base.title,
                      prettyDate: prettyDate(base.date),
                      startTime: base.startTime,
                      endTime: base.endTime,
                      location: base.location,
                    });
                    if (!mailto) return null;
                    return (
                      <a
                        href={mailto}
                        className="inline-flex items-center min-h-12 mt-1 text-sm font-bold text-ngpa-teal hover:opacity-90 transition-opacity"
                      >
                        ✉ Email all parents
                      </a>
                    );
                  })()}
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

            <div className="flex flex-wrap items-center gap-3 mt-4">
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
              <span className="ml-auto flex gap-2">
                <button
                  onClick={() =>
                    setAct(row.id, {
                      kind: act.kind === "reschedule" ? undefined : "reschedule",
                      msg: undefined,
                      err: false,
                      newDate: act.newDate ?? "",
                      newStart: act.newStart ?? row.startTime,
                      newEnd: act.newEnd ?? row.endTime,
                    })
                  }
                  disabled={isCancelled}
                  className="rounded-full border border-ngpa-slate/60 text-ngpa-white/80 font-bold px-4 py-2 text-sm disabled:opacity-30 hover:text-ngpa-white hover:border-ngpa-white/40 transition-colors"
                >
                  Reschedule
                </button>
                <button
                  onClick={() =>
                    setAct(row.id, {
                      kind: act.kind === "cancel" ? undefined : "cancel",
                      msg: undefined,
                      err: false,
                    })
                  }
                  disabled={isCancelled}
                  className="rounded-full border border-red-400/40 text-red-300 font-bold px-4 py-2 text-sm disabled:opacity-30 hover:bg-red-400/10 transition-colors"
                >
                  {isCancelled ? "Cancelled" : "Cancel…"}
                </button>
              </span>
            </div>

            {act.kind === "cancel" && (
              <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/5 p-3 sm:p-4">
                <p className="text-sm font-bold text-red-300 mb-2">
                  Cancel &amp; notify all — refunds every confirmed registrant and emails/texts them.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Reason</label>
                    <select
                      className={inputCls}
                      value={act.reason ?? ""}
                      onChange={(e) => setAct(row.id, { reason: e.target.value as CancelReason })}
                    >
                      <option value="" disabled>
                        Pick a reason…
                      </option>
                      {CANCEL_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Note (optional)</label>
                    <input
                      className={inputCls}
                      value={act.note ?? ""}
                      placeholder="Shown to parents, verbatim"
                      onChange={(e) => setAct(row.id, { note: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => doCancel(row)}
                    disabled={act.busy}
                    className="rounded-full bg-red-500 text-white font-black px-5 py-2 text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    {act.busy ? "Cancelling…" : "Confirm cancel + refund all"}
                  </button>
                  {act.msg && (
                    <span className={`text-sm ${act.err ? "text-red-400" : "text-emerald-300"}`}>
                      {act.msg}
                    </span>
                  )}
                </div>
              </div>
            )}

            {act.kind === "reschedule" && (
              <div className="mt-3 rounded-xl border border-ngpa-teal/30 bg-ngpa-teal/5 p-3 sm:p-4">
                <p className="text-sm font-bold text-ngpa-teal mb-2">
                  Reschedule &amp; notify — paid spots carry over (no refund); registered parents are emailed the new date.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>New date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={act.newDate ?? ""}
                      onChange={(e) => setAct(row.id, { newDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>New start time</label>
                    <input
                      className={inputCls}
                      value={act.newStart ?? ""}
                      placeholder="6:00 PM"
                      onChange={(e) => setAct(row.id, { newStart: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>New end time</label>
                    <input
                      className={inputCls}
                      value={act.newEnd ?? ""}
                      placeholder="7:00 PM"
                      onChange={(e) => setAct(row.id, { newEnd: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => doReschedule(row)}
                    disabled={act.busy}
                    className="rounded-full bg-ngpa-teal text-ngpa-deep font-black px-5 py-2 text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    {act.busy ? "Rescheduling…" : "Confirm reschedule + notify"}
                  </button>
                  {act.msg && (
                    <span className={`text-sm ${act.err ? "text-red-400" : "text-emerald-300"}`}>
                      {act.msg}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
  };

  const groups = groupByDate(rows);

  return (
    <div className="space-y-3">
      {groups.map(({ date, rows: dayRows }) => {
        const open = openDays[date] ?? false;
        const summary = levelSummary(dayRows);
        const total = dayRows.reduce((n, r) => n + (r.registered || 0), 0);
        return (
          <div
            key={date}
            className="rounded-2xl border border-ngpa-slate/50 bg-ngpa-panel/30"
          >
            <button
              onClick={() => setOpenDays((m) => ({ ...m, [date]: !open }))}
              aria-expanded={open}
              className="w-full flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-3 text-left min-h-12"
            >
              <span className="font-heading font-black text-ngpa-teal">
                {prettyDate(date)}
              </span>
              <span className="text-[11px] text-ngpa-white/45">
                {dayRows.length} session{dayRows.length === 1 ? "" : "s"}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {summary.map((s) => (
                  <span
                    key={s.level}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-ngpa-white/70"
                  >
                    <span
                      aria-hidden
                      className={`h-2 w-2 rounded-full ${LEVEL_DOT[s.level] ?? "bg-ngpa-slate"}`}
                    />
                    {s.level} {s.registered}
                  </span>
                ))}
              </span>
              <span className="ml-auto flex items-center gap-2 text-sm text-ngpa-white/70">
                <span>
                  <b className="text-ngpa-white">{total}</b> registered
                </span>
                <span aria-hidden className="text-xs">
                  {open ? "▲" : "▼"}
                </span>
              </span>
            </button>
            {open && (
              <div className="space-y-4 px-3 sm:px-4 pb-4">
                {dayRows.map((row) => renderRow(row))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
