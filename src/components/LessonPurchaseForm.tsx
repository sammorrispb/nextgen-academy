"use client";

import { useState } from "react";
import InlineWaiverStep from "@/components/InlineWaiverStep";
import {
  LESSON_PRICE_USD,
  LESSON_PRODUCTS,
  type LessonType,
} from "@/data/lessons";
import {
  validateLessonPurchase,
  type LessonPurchaseData,
  type LessonPurchaseErrors,
} from "@/lib/validate-lesson";
import { isWaiverRequired } from "@/lib/waiver-required";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";

// Lesson purchase form — same field set + a11y patterns as the season
// registration forms, posting to the ENV-GATED /api/checkout-lesson. The page
// only renders this form when at least one lesson price env var exists, so the
// 503 branch is a belt-and-braces fallback.

type FormStatus = "idle" | "submitting" | "redirecting" | "error" | "closed";

function emptyForm(): LessonPurchaseData {
  return {
    lessonType: "",
    parentName: "",
    email: "",
    phone: "",
    childFirstName: "",
    childBirthYear: "",
    preferredTimes: "",
    emergencyName: "",
    emergencyPhone: "",
    allergies: "",
    notes: "",
    smsConsent: false,
  };
}

export default function LessonPurchaseForm() {
  const [form, setForm] = useState<LessonPurchaseData>(emptyForm);
  const [errors, setErrors] = useState<LessonPurchaseErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const [waiverNeeded, setWaiverNeeded] = useState(false);

  function update<K extends keyof LessonPurchaseData>(
    field: K,
    value: LessonPurchaseData[K],
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
    const allErrors = validateLessonPurchase(form);
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
      const res = await fetch("/api/checkout-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
          Online lesson booking isn&rsquo;t open just yet
        </p>
        <p className="text-ngpa-white/70 text-sm mt-2">
          Text Coach Sam at{" "}
          <a
            href="tel:+13013254731"
            className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
          >
            301-325-4731
          </a>{" "}
          and he&rsquo;ll get your lesson scheduled.
        </p>
      </div>
    );
  }

  const lessonTypes: LessonType[] = ["private", "group"];

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
          <legend className={labelClass}>Which lesson?</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="lessonType">
            {lessonTypes.map((t) => {
              const product = LESSON_PRODUCTS[t];
              const selected = form.lessonType === t;
              return (
                <label
                  key={t}
                  className={`relative cursor-pointer rounded-xl border p-4 transition-all ${
                    selected
                      ? "border-ngpa-teal bg-ngpa-teal/10"
                      : "border-ngpa-slate/60 bg-ngpa-deep/60 hover:border-ngpa-teal/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="lessonType"
                    value={t}
                    checked={selected}
                    onChange={() => update("lessonType", t)}
                    className="sr-only"
                  />
                  <span className="font-heading font-bold text-ngpa-white">
                    {product.title}
                  </span>
                  <span className="block text-ngpa-teal font-bold mt-1">
                    ${LESSON_PRICE_USD}
                    <span className="text-ngpa-white/60 font-normal text-sm">
                      {" "}
                      / hour
                    </span>
                  </span>
                  <span className="block text-xs text-ngpa-white/60 mt-1">
                    {product.priceNote}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.lessonType && (
            <p className={errorClass}>{errors.lessonType}</p>
          )}
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="parentName">
              Parent name
            </label>
            <input
              id="parentName"
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
            <label className={labelClass} htmlFor="email">
              Email
            </label>
            <input
              id="email"
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
            <label className={labelClass} htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              className={inputClass}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              autoComplete="tel"
            />
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>
          <div>
            <label className={labelClass} htmlFor="childFirstName">
              Child&rsquo;s first name
            </label>
            <input
              id="childFirstName"
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
            <label className={labelClass} htmlFor="childBirthYear">
              Child&rsquo;s birth year
            </label>
            <input
              id="childBirthYear"
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
            <label className={labelClass} htmlFor="preferredTimes">
              When are you generally free?
            </label>
            <input
              id="preferredTimes"
              className={inputClass}
              value={form.preferredTimes}
              onChange={(e) => update("preferredTimes", e.target.value)}
              placeholder="e.g. Tue/Thu after 5pm"
            />
            {errors.preferredTimes && (
              <p className={errorClass}>{errors.preferredTimes}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="emergencyName">
              Emergency contact name
            </label>
            <input
              id="emergencyName"
              className={inputClass}
              value={form.emergencyName}
              onChange={(e) => update("emergencyName", e.target.value)}
            />
            {errors.emergencyName && (
              <p className={errorClass}>{errors.emergencyName}</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="emergencyPhone">
              Emergency contact phone
            </label>
            <input
              id="emergencyPhone"
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

        <div className="mb-4">
          <label className={labelClass} htmlFor="allergies">
            Allergies / medical notes{" "}
            <span className="font-normal text-ngpa-white/50">(optional)</span>
          </label>
          <input
            id="allergies"
            className={inputClass}
            value={form.allergies}
            onChange={(e) => update("allergies", e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className={labelClass} htmlFor="notes">
            Anything the coach should know?{" "}
            <span className="font-normal text-ngpa-white/50">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            className={inputClass}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Experience level, goals, what they want to work on…"
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

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors text-base shadow-xl shadow-ngpa-teal/20 min-h-[52px] disabled:opacity-60"
        >
          {status === "redirecting"
            ? "Taking you to checkout…"
            : busy
              ? "Working…"
              : `Continue to payment — $${LESSON_PRICE_USD}`}
        </button>
        <p className="text-xs text-ngpa-white/50 text-center mt-3">
          You&rsquo;ll pay securely with Stripe. A coach will text you within
          one business day to lock in the hour.
        </p>
      </form>
    </>
  );
}
