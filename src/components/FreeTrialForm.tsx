"use client";

import { useState } from "react";
import type { FreeTrialSession } from "@/lib/courtreserve";
import type { Location } from "@/data/locations";
import type {
  FreeTrialFormData,
  ValidationErrors,
} from "@/lib/validate-free-trial";
import { validateFreeTrialForm } from "@/lib/validate-free-trial";

interface FreeTrialFormProps {
  sessions: FreeTrialSession[];
  locations: Location[];
}

const AGE_OPTIONS = [4, 5, 6, 7, 8, 9, 10];

const HOW_HEARD_OPTIONS = [
  "Facebook/Instagram Ad",
  "Friend/Referral",
  "Google Search",
  "School/Community Event",
  "Other",
];

type FormStatus = "idle" | "submitting" | "success" | "error";

const emptyForm: FreeTrialFormData = {
  parentFirstName: "",
  parentLastName: "",
  parentEmail: "",
  parentPhone: "",
  childFirstName: "",
  childLastName: "",
  childAge: "",
  location: "",
  sessionId: "",
  howHeard: "",
  notes: "",
};

export default function FreeTrialForm({
  sessions,
  locations,
}: FreeTrialFormProps) {
  const [form, setForm] = useState<FreeTrialFormData>(emptyForm);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");

  // Filter sessions by selected location
  const filteredSessions = form.location
    ? sessions.filter((s) => s.location === form.location)
    : [];

  function updateField(field: keyof FreeTrialFormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Reset session when location changes
      if (field === "location") next.sessionId = "";
      return next;
    });
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleBlur(field: keyof FreeTrialFormData) {
    const fieldErrors = validateFreeTrialForm(form);
    if (fieldErrors[field]) {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    // Validate all fields
    const allErrors = validateFreeTrialForm(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      // Focus first error field
      const firstErrorField = Object.keys(allErrors)[0];
      document.getElementById(firstErrorField)?.focus();
      return;
    }

    setStatus("submitting");

    try {
      const res = await fetch("/api/free-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

      // Fire conversion events for tracking
      if (typeof window !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (w.fbq) w.fbq("track", "Lead");
        if (w.gtag)
          w.gtag("event", "free_trial_rsvp", {
            location: form.location,
            session_id: form.sessionId,
          });
      }
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setStatus("error");
    }
  }

  // ─── Thank You State ───────────────────────────
  if (status === "success") {
    const session = sessions.find((s) => String(s.eventId) === form.sessionId);
    return (
      <div className="bg-ngpa-panel rounded-2xl p-8 sm:p-10 border border-ngpa-slate text-center">
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
        <h3 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-3">
          You&rsquo;re All Set!
        </h3>
        <p className="text-ngpa-muted text-lg mb-6 max-w-md mx-auto">
          Check your email for confirmation and next steps. We can&rsquo;t wait
          to meet{" "}
          <span className="text-ngpa-lime font-semibold">
            {form.childFirstName}
          </span>{" "}
          on the court!
        </p>
        {session && (
          <div className="bg-ngpa-slate/50 rounded-xl p-4 inline-block text-left text-sm">
            <p className="text-ngpa-white font-semibold">{session.label}</p>
            <p className="text-ngpa-muted mt-1">
              Dill Dinkers {session.location}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────
  const inputClass =
    "w-full bg-ngpa-slate border border-ngpa-slate rounded-lg px-4 py-3 text-ngpa-white placeholder:text-ngpa-muted/50 focus:outline-none focus:ring-2 focus:ring-ngpa-lime focus:border-transparent transition-colors";
  const selectClass = `${inputClass} appearance-none cursor-pointer`;
  const labelClass =
    "block font-heading text-sm font-bold text-ngpa-white mb-1";
  const errorClass = "text-ngpa-red text-sm mt-1";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-ngpa-panel rounded-2xl p-6 sm:p-8 border border-ngpa-slate"
    >
      {serverError && (
        <div className="bg-ngpa-red/10 border border-ngpa-red/30 rounded-lg p-4 mb-6">
          <p className="text-ngpa-red text-sm font-medium">{serverError}</p>
        </div>
      )}

      {/* Parent Info */}
      <fieldset className="mb-8">
        <legend className="font-heading text-lg font-bold text-ngpa-lime mb-4">
          Parent / Guardian
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="parentFirstName" className={labelClass}>
              First Name
            </label>
            <input
              id="parentFirstName"
              type="text"
              autoComplete="given-name"
              className={inputClass}
              value={form.parentFirstName}
              onChange={(e) => updateField("parentFirstName", e.target.value)}
              onBlur={() => handleBlur("parentFirstName")}
            />
            {errors.parentFirstName && (
              <p className={errorClass}>{errors.parentFirstName}</p>
            )}
          </div>
          <div>
            <label htmlFor="parentLastName" className={labelClass}>
              Last Name
            </label>
            <input
              id="parentLastName"
              type="text"
              autoComplete="family-name"
              className={inputClass}
              value={form.parentLastName}
              onChange={(e) => updateField("parentLastName", e.target.value)}
              onBlur={() => handleBlur("parentLastName")}
            />
            {errors.parentLastName && (
              <p className={errorClass}>{errors.parentLastName}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="parentEmail" className={labelClass}>
              Email
            </label>
            <input
              id="parentEmail"
              type="email"
              autoComplete="email"
              className={inputClass}
              placeholder="you@example.com"
              value={form.parentEmail}
              onChange={(e) => updateField("parentEmail", e.target.value)}
              onBlur={() => handleBlur("parentEmail")}
            />
            {errors.parentEmail && (
              <p className={errorClass}>{errors.parentEmail}</p>
            )}
          </div>
          <div>
            <label htmlFor="parentPhone" className={labelClass}>
              Phone Number
            </label>
            <input
              id="parentPhone"
              type="tel"
              autoComplete="tel"
              className={inputClass}
              placeholder="(301) 555-1234"
              value={form.parentPhone}
              onChange={(e) => updateField("parentPhone", e.target.value)}
              onBlur={() => handleBlur("parentPhone")}
            />
            {errors.parentPhone && (
              <p className={errorClass}>{errors.parentPhone}</p>
            )}
          </div>
        </div>
      </fieldset>

      {/* Child Info */}
      <fieldset className="mb-8">
        <legend className="font-heading text-lg font-bold text-ngpa-lime mb-4">
          Your Child
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="childFirstName" className={labelClass}>
              First Name
            </label>
            <input
              id="childFirstName"
              type="text"
              className={inputClass}
              value={form.childFirstName}
              onChange={(e) => updateField("childFirstName", e.target.value)}
              onBlur={() => handleBlur("childFirstName")}
            />
            {errors.childFirstName && (
              <p className={errorClass}>{errors.childFirstName}</p>
            )}
          </div>
          <div>
            <label htmlFor="childLastName" className={labelClass}>
              Last Name
            </label>
            <input
              id="childLastName"
              type="text"
              className={inputClass}
              value={form.childLastName}
              onChange={(e) => updateField("childLastName", e.target.value)}
              onBlur={() => handleBlur("childLastName")}
            />
            {errors.childLastName && (
              <p className={errorClass}>{errors.childLastName}</p>
            )}
          </div>
        </div>
        <div className="mt-4">
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
      </fieldset>

      {/* Session Selection */}
      <fieldset className="mb-8">
        <legend className="font-heading text-lg font-bold text-ngpa-lime mb-4">
          Pick a Session
        </legend>
        <div>
          <label htmlFor="location" className={labelClass}>
            Preferred Location
          </label>
          <select
            id="location"
            className={selectClass}
            value={form.location}
            onChange={(e) => updateField("location", e.target.value)}
            onBlur={() => handleBlur("location")}
          >
            <option value="">Select location</option>
            {locations.map((loc) => (
              <option key={loc.name} value={loc.name}>
                {loc.venue} &mdash; {loc.name}
              </option>
            ))}
          </select>
          {errors.location && (
            <p className={errorClass}>{errors.location}</p>
          )}
        </div>
        <div className="mt-4">
          <label htmlFor="sessionId" className={labelClass}>
            Session Date & Time
          </label>
          <select
            id="sessionId"
            className={selectClass}
            value={form.sessionId}
            onChange={(e) => updateField("sessionId", e.target.value)}
            onBlur={() => handleBlur("sessionId")}
            disabled={!form.location}
          >
            <option value="">
              {form.location
                ? "Select a session"
                : "Select a location first"}
            </option>
            {filteredSessions.map((s) => (
              <option key={s.eventId} value={String(s.eventId)}>
                {s.label}
              </option>
            ))}
          </select>
          {errors.sessionId && (
            <p className={errorClass}>{errors.sessionId}</p>
          )}
        </div>
      </fieldset>

      {/* Optional */}
      <fieldset className="mb-8">
        <legend className="font-heading text-lg font-bold text-ngpa-lime mb-4">
          A Little More (Optional)
        </legend>
        <div>
          <label htmlFor="howHeard" className={labelClass}>
            How did you hear about us?
          </label>
          <select
            id="howHeard"
            className={selectClass}
            value={form.howHeard}
            onChange={(e) => updateField("howHeard", e.target.value)}
          >
            <option value="">Select one (optional)</option>
            {HOW_HEARD_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {errors.howHeard && (
            <p className={errorClass}>{errors.howHeard}</p>
          )}
        </div>
        <div className="mt-4">
          <label htmlFor="notes" className={labelClass}>
            Anything else we should know?
          </label>
          <textarea
            id="notes"
            rows={3}
            className={inputClass}
            placeholder="Allergies, questions, special requests..."
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            maxLength={500}
          />
          {errors.notes && <p className={errorClass}>{errors.notes}</p>}
          {form.notes.length > 0 && (
            <p className="text-ngpa-muted text-xs mt-1 text-right">
              {form.notes.length}/500
            </p>
          )}
        </div>
      </fieldset>

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full px-8 py-4 bg-ngpa-lime text-ngpa-black font-heading font-bold text-lg rounded-full hover:bg-ngpa-cyan transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
            Reserving Your Spot...
          </span>
        ) : (
          "Reserve Your Free Spot"
        )}
      </button>

      <p className="text-ngpa-muted text-xs text-center mt-3">
        No payment required. No spam. Just pickleball.
      </p>
    </form>
  );
}
