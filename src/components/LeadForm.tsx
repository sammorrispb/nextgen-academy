"use client";

import { useEffect, useRef, useState } from "react";
import type { LeadFormData, LeadValidationErrors } from "@/lib/validate-lead";
import { validateLeadForm } from "@/lib/validate-lead";
import { trackEvent, getVisitorIdForForm, getUtm } from "@/lib/funnelClient";
import { site } from "@/data/site";

const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 4); // 4-16

type FormStatus = "idle" | "submitting" | "success" | "error";

const emptyForm: LeadFormData = {
  parentName: "",
  contact: "",
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
};

export default function LeadForm() {
  const [form, setForm] = useState<LeadFormData>(emptyForm);
  const [errors, setErrors] = useState<LeadValidationErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const trackingRef = useRef<TrackingContext>({});
  const startedFiredRef = useRef(false);

  // Capture attribution context once on mount — URL params + referrer.
  // Falls back to the sessionStorage stash (populated by UtmCapture on the
  // landing page) so a user who lands with UTM and then navigates can still
  // submit the form with full attribution.
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
    };
    trackingRef.current = ctx;
  }, []);

  // Only the 3 user-facing fields can be edited via the form UI or produce
  // validation errors. Tracking fields are populated server-side from state.
  type EditableField = "parentName" | "contact" | "childAge";

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
      trackEvent("lead_form_started", {
        interest: "free_evaluation",
        page: window.location.pathname,
      });
    }
  }

  function handleBlur(field: EditableField) {
    const fieldErrors = validateLeadForm(form);
    if (fieldErrors[field]) {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const allErrors = validateLeadForm(form);
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
      const res = await fetch("/api/lead", {
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

      trackEvent("lead_form_submitted", {
        interest: "free_evaluation",
        page: window.location.pathname,
      });
      // Legacy event kept for back-compat with any consumers that still
      // listen for `lead_form` with action="submitted".
      trackEvent("lead_form", {
        action: "submitted",
        interest: "free_evaluation",
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
          Thanks, {form.parentName.split(" ")[0]}!
        </h3>
        <p className="text-ngpa-white/75 text-lg mb-6 max-w-md mx-auto">
          We&rsquo;ll reach out within 24 hours to help find the right group for
          your child.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={`tel:${site.phone.replace(/\D/g, "")}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Call or Text Sam
          </a>
          <a
            href="/schedule"
            className="inline-flex items-center justify-center px-6 py-3 border-2 border-ngpa-teal text-ngpa-teal font-bold rounded-full hover:bg-ngpa-teal hover:text-ngpa-deep transition-colors min-h-[48px]"
          >
            View Schedule
          </a>
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

        {/* Contact (email or phone) */}
        <div>
          <label htmlFor="contact" className={labelClass}>
            Email or Phone
          </label>
          <input
            id="contact"
            type="text"
            autoComplete="email"
            className={inputClass}
            placeholder="you@email.com or (301) 555-1234"
            value={form.contact}
            onChange={(e) => updateField("contact", e.target.value)}
            onBlur={() => handleBlur("contact")}
          />
          {errors.contact && <p className={errorClass}>{errors.contact}</p>}
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
          {errors.childAge && (
            <p className={errorClass}>{errors.childAge}</p>
          )}
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
            Sending...
          </span>
        ) : (
          "Get Started"
        )}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        No commitment required. We&rsquo;ll never share your info.
      </p>
    </form>
  );
}
