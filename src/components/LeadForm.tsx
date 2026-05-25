"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  LeadFormData,
  LeadValidationErrors,
} from "@/lib/validate-lead";
import { MAX_KIDS_PER_SUBMISSION, validateLeadForm } from "@/lib/validate-lead";
import { trackEvent, getVisitorIdForForm, getUtm } from "@/lib/funnelClient";
import { site } from "@/data/site";

const AGE_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 6); // 6-16 (NGA strict)

type FormStatus = "idle" | "submitting" | "success" | "error";

type KidDraft = { name: string; age: string };

const emptyKid = (): KidDraft => ({ name: "", age: "" });

type TrackingContext = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
};

interface LeadFormProps {
  submitLabel?: string;
}

export default function LeadForm({
  submitLabel = "Book my free evaluation",
}: LeadFormProps = {}) {
  const [parentName, setParentName] = useState("");
  const [contact, setContact] = useState("");
  const [kids, setKids] = useState<KidDraft[]>([emptyKid()]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<LeadValidationErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const trackingRef = useRef<TrackingContext>({});
  const startedFiredRef = useRef(false);

  // Capture attribution context once on mount.
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

  function buildDraft(): Partial<LeadFormData> {
    return {
      parentName,
      contact,
      kids: kids.map((k) => ({ name: k.name, age: Number(k.age) })),
      notes,
    };
  }

  function markStarted() {
    if (!startedFiredRef.current) {
      startedFiredRef.current = true;
      trackEvent("lead_form_started", {
        interest: "free_evaluation",
        page: window.location.pathname,
      });
    }
  }

  function clearError(key: string) {
    if (!errors[key]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function updateKid(index: number, field: keyof KidDraft, value: string) {
    setKids((prev) => prev.map((k, i) => (i === index ? { ...k, [field]: value } : k)));
    clearError(`kids.${index}.${field}`);
    if (index === 0 && field === "age") clearError("childAge"); // legacy alias
    if (value) markStarted();
  }

  function addKid() {
    if (kids.length >= MAX_KIDS_PER_SUBMISSION) return;
    setKids((prev) => [...prev, emptyKid()]);
  }

  function removeKid(index: number) {
    if (kids.length <= 1) return;
    setKids((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => {
      const next: LeadValidationErrors = {};
      for (const [key, val] of Object.entries(prev)) {
        if (key === `kids.${index}.name` || key === `kids.${index}.age`) continue;
        next[key] = val;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const draft = buildDraft();
    const allErrors = validateLeadForm(draft);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      // Focus the first invalid field — translate kids.<i>.<f> back to DOM id.
      const firstKey = Object.keys(allErrors)[0];
      const focusId = firstKey.startsWith("kids.")
        ? firstKey
            .replace(/^kids\.(\d+)\.(name|age)$/, (_m, i, f) => `kid${i}${f}`)
        : firstKey === "childAge"
          ? "childAge"
          : firstKey;
      document.getElementById(focusId)?.focus();
      return;
    }

    setStatus("submitting");

    const payload = {
      parentName,
      contact,
      kids: kids.map((k) => ({ name: k.name.trim(), age: Number(k.age) })),
      notes: notes || undefined,
      ...trackingRef.current,
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
      setServerError(err instanceof Error ? err.message : "Something went wrong");
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
          Thanks, {parentName.split(" ")[0]}!
        </h3>
        <p className="text-ngpa-white/75 text-lg mb-6 max-w-md mx-auto">
          We&rsquo;ll reach out within 24 hours to schedule a free evaluation
          and figure out the right next step &mdash; a group level, or private
          lessons if your child is still learning to rally.
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
            value={parentName}
            onChange={(e) => {
              setParentName(e.target.value);
              clearError("parentName");
              if (e.target.value) markStarted();
            }}
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
            value={contact}
            onChange={(e) => {
              setContact(e.target.value);
              clearError("contact");
              if (e.target.value) markStarted();
            }}
          />
          {errors.contact && <p className={errorClass}>{errors.contact}</p>}
        </div>

        {/* Kids */}
        <div className="space-y-3">
          {kids.map((kid, i) => (
            <div
              key={i}
              className={
                i === 0
                  ? ""
                  : "border-t border-ngpa-slate/40 pt-3"
              }
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <label htmlFor={`kid${i}name`} className={labelClass.replace("mb-1.5", "mb-0")}>
                  {kids.length === 1 ? "About your child" : `Child ${i + 1}`}
                </label>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => removeKid(i)}
                    className="text-ngpa-white/55 hover:text-ngpa-red text-xs font-bold uppercase tracking-wide transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    id={`kid${i}name`}
                    type="text"
                    autoComplete="off"
                    className={inputClass}
                    placeholder="First name"
                    value={kid.name}
                    onChange={(e) => updateKid(i, "name", e.target.value)}
                  />
                  {errors[`kids.${i}.name`] && (
                    <p className={errorClass}>{errors[`kids.${i}.name`]}</p>
                  )}
                </div>
                <div>
                  <select
                    id={i === 0 ? "childAge" : `kid${i}age`}
                    className={selectClass}
                    value={kid.age}
                    onChange={(e) => updateKid(i, "age", e.target.value)}
                  >
                    <option value="">Select age</option>
                    {AGE_OPTIONS.map((age) => (
                      <option key={age} value={String(age)}>
                        {age} years old
                      </option>
                    ))}
                  </select>
                  {(errors[`kids.${i}.age`] ||
                    (i === 0 && errors.childAge)) && (
                    <p className={errorClass}>
                      {errors[`kids.${i}.age`] || errors.childAge}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {kids.length < MAX_KIDS_PER_SUBMISSION && (
            <button
              type="button"
              onClick={addKid}
              className="text-ngpa-teal hover:text-ngpa-teal-bright text-sm font-bold transition-colors"
            >
              + Add another child
            </button>
          )}
          {errors.kids && <p className={errorClass}>{errors.kids}</p>}
        </div>

        {/* Notes — optional self-identified intent */}
        <div>
          <label htmlFor="notes" className={labelClass}>
            Anything we should know?{" "}
            <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            className={inputClass}
            placeholder="Can your child rally yet? Looking for group or private? Anything else…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
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
          submitLabel
        )}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        No commitment required. We&rsquo;ll never share your info.
      </p>
    </form>
  );
}
