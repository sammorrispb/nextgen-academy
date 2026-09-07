"use client";

import { useState } from "react";
import InlineWaiverStep from "@/components/InlineWaiverStep";
import {
  MONDAY_GIRLS_SEASON_GROUP,
  mondayGirlsSeasonSlotsFor,
} from "@/data/monday-girls-season-2026";
import {
  validateMondayGirlsRegistration,
  type MondayGirlsRegistrationData,
  type MondayGirlsRegistrationErrors,
} from "@/lib/validate-monday-girls-registration";
import { isWaiverRequired } from "@/lib/waiver-required";
import { seatStatusLabel } from "@/lib/seat-status";

// Monday Girls Beginner Group registration form — structural mirror of
// PicklParkRegistrationForm (same field set + a11y patterns + Stripe-redirect
// handleSubmit), minus the group picker: this block sells exactly ONE group, so
// the group is preset and its seat status renders as a summary line instead of
// a radio nobody can meaningfully choose from.
//
// Posts to /api/checkout-monday-girls, which is ENV-GATED. The page won't even
// render this form until the Stripe price env exists (see
// monday-girls-registration-window.ts), so the 503 branch here is a belt-and-
// braces fallback for the env disappearing between render and submit.

type FormStatus = "idle" | "submitting" | "redirecting" | "error" | "closed";

interface MondayGirlsRegistrationFormProps {
  /** Confirmed-seat count for the group; null = unknown (count hidden). */
  spotsTaken: number | null;
}

function emptyForm(): MondayGirlsRegistrationData {
  return {
    // Preset: one group, so the parent never has to pick it and the checkout
    // still receives the exact value its capacity filter matches on.
    group: MONDAY_GIRLS_SEASON_GROUP.group,
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

export default function MondayGirlsRegistrationForm({
  spotsTaken,
}: MondayGirlsRegistrationFormProps) {
  const [form, setForm] = useState<MondayGirlsRegistrationData>(emptyForm);
  const [errors, setErrors] = useState<MondayGirlsRegistrationErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const [waiverNeeded, setWaiverNeeded] = useState(false);

  const spotsLeft =
    typeof spotsTaken === "number"
      ? mondayGirlsSeasonSlotsFor(MONDAY_GIRLS_SEASON_GROUP.group) - spotsTaken
      : null;
  const soldOut = spotsLeft !== null && spotsLeft <= 0;
  const seatStatus = seatStatusLabel(spotsLeft);

  function update<K extends keyof MondayGirlsRegistrationData>(
    field: K,
    value: MondayGirlsRegistrationData[K],
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

    const allErrors = validateMondayGirlsRegistration(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const first = Object.keys(allErrors)[0];
      document.getElementById(first)?.focus();
      return;
    }

    await startCheckout();
  }

  // Split out of handleSubmit so the inline waiver step can resume checkout
  // with the form state it never let go of — no re-typing, no re-validation.
  async function startCheckout() {
    setServerError("");
    setStatus("submitting");
    try {
      const res = await fetch("/api/checkout-monday-girls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      // Registration not open (no Stripe price set) — calm, not an error.
      if (res.status === 503) {
        setStatus("closed");
        return;
      }
      const data = await res.json();
      // One-time waiver gate: sign it in place, then resume checkout here.
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
          We&rsquo;re finishing the setup for this block. Text Coach Sam at{" "}
          <a
            href="tel:+13013254731"
            className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
          >
            301-325-4731
          </a>{" "}
          and he&rsquo;ll hold your spot.
        </p>
      </div>
    );
  }

  if (soldOut) {
    return (
      <div className="bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20 text-center">
        <p className="font-heading text-lg font-black text-ngpa-white">
          This block is full
        </p>
        <p className="text-ngpa-white/70 text-sm mt-2">
          Every spot is taken. Text Coach Sam at{" "}
          <a
            href="tel:+13013254731"
            className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
          >
            301-325-4731
          </a>{" "}
          to join the sub list — spots open up, and subs get first call on the
          next block.
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
      {/* Hidden, never unmounted — the registration survives the waiver step. */}
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

        {/* One group — shown as a summary, not a choice. */}
        <div className="rounded-xl border border-ngpa-teal/50 bg-ngpa-teal/10 px-4 py-3.5 mb-6">
          <p className="font-heading font-bold text-ngpa-white">
            {MONDAY_GIRLS_SEASON_GROUP.label}
          </p>
          <p className="text-sm text-ngpa-white/70">
            Mondays {MONDAY_GIRLS_SEASON_GROUP.timeLabel}
            {seatStatus ? ` · ${seatStatus}` : ""}
          </p>
        </div>

        <div className="space-y-4">
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
                placeholder="e.g. 2018"
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

          {/* Waiver — one-time e-signature, gated at checkout */}
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
            covers your player for every NGA program. If you haven&rsquo;t
            signed yet, we&rsquo;ll ask you to before checkout.
          </p>

          {/* Refund terms, stated where the money is taken —
              monday-girls-refund-policy.ts enforces exactly this. */}
          <p className="text-sm text-ngpa-white/70">
            Registering holds your player&rsquo;s spot for the whole block, so
            it&rsquo;s{" "}
            <strong className="text-ngpa-white">non-refundable</strong> if you
            withdraw. If we have to cancel sessions we can&rsquo;t make up on a
            rain date, we refund the ones we didn&rsquo;t run.
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
                Text me weather calls and schedule changes. Optional. Reply STOP
                to opt out.
              </span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full px-8 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
        >
          {busy ? "Taking you to checkout…" : "Register for the block →"}
        </button>

        <p className="text-ngpa-white/55 text-xs text-center mt-4">
          Secure checkout by Stripe. We&rsquo;ll email your confirmation with
          every date and everything to bring.
        </p>
      </form>
    </>
  );
}
