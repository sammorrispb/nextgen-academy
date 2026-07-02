"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  validateEvalBookForm,
  EVAL_LEVELS,
  EVAL_LEVEL_HINTS,
  type EvalBookFormData,
  type EvalBookErrors,
} from "@/lib/validate-eval-book";
import { trackEvent } from "@/lib/funnelClient";

export interface DisplaySlot {
  id: string;
  date: string; // "YYYY-MM-DD"
  dateLabel: string; // "Friday, July 10, 2026"
  startTime: string; // "5:30 PM"
  endTime: string; // "6:00 PM"
  location: string;
}

type FormStatus = "idle" | "submitting" | "success" | "error";

const emptyForm: EvalBookFormData = {
  slotId: "",
  parentName: "",
  email: "",
  phone: "",
  childFirstName: "",
  level: "",
};

function groupByDate(slots: DisplaySlot[]): [string, DisplaySlot[]][] {
  const map = new Map<string, DisplaySlot[]>();
  for (const slot of slots) {
    const arr = map.get(slot.dateLabel) ?? [];
    arr.push(slot);
    map.set(slot.dateLabel, arr);
  }
  return Array.from(map.entries());
}

export default function EvalBookForm({
  initialSlots,
}: {
  initialSlots: DisplaySlot[];
}) {
  const [slots, setSlots] = useState<DisplaySlot[]>(initialSlots);
  const [form, setForm] = useState<EvalBookFormData>(emptyForm);
  const [errors, setErrors] = useState<EvalBookErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const [bookedSlot, setBookedSlot] = useState<DisplaySlot | null>(null);
  const startedFiredRef = useRef(false);

  type Field = keyof EvalBookFormData;

  function updateField(field: Field, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (!startedFiredRef.current && value) {
      startedFiredRef.current = true;
      trackEvent("eval_book_started", {
        interest: "free_evaluation",
        page: window.location.pathname,
      });
    }
  }

  function handleBlur(field: Field) {
    const fieldErrors = validateEvalBookForm(form);
    if (fieldErrors[field]) {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
    }
  }

  async function refetchSlots() {
    try {
      const res = await fetch("/api/eval-book");
      if (!res.ok) return;
      const data = (await res.json()) as { slots?: DisplaySlot[] };
      setSlots(data.slots ?? []);
    } catch {
      // Keep the stale list — the claim-then-verify server path stays safe.
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const allErrors = validateEvalBookForm(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const first = Object.keys(allErrors)[0];
      document.getElementById(first === "slotId" ? "slot-picker" : first)?.focus();
      return;
    }

    setStatus("submitting");
    const selected = slots.find((s) => s.id === form.slotId) ?? null;

    try {
      const res = await fetch("/api/eval-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // Slot just taken — clear the pick and refetch fresh open slots.
          setForm((prev) => ({ ...prev, slotId: "" }));
          setServerError(
            data.error ||
              "That time was just booked by another family. Pick another open time below.",
          );
          setStatus("error");
          await refetchSlots();
          return;
        }
        if (data.errors) {
          setErrors(data.errors);
          setStatus("error");
          return;
        }
        throw new Error(data.error || "Something went wrong");
      }
      setBookedSlot(selected);
      setStatus("success");
      trackEvent("eval_book_submitted", {
        interest: "free_evaluation",
        page: window.location.pathname,
      });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-ngpa-panel/80 backdrop-blur rounded-2xl p-8 sm:p-10 border border-ngpa-slate/60 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ngpa-green/15 mb-6">
          <svg
            className="w-8 h-8 text-ngpa-green"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white mb-3 tracking-tight">
          You&rsquo;re booked!
        </h3>
        {bookedSlot && (
          <p className="text-ngpa-white text-lg mb-2 font-bold">
            {bookedSlot.dateLabel} &middot; {bookedSlot.startTime}&ndash;
            {bookedSlot.endTime} &middot; {bookedSlot.location}
          </p>
        )}
        <p className="text-ngpa-white/75 text-lg mb-6 max-w-md mx-auto">
          A confirmation with a calendar invite is on its way to your inbox.
          Wear athletic clothes and court shoes — paddles are on us.
        </p>
        <Link
          href="/schedule"
          className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
        >
          See upcoming sessions
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
  const selectClass = `${inputClass} appearance-none cursor-pointer`;
  const labelClass =
    "block font-heading text-sm font-bold text-ngpa-white mb-1.5";
  const hintClass = "block text-xs text-ngpa-white/55 mb-1.5";
  const errorClass = "text-ngpa-red text-sm mt-1.5";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20"
    >
      {serverError && (
        <div className="bg-ngpa-red/10 border border-ngpa-red/30 rounded-lg p-4 mb-6">
          <p className="text-ngpa-red text-sm font-medium">{serverError}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* ── Slot picker ── */}
        <div id="slot-picker" tabIndex={-1} className="focus:outline-none">
          <label className={labelClass}>Pick a time</label>
          <span className={hintClass}>
            All evaluations are 30 minutes, one-on-one with a coach.
          </span>
          <div className="space-y-4 mt-2">
            {groupByDate(slots).map(([dateLabel, daySlots]) => (
              <div key={dateLabel}>
                <p className="text-ngpa-white/70 text-sm font-bold mb-2">
                  {dateLabel}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {daySlots.map((slot) => {
                    const active = form.slotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => updateField("slotId", slot.id)}
                        aria-pressed={active}
                        className={`min-h-[48px] rounded-xl border px-4 py-3 text-left transition-colors ${
                          active
                            ? "bg-ngpa-teal text-ngpa-deep border-ngpa-teal"
                            : "bg-ngpa-deep/60 text-ngpa-white border-ngpa-slate/60 hover:border-ngpa-teal/60"
                        }`}
                      >
                        <span className="block text-sm font-bold">
                          {slot.startTime}&ndash;{slot.endTime}
                        </span>
                        <span
                          className={`block text-xs mt-0.5 ${active ? "text-ngpa-deep/80" : "text-ngpa-white/60"}`}
                        >
                          {slot.location}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {errors.slotId && <p className={errorClass}>{errors.slotId}</p>}
        </div>

        {/* ── Contact + child ── */}
        <div>
          <label htmlFor="parentName" className={labelClass}>
            Your Name
          </label>
          <input
            id="parentName"
            type="text"
            autoComplete="name"
            className={inputClass}
            placeholder="First and last name"
            value={form.parentName}
            onChange={(e) => updateField("parentName", e.target.value)}
            onBlur={() => handleBlur("parentName")}
          />
          {errors.parentName && <p className={errorClass}>{errors.parentName}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputClass}
              placeholder="you@email.com"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              onBlur={() => handleBlur("email")}
            />
            {errors.email && <p className={errorClass}>{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              className={inputClass}
              placeholder="301-555-0142"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              onBlur={() => handleBlur("phone")}
            />
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="childFirstName" className={labelClass}>
              Kid&rsquo;s First Name
            </label>
            <input
              id="childFirstName"
              type="text"
              className={inputClass}
              placeholder="First name only"
              value={form.childFirstName}
              onChange={(e) => updateField("childFirstName", e.target.value)}
              onBlur={() => handleBlur("childFirstName")}
            />
            {errors.childFirstName && (
              <p className={errorClass}>{errors.childFirstName}</p>
            )}
          </div>

          <div>
            <label htmlFor="level" className={labelClass}>
              Level
            </label>
            <select
              id="level"
              className={selectClass}
              value={form.level}
              onChange={(e) => updateField("level", e.target.value)}
              onBlur={() => handleBlur("level")}
            >
              <option value="">Select level</option>
              {EVAL_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl} — {EVAL_LEVEL_HINTS[lvl]}
                </option>
              ))}
            </select>
            {errors.level && <p className={errorClass}>{errors.level}</p>}
          </div>
        </div>
        <span className={hintClass}>
          Not sure on level? Pick what&rsquo;s closest — the eval is where we
          figure that out together.
        </span>
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-7 w-full px-8 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
      >
        {status === "submitting" ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Booking...
          </span>
        ) : (
          "Book my free evaluation"
        )}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        We&rsquo;ll only use this to run your kid&rsquo;s evaluation. No spam.
      </p>
    </form>
  );
}
