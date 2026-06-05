"use client";

import { useState, useTransition } from "react";
import { confirmEvalAction, type ConfirmEvalInput } from "./actions";

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-ngpa-deep border border-ngpa-slate/60 text-ngpa-white text-sm placeholder:text-ngpa-white/30 focus:outline-none focus:border-ngpa-teal";
const labelClass = "block text-xs font-bold text-ngpa-white/80 mb-1.5";

// Add 45 minutes to a "HH:MM" 24h string for a sensible default end time.
function plus45(hhmm: string): string {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return "";
  const total = (parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + 45) % (24 * 60);
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export default function ConfirmEvalForm() {
  const [parentFirst, setParentFirst] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [childFirst, setChildFirst] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:45");
  const [endTouched, setEndTouched] = useState(false);
  const [location, setLocation] = useState("");
  const [coachName, setCoachName] = useState("");

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  function payload(): ConfirmEvalInput {
    return {
      parentEmail: parentEmail.trim(),
      parentFirst: parentFirst.trim() || undefined,
      childFirst: childFirst.trim(),
      date,
      startTime,
      endTime,
      location: location.trim(),
      coachName: coachName.trim() || undefined,
    };
  }

  function run(dryRun: boolean) {
    startTransition(async () => {
      setError(null);
      if (!dryRun) setPreview(null);
      const r = await confirmEvalAction(payload(), { dryRun });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      if (dryRun) {
        setPreview(r.preview ?? "");
        setSent(null);
      } else {
        setSent(r.message);
        setPreview(null);
      }
    });
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-ngpa-skill-green/50 bg-ngpa-skill-green/10 p-5 max-w-2xl">
        <p className="font-bold text-ngpa-skill-green">{sent}</p>
        <button
          type="button"
          onClick={() => {
            setSent(null);
            setChildFirst("");
            setParentEmail("");
            setParentFirst("");
            setDate("");
            setLocation("");
          }}
          className="mt-4 px-4 py-2 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-bold transition-colors"
        >
          Confirm another eval
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Parent first name</label>
          <input
            className={inputClass}
            value={parentFirst}
            onChange={(e) => setParentFirst(e.target.value)}
            placeholder="Hun"
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Parent email *</label>
          <input
            className={inputClass}
            type="email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            placeholder="parent@example.com"
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Child first name *</label>
          <input
            className={inputClass}
            value={childFirst}
            onChange={(e) => setChildFirst(e.target.value)}
            placeholder="Zoe"
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Coach (optional)</label>
          <input
            className={inputClass}
            value={coachName}
            onChange={(e) => setCoachName(e.target.value)}
            placeholder="Coach Sam"
            disabled={pending}
          />
        </div>
        <div>
          <label className={labelClass}>Date *</label>
          <input
            className={inputClass}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Start *</label>
            <input
              className={inputClass}
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                if (!endTouched) setEndTime(plus45(e.target.value));
              }}
              disabled={pending}
            />
          </div>
          <div>
            <label className={labelClass}>End *</label>
            <input
              className={inputClass}
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setEndTouched(true);
              }}
              disabled={pending}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Location *</label>
          <input
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="East Norbeck Local Park, 3131 Norbeck Rd, Silver Spring, MD 20906"
            disabled={pending}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button
          type="button"
          onClick={() => run(true)}
          disabled={pending}
          className="px-5 py-2.5 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal font-bold text-sm disabled:opacity-60 transition-colors min-h-[40px]"
        >
          {pending ? "Working…" : "Preview"}
        </button>
        <button
          type="button"
          onClick={() => run(false)}
          disabled={pending}
          className="px-5 py-2.5 rounded-full bg-ngpa-teal text-ngpa-deep font-bold text-sm hover:brightness-110 disabled:opacity-60 transition-all min-h-[40px]"
        >
          {pending ? "Sending…" : "Send confirmation"}
        </button>
        {error && <span className="text-red-400 text-xs break-words">{error}</span>}
      </div>

      {preview && (
        <div className="mt-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal mb-2">
            Preview — not sent
          </p>
          <pre className="whitespace-pre-wrap text-sm text-ngpa-white/85 font-body leading-relaxed">
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
}
