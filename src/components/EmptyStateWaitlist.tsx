"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/funnelClient";

const AREAS = [
  "Anywhere in MoCo",
  "Rockville",
  "North Bethesda",
  "Bethesda",
  "Potomac",
  "Chevy Chase",
  "Kensington",
  "Silver Spring",
  "Gaithersburg",
  "Derwood",
  "Aspen Hill",
  "Olney",
  "Sandy Spring",
];

interface EmptyStateWaitlistProps {
  /** Optional heading override. Default: "No sessions open right now." */
  heading?: string;
  /** Optional source label for analytics. */
  source?: string;
}

type Status = "idle" | "submitting" | "success" | "error";

export default function EmptyStateWaitlist({
  heading = "No sessions open right now.",
  source = "schedule_empty",
}: EmptyStateWaitlistProps) {
  const [parentName, setParentName] = useState("");
  const [contact, setContact] = useState("");
  const [preferredArea, setPreferredArea] = useState("Anywhere in MoCo");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setServerError("");
    setErrors({});

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName,
          contact,
          preferredArea,
          marketingOptIn,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Something went wrong");
        setStatus("error");
        return;
      }
      trackEvent("waitlist_submitted", {
        preferredArea,
        marketingOptIn,
        source,
      });
      setStatus("success");
    } catch {
      setServerError("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-teal/40 p-6 sm:p-7 text-center">
        <h3 className="font-heading text-xl font-black text-ngpa-white mb-2 tracking-tight">
          You&rsquo;re on the list, {parentName.split(" ")[0]}.
        </h3>
        <p className="text-base text-ngpa-white/80 leading-relaxed">
          We&rsquo;ll email you the day new sessions open in{" "}
          <span className="font-bold text-ngpa-teal">{preferredArea}</span>.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
  const labelClass =
    "block font-heading text-xs font-bold text-ngpa-white/80 mb-1.5";
  const errorClass = "text-red-400 text-xs mt-1";

  return (
    <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7">
      <h3 className="font-heading text-lg sm:text-xl font-black text-ngpa-white mb-2 tracking-tight text-center">
        {heading}
      </h3>
      <p className="text-sm text-ngpa-white/70 mb-5 text-center">
        New sessions post 30 days ahead. Add yourself to the waitlist and
        we&rsquo;ll email you the day spots open near you.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="wl-parentName" className={labelClass}>
            Your name
          </label>
          <input
            id="wl-parentName"
            type="text"
            autoComplete="name"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            placeholder="First and last name"
            className={inputClass}
            required
          />
          {errors.parentName && (
            <p className={errorClass}>{errors.parentName}</p>
          )}
        </div>
        <div>
          <label htmlFor="wl-contact" className={labelClass}>
            Email or phone
          </label>
          <input
            id="wl-contact"
            type="text"
            autoComplete="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="you@email.com or (301) 555-1234"
            className={inputClass}
            required
          />
          {errors.contact && <p className={errorClass}>{errors.contact}</p>}
        </div>
        <div>
          <label htmlFor="wl-area" className={labelClass}>
            Preferred area
          </label>
          <select
            id="wl-area"
            value={preferredArea}
            onChange={(e) => setPreferredArea(e.target.value)}
            className={`${inputClass} appearance-none cursor-pointer`}
            required
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          {errors.preferredArea && (
            <p className={errorClass}>{errors.preferredArea}</p>
          )}
        </div>
        <label className="flex items-start gap-2.5 text-xs text-ngpa-white/70 cursor-pointer">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-0.5 accent-ngpa-teal w-4 h-4 shrink-0"
          />
          <span>
            Also email me occasional updates about NGA programs (optional &mdash;
            you&rsquo;ll always be notified about waitlist matches).
          </span>
        </label>
        {serverError && (
          <p className="text-sm text-red-400 text-center">{serverError}</p>
        )}
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full px-6 py-3.5 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-base rounded-full hover:bg-ngpa-teal-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-ngpa-teal/20 min-h-[48px]"
        >
          {status === "submitting" ? "Adding you..." : "Add me to the waitlist"}
        </button>
      </form>
    </div>
  );
}
