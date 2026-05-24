"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  NewsletterFormData,
  NewsletterValidationErrors,
} from "@/lib/validate-newsletter";
import { validateNewsletterForm } from "@/lib/validate-newsletter";
import { trackEvent, getVisitorIdForForm, getUtm } from "@/lib/funnelClient";

const AGE_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 7); // 7-17 (NGA 8-16 + 1yr slack)

type FormStatus = "idle" | "submitting" | "success" | "error";

const emptyForm: NewsletterFormData = {
  parentName: "",
  email: "",
  childAge: "",
};

type TrackingContext = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
  /** Signed token from /newsletter?ref=<...> — attributes the signup to a referrer. */
  ref?: string;
};

interface NewsletterFormProps {
  submitLabel?: string;
}

export default function NewsletterForm({
  submitLabel = "Join the Free Newsletter →",
}: NewsletterFormProps = {}) {
  const [form, setForm] = useState<NewsletterFormData>(emptyForm);
  const [errors, setErrors] = useState<NewsletterValidationErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const trackingRef = useRef<TrackingContext>({});
  const startedFiredRef = useRef(false);

  // Capture attribution context once on mount — URL params + referrer, with a
  // fallback to the sessionStorage stash populated by UtmCapture.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stashed = getUtm();
    const ctx: TrackingContext = {
      utm_source: params.get("utm_source") ?? stashed.utm_source ?? undefined,
      utm_medium: params.get("utm_medium") ?? stashed.utm_medium ?? undefined,
      utm_campaign:
        params.get("utm_campaign") ?? stashed.utm_campaign ?? undefined,
      utm_content: params.get("utm_content") ?? undefined,
      utm_term: params.get("utm_term") ?? undefined,
      referrer: document.referrer || undefined,
      landing_page: window.location.href,
      ref: params.get("ref") ?? undefined,
    };
    trackingRef.current = ctx;
  }, []);

  type EditableField = "parentName" | "email" | "childAge";

  function updateField(field: EditableField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (!startedFiredRef.current && value) {
      startedFiredRef.current = true;
      trackEvent("newsletter_signup_started", {
        interest: "newsletter",
        page: window.location.pathname,
      });
    }
  }

  function handleBlur(field: EditableField) {
    const fieldErrors = validateNewsletterForm(form);
    if (fieldErrors[field]) {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const allErrors = validateNewsletterForm(form);
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
      const res = await fetch("/api/newsletter", {
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

      trackEvent("newsletter_signup_submitted", {
        interest: "newsletter",
        page: window.location.pathname,
      });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setStatus("error");
    }
  }

  // ─── Success State ────────────────────────────
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
          You&rsquo;re in, {form.parentName.split(" ")[0]}!
        </h3>
        <p className="text-ngpa-white/75 text-lg mb-6 max-w-md mx-auto">
          Check your inbox for a welcome note. We&rsquo;ll send you where to play
          and how your kid gets better &mdash; nothing else.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
          >
            See this week&rsquo;s sessions
          </Link>
        </div>
      </div>
    );
  }

  // ─── Form ─────────────────────────────────────
  const inputClass =
    "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
  const selectClass = `${inputClass} appearance-none cursor-pointer`;
  const labelClass =
    "block font-heading text-sm font-bold text-ngpa-white mb-1.5";
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
        {/* Parent Name */}
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

        {/* Email */}
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

        {/* Child's Age */}
        <div>
          <label htmlFor="childAge" className={labelClass}>
            Child&rsquo;s Age
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

      {/* Submit */}
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
            Joining...
          </span>
        ) : (
          submitLabel
        )}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        No spam. Just where to play and how your kid gets better. Unsubscribe
        anytime.
      </p>
    </form>
  );
}
