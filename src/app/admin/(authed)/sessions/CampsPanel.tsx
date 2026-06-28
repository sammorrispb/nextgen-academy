"use client";

import { useState } from "react";
import type { AdminCampCamper } from "@/lib/admin-camp-roster";

export interface CampSummary {
  slug: string;
  title: string;
  weekLabel: string;
}

interface CampPanel {
  open: boolean;
  loading?: boolean;
  err?: string;
  loaded?: boolean;
  campers?: AdminCampCamper[];
}

type RefundMode = "full" | "none" | "partial";

interface CancelState {
  open?: boolean;
  mode?: RefundMode;
  amount?: string;
  busy?: boolean;
  msg?: string;
  err?: boolean;
}

function prettyDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function CampsPanel({ camps }: { camps: CampSummary[] }) {
  const [panels, setPanels] = useState<Record<string, CampPanel>>({});
  const [cancel, setCancel] = useState<Record<string, CancelState>>({});

  function setCancelState(id: string, patch: Partial<CancelState>) {
    setCancel((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
  }

  async function toggleCamp(slug: string) {
    const cur = panels[slug];
    if (cur?.open) {
      setPanels((m) => ({ ...m, [slug]: { ...cur, open: false } }));
      return;
    }
    if (cur?.loaded) {
      setPanels((m) => ({ ...m, [slug]: { ...cur, open: true } }));
      return;
    }
    setPanels((m) => ({ ...m, [slug]: { open: true, loading: true } }));
    try {
      const res = await fetch(`/api/admin/sessions/camps?slug=${encodeURIComponent(slug)}`);
      const j = await res.json().catch(() => ({}));
      const camp = Array.isArray(j.camps) ? j.camps.find((c: { slug: string }) => c.slug === slug) : null;
      if (res.ok && camp) {
        setPanels((m) => ({
          ...m,
          [slug]: { open: true, loaded: true, campers: camp.campers ?? [], err: camp.error ? "Couldn’t reach Stripe for this camp." : undefined },
        }));
      } else {
        setPanels((m) => ({ ...m, [slug]: { open: true, err: j.error || "Failed to load roster" } }));
      }
    } catch {
      setPanels((m) => ({ ...m, [slug]: { open: true, err: "Network error" } }));
    }
  }

  async function doCancel(slug: string, camper: AdminCampCamper) {
    const id = camper.stripeSessionId;
    const c = cancel[id] || {};
    const mode: RefundMode = c.mode ?? "full";
    let amountCents: number | undefined;
    if (mode === "partial") {
      const dollars = Number(c.amount);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        setCancelState(id, { msg: "Enter a refund amount.", err: true });
        return;
      }
      amountCents = Math.round(dollars * 100);
    }
    setCancelState(id, { busy: true, msg: undefined, err: false });
    try {
      const res = await fetch("/api/admin/sessions/camps/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutSessionId: id, refund: mode, amountCents }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        // Drop the camper — collectPaidCampSessions excludes refunded sessions,
        // so a refetch would no longer return them anyway.
        setPanels((m) => {
          const p = m[slug];
          if (!p?.campers) return m;
          return { ...m, [slug]: { ...p, campers: p.campers.filter((x) => x.stripeSessionId !== id) } };
        });
        setCancelState(id, { busy: false, open: false, msg: undefined });
      } else {
        setCancelState(id, { busy: false, msg: j.error || "Cancel failed", err: true });
      }
    } catch {
      setCancelState(id, { busy: false, msg: "Network error", err: true });
    }
  }

  const inputCls =
    "w-full rounded-lg bg-ngpa-deep border border-ngpa-slate/60 px-3 py-2 text-sm text-ngpa-white outline-none focus:border-ngpa-teal";

  return (
    <div className="space-y-3">
      {camps.map((camp) => {
        const p = panels[camp.slug] || { open: false };
        return (
          <div key={camp.slug} className="rounded-2xl border border-ngpa-slate/50 bg-ngpa-panel/30">
            <button
              onClick={() => toggleCamp(camp.slug)}
              aria-expanded={p.open}
              className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-5 py-3 text-left min-h-12"
            >
              <span className="font-heading font-black text-ngpa-teal">{camp.title}</span>
              <span className="text-[11px] text-ngpa-white/45">{camp.weekLabel}</span>
              <span className="ml-auto flex items-center gap-2 text-sm text-ngpa-white/70">
                {p.loaded && (
                  <span>
                    <b className="text-ngpa-white">{p.campers?.length ?? 0}</b> registered
                  </span>
                )}
                <span aria-hidden className="text-xs">
                  {p.open ? "▲" : "▼"}
                </span>
              </span>
            </button>

            {p.open && (
              <div className="px-3 sm:px-4 pb-4">
                <div className="rounded-xl border border-ngpa-slate/50 bg-ngpa-deep/60 p-3 sm:p-4">
                  {p.loading && <p className="text-sm text-ngpa-white/60">Loading roster…</p>}
                  {p.err && <p className="text-sm text-amber-300">{p.err}</p>}
                  {p.loaded && !p.err && (p.campers?.length ?? 0) === 0 && (
                    <p className="text-sm text-ngpa-white/60">No camp registrations yet.</p>
                  )}
                  {p.campers && p.campers.length > 0 && (
                    <ul className="divide-y divide-ngpa-slate/40">
                      {p.campers.map((r) => {
                        const c = cancel[r.stripeSessionId] || {};
                        const mode: RefundMode = c.mode ?? "full";
                        return (
                          <li key={r.stripeSessionId} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                              <b className="text-ngpa-white">{r.childFirstName || "—"}</b>
                              {r.childBirthYear ? (
                                <span className="text-ngpa-white/50 text-xs">b. {r.childBirthYear}</span>
                              ) : null}
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-ngpa-slate/60 text-ngpa-white/70">
                                {r.optionLabel || r.optionKey}
                                {r.optionKey === "day" && r.selectedDay ? ` · ${prettyDate(r.selectedDay)}` : ""}
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
                              <button
                                onClick={() => setCancelState(r.stripeSessionId, { open: !c.open, msg: undefined, err: false })}
                                className="ml-auto min-h-12 text-red-300 font-bold hover:text-red-200 transition-colors"
                              >
                                {c.open ? "Close" : "Cancel / refund"}
                              </button>
                            </div>

                            {c.open && (
                              <div className="mt-2 rounded-lg border border-red-400/30 bg-red-400/5 p-3">
                                <p className="text-[11px] text-red-300/90 mb-2">
                                  Refunds via Stripe and emails the parent a cancellation. Removes the camper from the roster.
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    className={`${inputCls} max-w-[10rem]`}
                                    value={mode}
                                    onChange={(e) => setCancelState(r.stripeSessionId, { mode: e.target.value as RefundMode })}
                                  >
                                    <option value="full">Full refund</option>
                                    <option value="none">No refund</option>
                                    <option value="partial">Custom amount</option>
                                  </select>
                                  {mode === "partial" && (
                                    <input
                                      className={`${inputCls} max-w-[7rem]`}
                                      inputMode="decimal"
                                      placeholder="$ amount"
                                      value={c.amount ?? ""}
                                      onChange={(e) => setCancelState(r.stripeSessionId, { amount: e.target.value })}
                                    />
                                  )}
                                  <button
                                    onClick={() => doCancel(camp.slug, r)}
                                    disabled={c.busy}
                                    className="rounded-full bg-red-500 text-white font-black px-4 py-2 text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
                                  >
                                    {c.busy ? "Cancelling…" : "Confirm"}
                                  </button>
                                  {c.msg && (
                                    <span className={`text-sm ${c.err ? "text-red-400" : "text-emerald-300"}`}>{c.msg}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
