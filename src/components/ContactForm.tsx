"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CONTACT_INTEREST_OPTIONS,
  interestRequiresChildAge,
  validateContactForm,
} from "@/lib/validate-contact";
import type {
  ContactFormData,
  ContactInterest,
  ContactValidationErrors,
} from "@/lib/validate-contact";
import { trackEvent, getVisitorIdForForm, getUtm } from "@/lib/funnelClient";
import { site } from "@/data/site";

const AGE_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 7); // 7-17

type FormStatus = "idle" | "submitting" | "success" | "error";

type EditableField = "name" | "email" | "phone" | "interest" | "childAge" | "message";

type TrackingContext = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
};

const emptyForm: ContactFormData = {
  name: "",
  email: "",
  phone: "",
  // Default to free evaluation so visitors arriving from the hero "Book a free
  // 30-min evaluation" CTA see the form pre-tuned to their intent.
  interest: "free-evaluation",
  childAge: "",
  message: "",
};

export default function ContactForm() {
  const [form, setForm] = useState<ContactFormData>(emptyForm);
  const [errors, setErrors] = useState<ContactValidationErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const trackingRef = useRef<TrackingContext>({});
  const startedFiredRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stashed = getUtm();
    trackingRef.current = {
      utm_source: params.get("utm_source") ?? stashed.utm_source ?? undefined,
      utm_medium: params.get("utm_medium") ?? stashed.utm_medium ?? undefined,
      utm_campaign:
        params.get("utm_campaign") ?? stashed.utm_campaign ?? undefined,
      utm_content: params.get("utm_content") ?? undefined,
      utm_term: params.get("utm_term") ?? undefined,
      referrer: document.referrer || undefined,
      landing_page: window.location.href,
    };
  }, []);

  function updateField(field: EditableField, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Wipe child age if the new interest no longer requires it, so a stale
      // selection doesn't ride along in the payload.
      if (field === "interest" && !interestRequiresChildAge(value)) {
        next.childAge = "";
      }
      return next;
    });
    if (errors[field]) {
      setErrors((prev) => {
        const out = { ...prev };
        delete out[field];
        return out;
      });
    }
    if (!startedFiredRef.current && value) {
      startedFiredRef.current = true;
      trackEvent("lead_form_started", {
        interest: "contact_form",
        page: window.location.pathname,
      });
    }
  }

  function handleBlur(field: EditableField) {
    if (field === "message") return;
    const fieldErrors = validateContactForm(form);
    if (fieldErrors[field]) {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const allErrors = validateContactForm(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const first = Object.keys(allErrors)[0];
      document.getElementById(first)?.focus();
      return;
    }

    setStatus("submitting");

    const payload: ContactFormData = {
      ...form,
      ...trackingRef.current,
      visitor_id: getVisitorIdForForm() || null,
    };
    if (!interestRequiresChildAge(form.interest)) {
      payload.childAge = "";
    }

    try {
      const res = await fetch("/api/contact", {
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
        interest: form.interest || "contact_form",
        page: window.location.pathname,
      });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-ngpa-panel/85 backdrop-blur rounded-2xl p-8 sm:p-10 border border-ngpa-slate/60 text-center">
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
          Thanks, {form.name.split(" ")[0]}!
        </h3>
        <p className="text-ngpa-white/75 text-lg mb-6 max-w-md mx-auto">
          We&rsquo;ll get back to you within 1 business day. If it&rsquo;s
          urgent, call or text Sam directly.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={`tel:${site.phone.replace(/\D/g, "")}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
              />
            </svg>
            Call or Text Sam
          </a>
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center px-6 py-3 border-2 border-ngpa-teal text-ngpa-teal font-bold rounded-full hover:bg-ngpa-teal hover:text-ngpa-deep transition-colors min-h-[48px]"
          >
            View Schedule
          </Link>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
  const selectClass = `${inputClass} appearance-none cursor-pointer`;
  const labelClass =
    "block font-heading text-sm font-bold text-ngpa-white mb-1.5";
  const errorClass = "text-ngpa-red text-sm mt-1.5";

  const showChildAge = interestRequiresChildAge(form.interest);

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
        <div>
          <label htmlFor="name" className={labelClass}>
            Your Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            className={inputClass}
            placeholder="First and last name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            onBlur={() => handleBlur("name")}
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>

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

        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone{" "}
            <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            className={inputClass}
            placeholder="(301) 555-1234"
            value={form.phone ?? ""}
            onChange={(e) => updateField("phone", e.target.value)}
            onBlur={() => handleBlur("phone")}
          />
          {errors.phone && <p className={errorClass}>{errors.phone}</p>}
        </div>

        <div>
          <label htmlFor="interest" className={labelClass}>
            I&rsquo;m interested in
          </label>
          <select
            id="interest"
            className={selectClass}
            value={form.interest}
            onChange={(e) =>
              updateField("interest", e.target.value as ContactInterest | "")
            }
            onBlur={() => handleBlur("interest")}
          >
            <option value="">Select an option</option>
            {CONTACT_INTEREST_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.interest && <p className={errorClass}>{errors.interest}</p>}
        </div>

        {showChildAge && (
          <div>
            <label htmlFor="childAge" className={labelClass}>
              Child&rsquo;s Age
            </label>
            <select
              id="childAge"
              className={selectClass}
              value={form.childAge ?? ""}
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
        )}

        <div>
          <label htmlFor="message" className={labelClass}>
            Your message{" "}
            <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <textarea
            id="message"
            rows={4}
            className={inputClass}
            placeholder="Anything else you'd like us to know — current skill, schedule, questions…"
            value={form.message ?? ""}
            onChange={(e) => updateField("message", e.target.value)}
            maxLength={1000}
          />
          {errors.message && <p className={errorClass}>{errors.message}</p>}
        </div>
      </div>

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
          "Send message"
        )}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        We&rsquo;ll reply within 1 business day. We&rsquo;ll never share your info.
      </p>
    </form>
  );
}
