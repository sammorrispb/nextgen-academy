"use client";

import { useState } from "react";
import InlineWaiverStep from "@/components/InlineWaiverStep";
import {
  PICKL_PARK_WINTER_LEAGUE_PRICE_USD,
  PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL,
  PICKL_PARK_WINTER_LEAGUE_TRACKS,
} from "@/data/pickl-park-winter-league-2026";
import {
  validatePicklParkWinterLeague,
  type PicklParkWinterLeagueData,
  type PicklParkWinterLeagueErrors,
} from "@/lib/validate-pickl-park-winter-league";
import { isWaiverRequired } from "@/lib/waiver-required";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";

// Pickl Park Winter Youth League sign-up form — $225 for the six-week season.
// Posts to /api/checkout-pickl-park-winter-league, which builds a Stripe
// invoice from the form (player + track) instead of a fixed Price ID.

type FormStatus = "idle" | "submitting" | "redirecting" | "error" | "closed";

function emptyForm(): PicklParkWinterLeagueData {
  return {
    track: "",
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

export default function PicklParkWinterLeagueForm() {
  const [form, setForm] = useState<PicklParkWinterLeagueData>(emptyForm);
  const [errors, setErrors] = useState<PicklParkWinterLeagueErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const [waiverNeeded, setWaiverNeeded] = useState(false);

  function update<K extends keyof PicklParkWinterLeagueData>(
    field: K,
    value: PicklParkWinterLeagueData[K],
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
    const allErrors = validatePicklParkWinterLeague(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const first = Object.keys(allErrors)[0];
      document.getElementById(first)?.focus();
      return;
    }
    await startCheckout();
  }

  async function startCheckout() {
    setServerError("");
    setStatus("submitting");
    try {
      const res = await fetch("/api/checkout-pickl-park-winter-league", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // submissionId becomes the Stripe idempotency key — a double-tap or a
        // retried request can't create two invoices.
        body: JSON.stringify({ ...form, submissionId: crypto.randomUUID() }),
      });
      if (res.status === 503) {
        setStatus("closed");
        return;
      }
      const data = await res.json();
      if (isWaiverRequired(res.status, data)) {
        setWaiverNeeded(true);
        setStatus("idle");
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
      if (!data.url || !data.invoiceId)
        throw new Error("Could not create your invoice");
      setStatus("redirecting");
      // The invoice is emailed too; the success page shows its status and a
      // Pay-now button that points at the hosted invoice.
      window.location.href = `/pickl-park-winter-league/success?inv=${data.invoiceId as string}&track=${form.track as string}`;
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
          Winter League sign-ups aren&rsquo;t open just yet
        </p>
        <p className="text-ngpa-white/70 text-sm mt-2">
          Text Coach Sam at{" "}
          <a
            href="tel:+13013254731"
            className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
          >
            301-325-4731
          </a>{" "}
          and he&rsquo;ll get your player on court.
        </p>
      </div>
    );
  }

  return (
    <>
      {waiverNeeded && (
        <InlineWaiverStep
          parentName={form.parentName}
          email={form.email}
          phone={form.phone}
          continueLabel="payment"
          onSigned={() => {
            setWaiverNeeded(false);
            void startCheckout();
          }}
          onCancel={() => setWaiverNeeded(false)}
        />
      )}
      <form
        onSubmit={handleSubmit}
        noValidate
        className={`bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20${
          waiverNeeded ? " hidden" : ""
        }`}
      >
        {serverError && (
          <div className="bg-ngpa-red/10 border border-ngpa-red/30 rounded-lg p-4 mb-6">
            <p className="text-ngpa-red text-sm font-medium">{serverError}</p>
          </div>
        )}

        <fieldset className="mb-6">
          <legend className={labelClass}>Which track?</legend>
          <p className="text-sm text-ngpa-white/70 mb-3">
            {PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL} · $
            {PICKL_PARK_WINTER_LEAGUE_PRICE_USD} for all 6 weeks
          </p>
          <div className="grid grid-cols-1 gap-3" id="track">
            {PICKL_PARK_WINTER_LEAGUE_TRACKS.map((option) => {
              const selected = form.track === option.track;
              return (
                <label
                  key={option.track}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    selected
                      ? "border-ngpa-teal bg-ngpa-teal/10"
                      : "border-ngpa-slate/60 bg-ngpa-deep/60 hover:border-ngpa-teal/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="track"
                    value={option.track}
                    checked={selected}
                    onChange={() => update("track", option.track)}
                    className="sr-only"
                  />
                  <span className="font-heading font-bold text-ngpa-white">
                    {option.label}
                  </span>
                  <span className="block text-sm text-ngpa-teal-bright font-bold mt-0.5">
                    {option.timeLabel}
                  </span>
                  <span className="block text-sm text-ngpa-white/65 mt-1">
                    {option.blurb}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.track && <p className={errorClass}>{errors.track}</p>}
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="wl-parentName">
              Parent name
            </label>
            <input
              id="wl-parentName"
              className={inputClass}
              value={form.parentName}
              onChange={(e) => update("parentName", e.target.value)}
              autoComplete="name"
            />
            {errors.parentName && (
              <p className={errorClass}>{errors.parentName}</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="wl-email">
              Email
            </label>
            <input
              id="wl-email"
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              autoComplete="email"
            />
            {errors.email && <p className={errorClass}>{errors.email}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="wl-phone">
              Phone
            </label>
            <input
              id="wl-phone"
              type="tel"
              className={inputClass}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              autoComplete="tel"
            />
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>
          <div>
            <label className={labelClass} htmlFor="wl-childFirstName">
              Child&rsquo;s first name
            </label>
            <input
              id="wl-childFirstName"
              className={inputClass}
              value={form.childFirstName}
              onChange={(e) => update("childFirstName", e.target.value)}
            />
            {errors.childFirstName && (
              <p className={errorClass}>{errors.childFirstName}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="wl-childBirthYear">
              Child&rsquo;s birth year
            </label>
            <input
              id="wl-childBirthYear"
              inputMode="numeric"
              className={inputClass}
              value={form.childBirthYear}
              onChange={(e) => update("childBirthYear", e.target.value)}
              placeholder="e.g. 2016"
            />
            {errors.childBirthYear && (
              <p className={errorClass}>{errors.childBirthYear}</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="wl-allergies">
              Allergies / medical notes{" "}
              <span className="font-normal text-ngpa-white/50">(optional)</span>
            </label>
            <input
              id="wl-allergies"
              className={inputClass}
              value={form.allergies}
              onChange={(e) => update("allergies", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className={labelClass} htmlFor="wl-emergencyName">
              Emergency contact name
            </label>
            <input
              id="wl-emergencyName"
              className={inputClass}
              value={form.emergencyName}
              onChange={(e) => update("emergencyName", e.target.value)}
            />
            {errors.emergencyName && (
              <p className={errorClass}>{errors.emergencyName}</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="wl-emergencyPhone">
              Emergency contact phone
            </label>
            <input
              id="wl-emergencyPhone"
              type="tel"
              className={inputClass}
              value={form.emergencyPhone}
              onChange={(e) => update("emergencyPhone", e.target.value)}
            />
            {errors.emergencyPhone && (
              <p className={errorClass}>{errors.emergencyPhone}</p>
            )}
          </div>
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={form.smsConsent}
            onChange={(e) => update("smsConsent", e.target.checked)}
            className="mt-1 h-4 w-4 accent-teal-400"
          />
          <span className="text-xs text-ngpa-white/60 leading-relaxed">
            {SMS_CONSENT_TEXT}
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors text-base shadow-xl shadow-ngpa-teal/20 min-h-[52px] disabled:opacity-60"
        >
          {status === "redirecting"
            ? "Taking you to checkout…"
            : busy
              ? "Working…"
              : `Continue to payment — $${PICKL_PARK_WINTER_LEAGUE_PRICE_USD}`}
        </button>
      </form>
    </>
  );
}
