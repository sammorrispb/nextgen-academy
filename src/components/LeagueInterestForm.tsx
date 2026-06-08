"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  validateLeagueInterestForm,
  LEAGUE_LEVELS,
  type LeagueInterestFormData,
  type LeagueInterestErrors,
} from "@/lib/validate-league-interest";
import { LEAGUE_BANDS, LEAGUE_AGE_MIN, LEAGUE_AGE_MAX } from "@/data/leagues";
import { trackEvent, getVisitorIdForForm, getUtm } from "@/lib/funnelClient";

const AGE_OPTIONS = Array.from(
  { length: LEAGUE_AGE_MAX - LEAGUE_AGE_MIN + 1 },
  (_, i) => LEAGUE_AGE_MIN + i,
);

const LEVEL_HINTS: Record<(typeof LEAGUE_LEVELS)[number], string> = {
  Red: "First time on a court",
  Orange: "Rallies a bit, still learning",
  Green: "Rallies well, knows the rules",
  Yellow: "Competitive / tournament-track",
};

type FormStatus = "idle" | "submitting" | "success" | "error";

const emptyForm: LeagueInterestFormData = {
  parentName: "",
  email: "",
  phone: "",
  childFirstName: "",
  childAge: "",
  preferredBand: "",
  childLevel: "",
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
};

interface LeagueInterestFormProps {
  submitLabel?: string;
  source?: "Newsletter" | "Web" | "Other";
}

export default function LeagueInterestForm({
  submitLabel = "Save my spot on the list →",
  source = "Web",
}: LeagueInterestFormProps = {}) {
  const [form, setForm] = useState<LeagueInterestFormData>(emptyForm);
  const [errors, setErrors] = useState<LeagueInterestErrors>({});
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
    };
  }, [source]);

  type SimpleField =
    | "parentName"
    | "email"
    | "phone"
    | "childFirstName"
    | "childAge"
    | "preferredBand"
    | "childLevel"
    | "notes";

  function updateField(field: SimpleField, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Convenience: when the age is picked and no band chosen yet, suggest the
      // band the age falls into. The parent can still override.
      if (field === "childAge" && value && !prev.preferredBand) {
        const age = Number(value);
        const suggested = LEAGUE_BANDS.find(
          (b) => age >= b.minAge && age <= b.maxAge,
        );
        if (suggested) next.preferredBand = suggested.band;
      }
      return next;
    });
    if (errors[field as keyof LeagueInterestErrors]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field as keyof LeagueInterestErrors];
        return copy;
      });
    }
    if (!startedFiredRef.current && value) {
      startedFiredRef.current = true;
      trackEvent("league_interest_started", {
        interest: "league_interest",
        page: window.location.pathname,
      });
    }
  }

  function handleBlur(field: SimpleField) {
    const fieldErrors = validateLeagueInterestForm(form);
    if (fieldErrors[field as keyof LeagueInterestErrors]) {
      setErrors((prev) => ({
        ...prev,
        [field]: fieldErrors[field as keyof LeagueInterestErrors],
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const allErrors = validateLeagueInterestForm(form);
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
      const res = await fetch("/api/league-interest", {
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
      trackEvent("league_interest_submitted", {
        interest: "league_interest",
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
          You&rsquo;re on the list, {form.parentName.split(" ")[0]}.
        </h3>
        <p className="text-ngpa-white/75 text-lg mb-6 max-w-md mx-auto">
          We&rsquo;ll email you the moment a {form.preferredBand} season near you
          is confirmed. Check your inbox for the details.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
          >
            Play a drop-in meanwhile
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
              Phone{" "}
              <span className="text-ngpa-white/50 font-normal">(optional)</span>
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
            {errors.childAge && <p className={errorClass}>{errors.childAge}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="preferredBand" className={labelClass}>
            Age division
          </label>
          <span className={hintClass}>
            Kids play in their age band &mdash; we&rsquo;ll confirm the right fit.
          </span>
          <select
            id="preferredBand"
            className={selectClass}
            value={form.preferredBand}
            onChange={(e) => updateField("preferredBand", e.target.value)}
            onBlur={() => handleBlur("preferredBand")}
          >
            <option value="">Select division</option>
            {LEAGUE_BANDS.map((b) => (
              <option key={b.band} value={b.band}>
                {b.label} — ages {b.minAge}–{b.maxAge}
              </option>
            ))}
          </select>
          {errors.preferredBand && (
            <p className={errorClass}>{errors.preferredBand}</p>
          )}
        </div>

        <div>
          <label htmlFor="childLevel" className={labelClass}>
            Level{" "}
            <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <span className={hintClass}>
            Not sure? Leave it blank &mdash; we&rsquo;ll level on the court.
          </span>
          <select
            id="childLevel"
            className={selectClass}
            value={form.childLevel}
            onChange={(e) => updateField("childLevel", e.target.value)}
            onBlur={() => handleBlur("childLevel")}
          >
            <option value="">Select level</option>
            {LEAGUE_LEVELS.map((lvl) => (
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
          <label htmlFor="notes" className={labelClass}>
            Anything else?{" "}
            <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={2}
            className={inputClass}
            placeholder="Preferred days, location, what you're hoping your kid gets out of a season…"
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
            Sending...
          </span>
        ) : (
          submitLabel
        )}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        No commitment yet &mdash; this just tells us where the demand is. No spam.
      </p>
    </form>
  );
}
