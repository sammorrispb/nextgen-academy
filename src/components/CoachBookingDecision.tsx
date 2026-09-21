"use client";

import { useState } from "react";
import { BOOKING_TIME_OPTIONS } from "@/lib/lesson-booking-token";

interface SlotOption {
  date: string;
  time: string;
  label: string;
}

function todayIsoET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export default function CoachBookingDecision({
  token,
  slots,
}: {
  token: string;
  slots: SlotOption[];
}) {
  const [mode, setMode] = useState<"confirm" | "counter">("confirm");
  const [slotIndex, setSlotIndex] = useState(0);
  const [counterDate, setCounterDate] = useState("");
  const [counterTime, setCounterTime] = useState("5:30 PM");
  const [counterNote, setCounterNote] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const today = todayIsoET();
  const minDate = addDaysIso(today, 1);
  const maxDate = addDaysIso(today, 60);

  async function post(url: string, body: Record<string, unknown>) {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function doConfirm() {
    const data = await post("/api/lesson-booking-confirm", { slotIndex });
    if (data) setResult(`Confirmed for ${slots[slotIndex].label}. The parent got a confirmation email with a calendar invite.`);
  }

  async function doCounter() {
    if (!counterDate) {
      setError("Pick a date for your counter-offer.");
      return;
    }
    const data = await post("/api/lesson-booking-counter", {
      date: counterDate,
      time: counterTime,
      note: counterNote,
    });
    if (data) setResult(`Counter-offer sent: ${data.date} at ${data.time}. The parent got accept/decline links — you'll hear back here.`);
  }

  if (result) {
    return (
      <div className="rounded-2xl bg-ngpa-teal/10 ring-1 ring-ngpa-teal/30 p-8 text-center">
        <h2 className="font-heading text-2xl font-black text-ngpa-white">Done.</h2>
        <p className="mt-3 text-ngpa-white/75">{result}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex rounded-full bg-ngpa-white/5 ring-1 ring-ngpa-white/15 p-1 mb-6">
        {(["confirm", "counter"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full py-2.5 text-sm font-bold transition ${
              mode === m ? "bg-ngpa-teal text-ngpa-deep" : "text-ngpa-white/70 hover:text-ngpa-white"
            }`}
          >
            {m === "confirm" ? "Confirm a time" : "Counter with another time"}
          </button>
        ))}
      </div>

      {mode === "confirm" ? (
        <div className="space-y-3">
          {slots.map((s, i) => (
            <label
              key={s.date + s.time}
              className={`flex items-center gap-3 rounded-xl p-4 ring-1 cursor-pointer transition ${
                slotIndex === i
                  ? "bg-ngpa-teal/15 ring-ngpa-teal"
                  : "bg-ngpa-white/5 ring-ngpa-white/10 hover:bg-ngpa-white/10"
              }`}
            >
              <input
                type="radio"
                name="slot"
                checked={slotIndex === i}
                onChange={() => setSlotIndex(i)}
                className="accent-teal-400 w-5 h-5"
              />
              <span className="text-ngpa-white font-semibold">
                <span className="text-ngpa-white/50 text-sm mr-2">Option {i + 1}</span>
                {s.label}
              </span>
            </label>
          ))}
          <button
            type="button"
            onClick={doConfirm}
            disabled={working}
            className="w-full mt-2 rounded-full bg-ngpa-teal px-8 py-4 font-bold text-ngpa-deep text-lg disabled:opacity-40 hover:bg-ngpa-teal/90"
          >
            {working ? "Confirming…" : `Confirm ${slots[slotIndex]?.label ?? ""}`}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-ngpa-white/80">Date</span>
              <input
                type="date"
                value={counterDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setCounterDate(e.target.value)}
                className="mt-1 w-full rounded-xl bg-ngpa-white/5 ring-1 ring-ngpa-white/15 px-4 py-3 text-ngpa-white focus:outline-none focus:ring-ngpa-teal"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ngpa-white/80">Start time</span>
              <select
                value={counterTime}
                onChange={(e) => setCounterTime(e.target.value)}
                className="mt-1 w-full rounded-xl bg-ngpa-deep ring-1 ring-ngpa-white/15 px-4 py-3 text-ngpa-white font-semibold focus:outline-none focus:ring-ngpa-teal"
              >
                {BOOKING_TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-ngpa-white/80">
              Note for the parent <span className="text-ngpa-white/40">(optional)</span>
            </span>
            <textarea
              value={counterNote}
              onChange={(e) => setCounterNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. I'm at WJ until 6 — can do 6:30 if that works better"
              className="mt-1 w-full rounded-xl bg-ngpa-white/5 ring-1 ring-ngpa-white/15 px-4 py-3 text-ngpa-white placeholder:text-ngpa-white/30 focus:outline-none focus:ring-ngpa-teal"
            />
          </label>
          <button
            type="button"
            onClick={doCounter}
            disabled={working || !counterDate}
            className="w-full rounded-full bg-ngpa-teal px-8 py-4 font-bold text-ngpa-deep text-lg disabled:opacity-40 hover:bg-ngpa-teal/90"
          >
            {working ? "Sending…" : "Send counter-offer"}
          </button>
          <p className="text-sm text-ngpa-white/50 text-center">
            The parent gets accept / decline links. You&apos;ll be emailed either way.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm font-semibold text-red-300" role="alert">{error}</p>
      )}
    </div>
  );
}
