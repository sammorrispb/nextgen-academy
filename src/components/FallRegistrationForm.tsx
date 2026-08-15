"use client";

import { useState } from "react";
import {
  FALL_SEASON_GROUPS,
  FALL_SEASON_SPOTS_PER_GROUP,
  type FallSeasonGroup,
} from "@/data/fall-season-2026";
import {
  validateFallRegistration,
  type FallRegistrationData,
  type FallRegistrationErrors,
} from "@/lib/validate-fall-registration";

// Season REGISTRATION form — the full-pay checkout surface that replaced the
// FallInterestForm survey once the season's terms were set. Structural mirror
// of LeagueSeasonForm: same field set + a11y patterns + Stripe-redirect
// handleSubmit. Posts to /api/checkout-fall, which is ENV-GATED — until
// STRIPE_FALL_SEASON_PRICE_ID is set it returns 503 ("registration isn't open
// yet"), surfaced here as a calm message rather than an error.

type FormStatus = "idle" | "submitting" | "redirecting" | "error" | "closed";

interface FallRegistrationFormProps {
  /** Confirmed-seat count per group; null = unknown (count hidden). */
  spotsTaken: Partial<Record<FallSeasonGroup, number | null>>;
}

function emptyForm(): FallRegistrationData {
  return {
    group: "",
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

export default function FallRegistrationForm({
  spotsTaken,
}: FallRegistrationFormProps) {
  const [form, setForm] = useState<FallRegistrationData>(emptyForm);
  const [errors, setErrors] = useState<FallRegistrationErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");

  function update<K extends keyof FallRegistrationData>(
    field: K,
    value: FallRegistrationData[K],
  ) {
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

    const allErrors = validateFallRegistration(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const first = Object.keys(allErrors)[0];
      document.getElementById(first)?.focus();
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/checkout-fall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      // Registration not open yet (no Stripe price set) — calm, not an error.
      if (res.status === 503) {
        setStatus("closed");
        return;
      }
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
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setStatus("error");
    }
  }

  const inputClass =
    "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
  const labelClass =
    "block font-heading text-sm font-bold text-ngpa-white mb-1.5";
  const errorClass = "text-ngpa-red text-sm mt-1.5";

  const busy = status === "submitting" || status === "redirecting";

  if (status === "closed") {
    return (
      <div className="bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20 text-center">
        <p className="font-heading text-lg font-black text-ngpa-white">
          Registration isn&rsquo;t open just yet
        </p>
        <p className="text-ngpa-white/70 text-sm mt-2">
          We&rsquo;re finishing the season setup. Join the newsletter and
          you&rsquo;ll be first to know the moment registration opens.
        </p>
      </div>
    );
  }

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
        {/* Group pick — Green or Yellow */}
        <fieldset>
          <legend className={labelClass}>Your player&rsquo;s color group</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="group">
            {FALL_SEASON_GROUPS.map((option) => {
              const taken = spotsTaken[option.group];
              const soldOut =
                typeof taken === "number" &&
                taken >= FALL_SEASON_SPOTS_PER_GROUP;
              const spotsLeft =
                typeof taken === "number"
                  ? Math.max(0, FALL_SEASON_SPOTS_PER_GROUP - taken)
                  : null;
              const selected = form.group === option.group;
              return (
                <label
                  key={option.group}
                  className={`flex flex-col gap-1 rounded-xl border px-4 py-3.5 cursor-pointer transition-all min-h-[48px] ${
                    soldOut
                      ? "border-ngpa-slate/40 bg-ngpa-deep/30 opacity-60 cursor-not-allowed"
                      : selected
                        ? "border-ngpa-teal bg-ngpa-teal/10"
                        : "border-ngpa-slate/60 bg-ngpa-deep/60 hover:border-ngpa-teal/60"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="group"
                      className="h-5 w-5 shrink-0 accent-ngpa-teal"
                      checked={selected}
                      disabled={soldOut}
                      onChange={() => update("group", option.group)}
                    />
                    <span className="font-heading font-bold text-ngpa-white">
                      {option.label}
                    </span>
                  </span>
                  <span className="text-sm text-ngpa-white/70 pl-8">
                    Sundays {option.timeLabel}
                    {soldOut
                      ? " · Sold out"
                      : spotsLeft !== null
                        ? ` · ${spotsLeft} of ${FALL_SEASON_SPOTS_PER_GROUP} spots left`
                        : ""}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.group && <p className={errorClass}>{errors.group}</p>}
        </fieldset>

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
              Player&rsquo;s first name
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
              Player&rsquo;s birth year
            </label>
            <input
              id="childBirthYear"
              type="text"
              inputMode="numeric"
              className={inputClass}
              placeholder="e.g. 2016"
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

        {/* Waiver — one-time e-signature, gated at checkout (no per-season checkbox) */}
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
          covers your player for every NGA program. If you haven&rsquo;t signed
          yet, we&rsquo;ll ask you to before checkout. Rain dates are built in
          — if a Sunday washes out, we make it up.
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
              Text me season updates (weather calls, schedule changes).
              Optional. Reply STOP to opt out.
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full px-8 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
      >
        {busy ? "Taking you to checkout…" : "Register for the season →"}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        Secure checkout by Stripe. We&rsquo;ll email your season confirmation
        with every date and everything to bring.
      </p>
    </form>
  );
}
