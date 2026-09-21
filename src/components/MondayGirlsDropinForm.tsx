"use client";

import { useState } from "react";
import InlineWaiverStep from "@/components/InlineWaiverStep";
import {
  MONDAY_GIRLS_SEASON_GROUPS,
  mondayGirlsSeasonSeats,
} from "@/data/monday-girls-season-2026";
import {
  MONDAY_GIRLS_DROPIN_PRICE_USD,
  mondayGirlsDropinSellableMondays,
} from "@/data/monday-girls-dropin-2026";
import { MONDAY_GIRLS_TIME_LABEL } from "@/data/monday-girls-2026";
import { mondayGirlsTodayET } from "@/lib/monday-girls-registration-window";
import {
  validateMondayGirlsDropin,
  type MondayGirlsDropinData,
  type MondayGirlsDropinErrors,
} from "@/lib/validate-monday-girls-dropin";
import { isWaiverRequired } from "@/lib/waiver-required";
import { seatStatusLabel } from "@/lib/seat-status";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";

// Monday Girls drop-in form — $35 for a single Monday. Same field set as the
// season form plus a Monday picker, posting to the ENV-GATED
// /api/checkout-monday-girls-dropin. A drop-in seat is a season seat for that
// Monday: the API counts the same block-wide roster rows.

type FormStatus = "idle" | "submitting" | "redirecting" | "error" | "closed";

const MONTH_DAY: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
};

function mondayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", MONTH_DAY);
}

function emptyForm(): MondayGirlsDropinData {
  return {
    monday: "",
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

interface Props {
  /** Confirmed-seat count for the WHOLE block; null = unknown. */
  spotsTaken: number | null;
}

export default function MondayGirlsDropinForm({ spotsTaken }: Props) {
  const [form, setForm] = useState<MondayGirlsDropinData>(emptyForm);
  const [errors, setErrors] = useState<MondayGirlsDropinErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const [waiverNeeded, setWaiverNeeded] = useState(false);

  const spotsLeft =
    typeof spotsTaken === "number"
      ? mondayGirlsSeasonSeats() - spotsTaken
      : null;
  const soldOut = spotsLeft !== null && spotsLeft <= 0;
  const seatStatus = seatStatusLabel(spotsLeft);

  const sellableMondays = mondayGirlsDropinSellableMondays(
    mondayGirlsTodayET(),
  );

  function update<K extends keyof MondayGirlsDropinData>(
    field: K,
    value: MondayGirlsDropinData[K],
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
    const allErrors = validateMondayGirlsDropin(form);
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
      const res = await fetch("/api/checkout-monday-girls-dropin", {
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
      window.location.href = `/monday-girls/success?inv=${data.invoiceId as string}&dropin=${form.monday as string}`;
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
          Drop-in booking isn&rsquo;t open just yet
        </p>
        <p className="text-ngpa-white/70 text-sm mt-2">
          Text Coach Sam at{" "}
          <a
            href="tel:+13013254731"
            className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
          >
            301-325-4731
          </a>{" "}
          and he&rsquo;ll get your daughter on court.
        </p>
      </div>
    );
  }

  if (soldOut || sellableMondays.length === 0) {
    return (
      <div className="bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20 text-center">
        <p className="font-heading text-lg font-black text-ngpa-white">
          {sellableMondays.length === 0
            ? "This block has wrapped up"
            : "This block is full"}
        </p>
        <p className="text-ngpa-white/70 text-sm mt-2">
          Text Coach Sam at{" "}
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
          <legend className={labelClass}>Which Monday?</legend>
          <p className="text-sm text-ngpa-white/70 mb-3">
            {MONDAY_GIRLS_TIME_LABEL}
            {seatStatus ? ` · ${seatStatus}` : ""}
          </p>
          <div className="grid grid-cols-1 gap-2" id="monday">
            {sellableMondays.map((iso) => {
              const selected = form.monday === iso;
              return (
                <label
                  key={iso}
                  className={`cursor-pointer rounded-xl border px-4 py-3 transition-all flex items-center gap-3 ${
                    selected
                      ? "border-ngpa-teal bg-ngpa-teal/10"
                      : "border-ngpa-slate/60 bg-ngpa-deep/60 hover:border-ngpa-teal/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="monday"
                    value={iso}
                    checked={selected}
                    onChange={() => update("monday", iso)}
                    className="sr-only"
                  />
                  <time
                    dateTime={iso}
                    className="font-heading font-bold text-ngpa-white"
                  >
                    {mondayLabel(iso)}
                  </time>
                  <span className="ml-auto text-ngpa-teal font-bold text-sm">
                    ${MONDAY_GIRLS_DROPIN_PRICE_USD}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.monday && <p className={errorClass}>{errors.monday}</p>}
        </fieldset>

        <fieldset className="mb-6">
          <legend className={labelClass}>Where is your daughter today?</legend>
          <div className="grid grid-cols-1 gap-3" id="group">
            {MONDAY_GIRLS_SEASON_GROUPS.map((option) => {
              const selected = form.group === option.group;
              return (
                <label
                  key={option.group}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    selected
                      ? "border-ngpa-teal bg-ngpa-teal/10"
                      : "border-ngpa-slate/60 bg-ngpa-deep/60 hover:border-ngpa-teal/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="group"
                    value={option.group}
                    checked={selected}
                    onChange={() => update("group", option.group)}
                    className="sr-only"
                  />
                  <span className="font-heading font-bold text-ngpa-white">
                    {option.label}
                  </span>
                  <span className="block text-sm text-ngpa-white/65 mt-1">
                    {option.blurb}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.group && <p className={errorClass}>{errors.group}</p>}
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="dropin-parentName">
              Parent name
            </label>
            <input
              id="dropin-parentName"
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
            <label className={labelClass} htmlFor="dropin-email">
              Email
            </label>
            <input
              id="dropin-email"
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
            <label className={labelClass} htmlFor="dropin-phone">
              Phone
            </label>
            <input
              id="dropin-phone"
              type="tel"
              className={inputClass}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              autoComplete="tel"
            />
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>
          <div>
            <label className={labelClass} htmlFor="dropin-childFirstName">
              Child&rsquo;s first name
            </label>
            <input
              id="dropin-childFirstName"
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
            <label className={labelClass} htmlFor="dropin-childBirthYear">
              Child&rsquo;s birth year
            </label>
            <input
              id="dropin-childBirthYear"
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
            <label className={labelClass} htmlFor="dropin-allergies">
              Allergies / medical notes{" "}
              <span className="font-normal text-ngpa-white/50">(optional)</span>
            </label>
            <input
              id="dropin-allergies"
              className={inputClass}
              value={form.allergies}
              onChange={(e) => update("allergies", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className={labelClass} htmlFor="dropin-emergencyName">
              Emergency contact name
            </label>
            <input
              id="dropin-emergencyName"
              className={inputClass}
              value={form.emergencyName}
              onChange={(e) => update("emergencyName", e.target.value)}
            />
            {errors.emergencyName && (
              <p className={errorClass}>{errors.emergencyName}</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="dropin-emergencyPhone">
              Emergency contact phone
            </label>
            <input
              id="dropin-emergencyPhone"
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
              : `Continue to payment — $${MONDAY_GIRLS_DROPIN_PRICE_USD}`}
        </button>
      </form>
    </>
  );
}
