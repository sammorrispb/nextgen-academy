"use client";

import { useState } from "react";
import InlineWaiverStep from "@/components/InlineWaiverStep";
import {
  GUARANTEED_GAMES_TEXT,
  MEDALS_TEXT,
  MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_DIVISIONS,
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_VENUE,
  NONRESIDENT_PRICE_USD,
  NO_REFUNDS_TEXT,
  RAIN_OR_SHINE_TEXT,
  RESIDENT_PRICE_USD,
} from "@/data/mvf-junior-tournament-2026";
import {
  validateMvfJuniorTournament,
  type MvfJuniorTournamentData,
  type MvfJuniorTournamentErrors,
} from "@/lib/validate-mvf-junior-tournament";
import { isWaiverRequired } from "@/lib/waiver-required";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";

// MVF Junior Tournament sign-up form — $50 Montgomery Village resident / $60
// non-resident, resolved server-side from the resident flag. Posts to
// /api/checkout-mvf-junior-tournament, which builds a Stripe invoice from the
// form (player + division) instead of a fixed Price ID.

type FormStatus = "idle" | "submitting" | "redirecting" | "error" | "closed";

function emptyForm(): MvfJuniorTournamentData {
  return {
    division: "",
    resident: true,
    parentName: "",
    email: "",
    phone: "",
    childFirstName: "",
    childLastName: "",
    childDob: "",
    emergencyName: "",
    emergencyPhone: "",
    allergies: "",
    smsConsent: false,
  };
}

export default function MvfJuniorTournamentForm() {
  const [form, setForm] = useState<MvfJuniorTournamentData>(emptyForm);
  const [errors, setErrors] = useState<MvfJuniorTournamentErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const [waiverNeeded, setWaiverNeeded] = useState(false);

  function update<K extends keyof MvfJuniorTournamentData>(
    field: K,
    value: MvfJuniorTournamentData[K],
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
    const allErrors = validateMvfJuniorTournament(form);
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
      const res = await fetch("/api/checkout-mvf-junior-tournament", {
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
      window.location.href = `/mvf-junior-tournament/success?inv=${data.invoiceId as string}&division=${form.division as string}`;
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
  const price = form.resident ? RESIDENT_PRICE_USD : NONRESIDENT_PRICE_USD;

  if (status === "closed") {
    return (
      <div className="bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20 text-center">
        <p className="font-heading text-lg font-black text-ngpa-white">
          Tournament sign-ups aren&rsquo;t open just yet
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
          <legend className={labelClass}>Which division?</legend>
          <p className="text-sm text-ngpa-white/70 mb-3">
            {MVF_JUNIOR_TOURNAMENT_DATE_LABEL} ·{" "}
            {MVF_JUNIOR_TOURNAMENT_TIME_LABEL} · {MVF_JUNIOR_TOURNAMENT_VENUE}
          </p>
          <div className="grid grid-cols-1 gap-3" id="division">
            {MVF_JUNIOR_TOURNAMENT_DIVISIONS.map((option) => {
              const selected = form.division === option.division;
              return (
                <label
                  key={option.division}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    selected
                      ? "border-ngpa-teal bg-ngpa-teal/10"
                      : "border-ngpa-slate/60 bg-ngpa-deep/60 hover:border-ngpa-teal/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="division"
                    value={option.division}
                    checked={selected}
                    onChange={() => update("division", option.division)}
                    className="sr-only"
                  />
                  <span className="font-heading font-bold text-ngpa-white">
                    {option.label}
                  </span>
                  <span className="block text-sm text-ngpa-teal-bright font-bold mt-0.5">
                    {option.ageLabel}
                  </span>
                  <span className="block text-sm text-ngpa-white/65 mt-1">
                    {option.blurb}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.division && <p className={errorClass}>{errors.division}</p>}
        </fieldset>

        <fieldset className="mb-6">
          <legend className={labelClass}>
            Are you a Montgomery Village resident?
          </legend>
          <div className="grid grid-cols-2 gap-3" id="resident">
            {(
              [
                { value: true, label: "Yes, resident", price: RESIDENT_PRICE_USD },
                { value: false, label: "No, non-resident", price: NONRESIDENT_PRICE_USD },
              ] as const
            ).map((option) => {
              const selected = form.resident === option.value;
              return (
                <label
                  key={option.label}
                  className={`cursor-pointer rounded-xl border p-4 transition-all text-center ${
                    selected
                      ? "border-ngpa-teal bg-ngpa-teal/10"
                      : "border-ngpa-slate/60 bg-ngpa-deep/60 hover:border-ngpa-teal/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="resident"
                    value={option.value ? "yes" : "no"}
                    checked={selected}
                    onChange={() => update("resident", option.value)}
                    className="sr-only"
                  />
                  <span className="font-heading font-bold text-ngpa-white block">
                    {option.label}
                  </span>
                  <span className="block text-sm text-ngpa-teal-bright font-bold mt-0.5">
                    ${option.price}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.resident && <p className={errorClass}>{errors.resident}</p>}
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="mt-parentName">
              Parent name
            </label>
            <input
              id="mt-parentName"
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
            <label className={labelClass} htmlFor="mt-email">
              Email
            </label>
            <input
              id="mt-email"
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
            <label className={labelClass} htmlFor="mt-phone">
              Phone
            </label>
            <input
              id="mt-phone"
              type="tel"
              className={inputClass}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              autoComplete="tel"
            />
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>
          <div>
            <label className={labelClass} htmlFor="mt-childFirstName">
              Child&rsquo;s first name
            </label>
            <input
              id="mt-childFirstName"
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
            <label className={labelClass} htmlFor="mt-childLastName">
              Child&rsquo;s last name
            </label>
            <input
              id="mt-childLastName"
              className={inputClass}
              value={form.childLastName}
              onChange={(e) => update("childLastName", e.target.value)}
            />
            {errors.childLastName && (
              <p className={errorClass}>{errors.childLastName}</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="mt-childDob">
              Child&rsquo;s date of birth
            </label>
            <input
              id="mt-childDob"
              type="date"
              max="2026-10-24"
              className={inputClass}
              value={form.childDob}
              onChange={(e) => update("childDob", e.target.value)}
            />
            {errors.childDob && <p className={errorClass}>{errors.childDob}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="mt-emergencyName">
              Emergency contact name
            </label>
            <input
              id="mt-emergencyName"
              className={inputClass}
              value={form.emergencyName}
              onChange={(e) => update("emergencyName", e.target.value)}
            />
            {errors.emergencyName && (
              <p className={errorClass}>{errors.emergencyName}</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="mt-emergencyPhone">
              Emergency contact phone
            </label>
            <input
              id="mt-emergencyPhone"
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

        <div className="mb-6">
          <label className={labelClass} htmlFor="mt-allergies">
            Allergies / medical notes{" "}
            <span className="font-normal text-ngpa-white/50">(optional)</span>
          </label>
          <input
            id="mt-allergies"
            className={inputClass}
            value={form.allergies}
            onChange={(e) => update("allergies", e.target.value)}
          />
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

        <div className="bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl p-4 mb-6">
          <p className="text-sm text-ngpa-white/80">
            <strong className="text-ngpa-white">{NO_REFUNDS_TEXT}</strong>{" "}
            {RAIN_OR_SHINE_TEXT}
          </p>
          <p className="text-sm text-ngpa-white/70 mt-1">
            {GUARANTEED_GAMES_TEXT} {MEDALS_TEXT}
          </p>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors text-base shadow-xl shadow-ngpa-teal/20 min-h-[52px] disabled:opacity-60"
        >
          {status === "redirecting"
            ? "Taking you to checkout…"
            : busy
              ? "Working…"
              : `Continue to payment — $${price}`}
        </button>
      </form>
    </>
  );
}
