"use client";

import { useMemo, useRef, useState } from "react";
import { BOOKING_TIME_OPTIONS } from "@/lib/lesson-booking-token";

interface SelectedSlot {
  date: string; // "YYYY-MM-DD"
  time: string;
}

const MAX_SLOTS = 3;
const MAX_ADVANCE_DAYS = 60;

function todayIsoET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dayNum(iso: string): number {
  return Number(iso.slice(8, 10));
}

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export default function LessonBookingForm({ invoiceId }: { invoiceId: string }) {
  const requestId = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<SelectedSlot[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const bounds = useMemo(() => {
    const today = todayIsoET();
    return { min: addDaysIso(today, 1), max: addDaysIso(today, MAX_ADVANCE_DAYS), today };
  }, []);

  const view = useMemo(() => {
    const [y, m] = bounds.today.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + monthOffset, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  }, [bounds.today, monthOffset]);

  const cells = useMemo(() => {
    // Leading blanks + every day of the viewed month, as ISO strings.
    const firstWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
    const out: (string | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(
        `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      );
    }
    return out;
  }, [view]);

  const isSelectable = (iso: string) => iso >= bounds.min && iso <= bounds.max;

  const toggleDate = (iso: string) => {
    if (!isSelectable(iso)) return;
    setSelected((prev) => {
      if (prev.some((s) => s.date === iso)) {
        return prev.filter((s) => s.date !== iso);
      }
      if (prev.length >= MAX_SLOTS) return prev;
      return [...prev, { date: iso, time: "5:30 PM" }];
    });
  };

  const setTime = (date: string, time: string) => {
    setSelected((prev) => prev.map((s) => (s.date === date ? { ...s, time } : s)));
  };

  async function submit() {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/lesson-booking-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          requestId: requestId.current,
          slots: selected,
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong — try again.");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-ngpa-teal/10 ring-1 ring-ngpa-teal/30 p-8 text-center">
        <h2 className="font-heading text-2xl font-black text-ngpa-white">Request sent.</h2>
        <p className="mt-3 text-ngpa-white/75 leading-relaxed">
          A coach will confirm one of your times — or propose a different one —
          usually within a day. Watch your email.
        </p>
      </div>
    );
  }

  const canPrev = monthOffset > 0;
  const canNext = monthOffset < 2;

  return (
    <div>
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => canPrev && setMonthOffset((o) => o - 1)}
          disabled={!canPrev}
          className="rounded-full px-4 py-2 text-sm font-semibold text-ngpa-white/80 ring-1 ring-ngpa-white/20 disabled:opacity-30 hover:bg-ngpa-white/5"
        >
          ← Prev
        </button>
        <h2 className="font-heading text-lg font-bold text-ngpa-white">
          {monthLabel(view.year, view.month)}
        </h2>
        <button
          type="button"
          onClick={() => canNext && setMonthOffset((o) => o + 1)}
          disabled={!canNext}
          className="rounded-full px-4 py-2 text-sm font-semibold text-ngpa-white/80 ring-1 ring-ngpa-white/20 disabled:opacity-30 hover:bg-ngpa-white/5"
        >
          Next →
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ngpa-white/50 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`b${i}`} />;
          const selectable = isSelectable(iso);
          const order = selected.findIndex((s) => s.date === iso);
          return (
            <button
              key={iso}
              type="button"
              disabled={!selectable}
              onClick={() => toggleDate(iso)}
              aria-pressed={order >= 0}
              className={[
                "relative aspect-square rounded-xl text-sm font-semibold transition",
                order >= 0
                  ? "bg-ngpa-teal text-ngpa-deep"
                  : selectable
                    ? "bg-ngpa-white/5 text-ngpa-white hover:bg-ngpa-white/15"
                    : "text-ngpa-white/25 cursor-not-allowed",
              ].join(" ")}
            >
              {dayNum(iso)}
              {order >= 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-ngpa-white text-ngpa-deep text-[11px] font-black flex items-center justify-center">
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-ngpa-white/50">
        Tap up to {MAX_SLOTS} dates, in order of preference.
      </p>

      {/* Times for each chosen date */}
      {selected.length > 0 && (
        <div className="mt-6 space-y-3">
          {selected.map((s, i) => (
            <div
              key={s.date}
              className="flex items-center gap-3 rounded-xl bg-ngpa-white/5 ring-1 ring-ngpa-white/10 p-3"
            >
              <span className="w-6 h-6 shrink-0 rounded-full bg-ngpa-teal text-ngpa-deep text-xs font-black flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-ngpa-white font-semibold text-sm flex-1">
                {weekdayLabel(s.date)}, {s.date.slice(5).replace("-", "/")}
              </span>
              <select
                value={s.time}
                onChange={(e) => setTime(s.date, e.target.value)}
                className="rounded-lg bg-ngpa-deep text-ngpa-white text-sm font-semibold px-3 py-2 ring-1 ring-ngpa-white/20"
                aria-label={`Start time for preference ${i + 1}`}
              >
                {BOOKING_TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => toggleDate(s.date)}
                className="text-ngpa-white/40 hover:text-ngpa-white text-lg leading-none px-1"
                aria-label="Remove this date"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="block mt-6">
        <span className="text-sm font-semibold text-ngpa-white/80">
          Anything the coach should know? <span className="text-ngpa-white/40">(optional)</span>
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Court preferences, what you want to work on, scheduling constraints…"
          className="mt-2 w-full rounded-xl bg-ngpa-white/5 ring-1 ring-ngpa-white/15 px-4 py-3 text-ngpa-white placeholder:text-ngpa-white/30 focus:outline-none focus:ring-ngpa-teal"
        />
      </label>

      {error && (
        <p className="mt-4 text-sm font-semibold text-red-300" role="alert">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={selected.length === 0 || submitting}
        className="mt-6 w-full rounded-full bg-ngpa-teal px-8 py-4 font-bold text-ngpa-deep text-lg disabled:opacity-40 hover:bg-ngpa-teal/90"
      >
        {submitting ? "Sending…" : `Send request${selected.length > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
