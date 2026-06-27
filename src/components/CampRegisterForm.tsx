"use client";

import { useState } from "react";
import {
  CAMP_OPTIONS,
  campDays,
  findCampBySlug,
  type CampOptionKey,
} from "@/data/camps";
import {
  validateCampForm,
  type CampFormData,
  type CampValidationErrors,
} from "@/lib/validate-camp";

type FormStatus = "idle" | "submitting" | "redirecting" | "error";

interface CampRegisterFormProps {
  campSlug: string;
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function emptyForm(campSlug: string): CampFormData {
  return {
    campSlug,
    optionKey: "day",
    selectedDay: "",
    parentName: "",
    email: "",
    phone: "",
    childFirstName: "",
    childBirthYear: "",
    emergencyName: "",
    emergencyPhone: "",
    allergies: "",
    smsConsent: false,
  };
}

export default function CampRegisterForm({ campSlug }: CampRegisterFormProps) {
  const [form, setForm] = useState<CampFormData>(() => emptyForm(campSlug));
  const [errors, setErrors] = useState<CampValidationErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");

  const camp = findCampBySlug(campSlug);
  const days = camp ? campDays(camp) : [];

  function update<K extends keyof CampFormData>(field: K, value: CampFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const allErrors = validateCampForm(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const first = Object.keys(allErrors)[0];
      document.getElementById(first)?.focus();
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/checkout-camp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      // One-time waiver gate: bounce to the prefilled sign page, then back here.
      if (res.status === 409 && data.code === "waiver_required" && data.signUrl) {
        window.location.href = data.signUrl as string;
        return;
      }
      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
          setStatus("error");
          return;
        }
        throw new Error(data.error || "Something went wrong");
      }
      if (!data.url) throw new Error("Could not start checkout");
      setStatus("redirecting");
      window.location.href = data.url as string;
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  const inputClass =
    "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
  const labelClass = "block font-heading text-sm font-bold text-ngpa-white mb-1.5";
  const errorClass = "text-ngpa-red text-sm mt-1.5";

  const busy = status === "submitting" || status === "redirecting";

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
        {/* Registration option */}
        <div>
          <label className={labelClass}>Choose single morning or full week</label>
          <div className="grid grid-cols-1 gap-2 mt-1">
            {CAMP_OPTIONS.map((opt) => {
              const active = form.optionKey === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => update("optionKey", opt.key as CampOptionKey)}
                  aria-pressed={active}
                  className={`flex items-center justify-between min-h-[48px] rounded-xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? "bg-ngpa-teal/15 border-ngpa-teal"
                      : "bg-ngpa-deep/60 border-ngpa-slate/60 hover:border-ngpa-teal/60"
                  }`}
                >
                  <span>
                    <span className="block font-heading font-bold text-ngpa-white">
                      {opt.label}
                    </span>
                    <span className="block text-xs text-ngpa-white/60">
                      {opt.key === "week"
                        ? "All 4 mornings · 9:30 AM – 12:30 PM"
                        : opt.hours}
                    </span>
                  </span>
                  <span className="font-mono font-bold text-ngpa-white">
                    ${opt.priceUsd}
                    <span className="text-ngpa-white/50 text-xs">
                      {opt.key === "day" ? "/day" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.optionKey && <p className={errorClass}>{errors.optionKey}</p>}
          <p className="text-xs text-ngpa-white/55 mt-2">
            Any morning is $50. Come all week and you&rsquo;ll never pay more than
            $150 — the 4th morning is on us.
          </p>
        </div>

        {/* Which day (single-morning only) */}
        {form.optionKey === "day" && (
          <div>
            <label htmlFor="selectedDay" className={labelClass}>
              Which morning?
            </label>
            <select
              id="selectedDay"
              className={inputClass}
              value={form.selectedDay}
              onChange={(e) => update("selectedDay", e.target.value)}
            >
              <option value="">Pick a day…</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
            {errors.selectedDay && (
              <p className={errorClass}>{errors.selectedDay}</p>
            )}
          </div>
        )}

        {/* Parent */}
        <div>
          <label htmlFor="parentName" className={labelClass}>
            Your name
          </label>
          <input
            id="parentName"
            type="text"
            autoComplete="name"
            className={inputClass}
            placeholder="First and last name"
            value={form.parentName}
            onChange={(e) => update("parentName", e.target.value)}
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
              onChange={(e) => update("email", e.target.value)}
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
              onChange={(e) => update("phone", e.target.value)}
            />
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>
        </div>

        {/* Child */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="childFirstName" className={labelClass}>
              Camper&rsquo;s first name
            </label>
            <input
              id="childFirstName"
              type="text"
              className={inputClass}
              placeholder="First name only"
              value={form.childFirstName}
              onChange={(e) => update("childFirstName", e.target.value)}
            />
            {errors.childFirstName && (
              <p className={errorClass}>{errors.childFirstName}</p>
            )}
          </div>
          <div>
            <label htmlFor="childBirthYear" className={labelClass}>
              Camper&rsquo;s birth year
            </label>
            <input
              id="childBirthYear"
              type="text"
              inputMode="numeric"
              className={inputClass}
              placeholder="e.g. 2015"
              value={form.childBirthYear}
              onChange={(e) => update("childBirthYear", e.target.value)}
            />
            {errors.childBirthYear && (
              <p className={errorClass}>{errors.childBirthYear}</p>
            )}
          </div>
        </div>

        {/* Emergency contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="emergencyName" className={labelClass}>
              Emergency contact
            </label>
            <input
              id="emergencyName"
              type="text"
              className={inputClass}
              placeholder="Name"
              value={form.emergencyName}
              onChange={(e) => update("emergencyName", e.target.value)}
            />
            {errors.emergencyName && (
              <p className={errorClass}>{errors.emergencyName}</p>
            )}
          </div>
          <div>
            <label htmlFor="emergencyPhone" className={labelClass}>
              Emergency phone
            </label>
            <input
              id="emergencyPhone"
              type="tel"
              className={inputClass}
              placeholder="301-555-0142"
              value={form.emergencyPhone}
              onChange={(e) => update("emergencyPhone", e.target.value)}
            />
            {errors.emergencyPhone && (
              <p className={errorClass}>{errors.emergencyPhone}</p>
            )}
          </div>
        </div>

        {/* Allergies / medical */}
        <div>
          <label htmlFor="allergies" className={labelClass}>
            Allergies or medical notes{" "}
            <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <textarea
            id="allergies"
            rows={2}
            className={inputClass}
            placeholder="Anything our coaches should know"
            value={form.allergies}
            onChange={(e) => update("allergies", e.target.value)}
          />
        </div>

        {/* Waiver — one-time e-signature, gated at checkout (no per-camp checkbox) */}
        <p className="text-sm text-ngpa-white/70">
          A one-time{" "}
          <a
            href="/waiver"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
          >
            liability waiver and photo release
          </a>{" "}
          covers your camper for every NGA program. If you haven&rsquo;t signed
          yet, we&rsquo;ll ask you to before checkout. Camp runs rain or shine.
        </p>

        {/* SMS consent */}
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-ngpa-teal"
              checked={form.smsConsent}
              onChange={(e) => update("smsConsent", e.target.checked)}
            />
            <span className="text-xs text-ngpa-white/60">
              Text me camp updates (location reveal, weather). Optional. Reply
              STOP to opt out.
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full px-8 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
      >
        {busy ? "Taking you to checkout…" : "Register & pay →"}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        Secure checkout by Stripe. We&rsquo;ll email your camp confirmation and
        share the exact Gaithersburg location before camp starts.
      </p>
    </form>
  );
}
