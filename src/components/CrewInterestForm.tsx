"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  validateCrewInterestForm,
  CREW_DAYS,
  CREW_LEVELS,
  CREW_SUB_LEVELS,
  CREW_SUB_LEVEL_HINTS,
  CREW_TIMES_OF_DAY,
  type CrewInterestFormData,
  type CrewInterestErrors,
  type CrewDay,
  type CrewTimeOfDay,
} from "@/lib/validate-crew-interest";
import { trackEvent, getVisitorIdForForm, getUtm } from "@/lib/funnelClient";

const AGE_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 6);

const LEVEL_HINTS: Record<(typeof CREW_LEVELS)[number], string> = {
  Red: "First time on a court",
  Orange: "Rallies a bit, still learning",
  Green: "Rallies well, knows the rules",
  Yellow: "Competitive / tournament-track",
};

type FormStatus = "idle" | "submitting" | "success" | "error";

const emptyForm: CrewInterestFormData = {
  parentName: "",
  email: "",
  phone: "",
  childFirstName: "",
  childAge: "",
  childLevel: "",
  childSubLevel: "",
  preferredDays: [],
  preferredTimeOfDay: [],
  preferredTime: "",
  preferredLocation: "",
  friendsWanted: "",
  notes: "",
};

type TrackingContext = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
  source?: "Newsletter" | "Web" | "Other";
  cluster?: string;
};

interface CrewInterestFormProps {
  submitLabel?: string;
  /** Where the submission came from — annotates the Notion row. */
  source?: "Newsletter" | "Web" | "Other";
}

export default function CrewInterestForm({
  submitLabel = "Tell us what works →",
  source = "Web",
}: CrewInterestFormProps = {}) {
  const [form, setForm] = useState<CrewInterestFormData>(emptyForm);
  const [errors, setErrors] = useState<CrewInterestErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const trackingRef = useRef<TrackingContext>({});
  const startedFiredRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stashed = getUtm();
    trackingRef.current = {
      utm_source: params.get("utm_source") ?? stashed.utm_source ?? undefined,
      utm_medium: params.get("utm_medium") ?? stashed.utm_medium ?? undefined,
      utm_campaign:
        params.get("utm_campaign") ?? stashed.utm_campaign ?? undefined,
      utm_content: params.get("utm_content") ?? undefined,
      utm_term: params.get("utm_term") ?? undefined,
      referrer: document.referrer || undefined,
      landing_page: window.location.href,
      source,
      cluster: params.get("cluster") ?? undefined,
    };
  }, [source]);

  type SimpleField =
    | "parentName"
    | "email"
    | "phone"
    | "childFirstName"
    | "childAge"
    | "childLevel"
    | "childSubLevel"
    | "preferredTime"
    | "preferredLocation"
    | "friendsWanted"
    | "notes";

  function updateField(field: SimpleField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof CrewInterestErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof CrewInterestErrors];
        return next;
      });
    }
    if (!startedFiredRef.current && value) {
      startedFiredRef.current = true;
      trackEvent("crew_interest_started", {
        interest: "crew_interest",
        page: window.location.pathname,
      });
    }
  }

  function toggleDay(day: CrewDay) {
    setForm((prev) => {
      const next = prev.preferredDays.includes(day)
        ? prev.preferredDays.filter((d) => d !== day)
        : [...prev.preferredDays, day];
      return { ...prev, preferredDays: next };
    });
    if (errors.preferredDays) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.preferredDays;
        return next;
      });
    }
  }

  function toggleTimeOfDay(t: CrewTimeOfDay) {
    setForm((prev) => {
      const next = prev.preferredTimeOfDay.includes(t)
        ? prev.preferredTimeOfDay.filter((x) => x !== t)
        : [...prev.preferredTimeOfDay, t];
      return { ...prev, preferredTimeOfDay: next };
    });
    if (errors.preferredTimeOfDay) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.preferredTimeOfDay;
        return next;
      });
    }
  }

  function handleBlur(field: SimpleField) {
    const fieldErrors = validateCrewInterestForm(form);
    if (fieldErrors[field as keyof CrewInterestErrors]) {
      setErrors((prev) => ({
        ...prev,
        [field]: fieldErrors[field as keyof CrewInterestErrors],
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const allErrors = validateCrewInterestForm(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const firstErrorField = Object.keys(allErrors)[0];
      document.getElementById(firstErrorField)?.focus();
      return;
    }

    setStatus("submitting");

    const tracking: TrackingContext = { ...trackingRef.current };
    const payload = {
      ...form,
      ...tracking,
      visitor_id: getVisitorIdForForm() || null,
    };

    try {
      const res = await fetch("/api/crew-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
          setStatus("error");
          return;
        }
        throw new Error(data.error || "Something went wrong");
      }
      setStatus("success");
      trackEvent("crew_interest_submitted", {
        interest: "crew_interest",
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white mb-3 tracking-tight">
          Got it, {form.parentName.split(" ")[0]}.
        </h3>
        <p className="text-ngpa-white/75 text-lg mb-6 max-w-md mx-auto">
          We&rsquo;ll look for {form.childFirstName || "your kid"}&rsquo;s crew
          and text the WhatsApp link when the slot goes live. Check your inbox
          for the details.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
          >
            See open sessions
          </Link>
        </div>
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

      <div className="space-y-4">
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
          {errors.parentName && (
            <p className={errorClass}>{errors.parentName}</p>
          )}
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
              Phone <span className="text-ngpa-white/50 font-normal">(optional)</span>
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
            <label htmlFor="childAge" className={labelClass}>
              Age
            </label>
            <select
              id="childAge"
              className={selectClass}
              value={form.childAge}
              onChange={(e) => updateField("childAge", e.target.value)}
              onBlur={() => handleBlur("childAge")}
            >
              <option value="">Select age</option>
              {AGE_OPTIONS.map((age) => (
                <option key={age} value={String(age)}>
                  {age} years old
                </option>
              ))}
            </select>
            {errors.childAge && (
              <p className={errorClass}>{errors.childAge}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="childLevel" className={labelClass}>
            Level
          </label>
          <span className={hintClass}>
            Not sure? Pick what&rsquo;s closest — we&rsquo;ll re-level on the court.
          </span>
          <select
            id="childLevel"
            className={selectClass}
            value={form.childLevel}
            onChange={(e) => updateField("childLevel", e.target.value)}
            onBlur={() => handleBlur("childLevel")}
          >
            <option value="">Select level</option>
            {CREW_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl} — {LEVEL_HINTS[lvl]}
              </option>
            ))}
          </select>
          {errors.childLevel && (
            <p className={errorClass}>{errors.childLevel}</p>
          )}
        </div>

        <div>
          <label htmlFor="childSubLevel" className={labelClass}>
            Where in that level?{" "}
            <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <span className={hintClass}>
            Helps us pair kids of similar ability. Skip if you&rsquo;re not sure.
          </span>
          <select
            id="childSubLevel"
            className={selectClass}
            value={form.childSubLevel ?? ""}
            onChange={(e) => updateField("childSubLevel", e.target.value)}
            onBlur={() => handleBlur("childSubLevel")}
          >
            <option value="">No preference</option>
            {CREW_SUB_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl} — {CREW_SUB_LEVEL_HINTS[lvl]}
              </option>
            ))}
          </select>
          {errors.childSubLevel && (
            <p className={errorClass}>{errors.childSubLevel}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Days that work</label>
          <span className={hintClass}>
            Pick all that work. More options = faster crew formation.
          </span>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-1">
            {CREW_DAYS.map((day) => {
              const active = form.preferredDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={active}
                  className={`min-h-[48px] rounded-xl border text-sm font-bold transition-colors ${
                    active
                      ? "bg-ngpa-teal text-ngpa-deep border-ngpa-teal"
                      : "bg-ngpa-deep/60 text-ngpa-white border-ngpa-slate/60 hover:border-ngpa-teal/60"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {errors.preferredDays && (
            <p className={errorClass}>{errors.preferredDays}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Time of day</label>
          <span className={hintClass}>
            Pick all that work — this is how we match crews to a shared slot.
          </span>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {CREW_TIMES_OF_DAY.map((t) => {
              const active = form.preferredTimeOfDay.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTimeOfDay(t)}
                  aria-pressed={active}
                  className={`min-h-[48px] rounded-xl border text-sm font-bold transition-colors ${
                    active
                      ? "bg-ngpa-teal text-ngpa-deep border-ngpa-teal"
                      : "bg-ngpa-deep/60 text-ngpa-white border-ngpa-slate/60 hover:border-ngpa-teal/60"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          {errors.preferredTimeOfDay && (
            <p className={errorClass}>{errors.preferredTimeOfDay}</p>
          )}
        </div>

        <div>
          <label htmlFor="preferredTime" className={labelClass}>
            Anything more specific?
          </label>
          <input
            id="preferredTime"
            type="text"
            className={inputClass}
            placeholder="After school · 4–6pm · weekend mornings"
            value={form.preferredTime}
            onChange={(e) => updateField("preferredTime", e.target.value)}
            onBlur={() => handleBlur("preferredTime")}
          />
          {errors.preferredTime && (
            <p className={errorClass}>{errors.preferredTime}</p>
          )}
        </div>

        <div>
          <label htmlFor="preferredLocation" className={labelClass}>
            Near where? <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <input
            id="preferredLocation"
            type="text"
            className={inputClass}
            placeholder="Bethesda · Rockville · Silver Spring"
            value={form.preferredLocation}
            onChange={(e) => updateField("preferredLocation", e.target.value)}
            onBlur={() => handleBlur("preferredLocation")}
          />
        </div>

        <div>
          <label htmlFor="friendsWanted" className={labelClass}>
            Bringing friends? <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <span className={hintClass}>
            First names + ages help us match the level. A crew of 4 is the goal.
          </span>
          <textarea
            id="friendsWanted"
            rows={2}
            className={inputClass}
            placeholder="e.g. Mia (9), Theo (10)"
            value={form.friendsWanted}
            onChange={(e) => updateField("friendsWanted", e.target.value)}
            onBlur={() => handleBlur("friendsWanted")}
          />
        </div>

        <div>
          <label htmlFor="notes" className={labelClass}>
            Anything else? <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={2}
            className={inputClass}
            placeholder="Allergies, scheduling notes, why your kid wants to play…"
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            onBlur={() => handleBlur("notes")}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-7 w-full px-8 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
      >
        {status === "submitting" ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
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
            Sending...
          </span>
        ) : (
          submitLabel
        )}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        We&rsquo;ll only use this to look for your kid&rsquo;s crew. No spam.
      </p>
    </form>
  );
}
