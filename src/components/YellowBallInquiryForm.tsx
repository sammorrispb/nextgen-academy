"use client";

import { useRef, useState } from "react";
import { trackEvent, getVisitorIdForForm, getUtm } from "@/lib/funnelClient";

const AGE_OPTIONS = Array.from({ length: 8 }, (_, i) => i + 10); // 10-17

type FormStatus = "idle" | "submitting" | "success" | "error";

interface FormState {
  parentName: string;
  childName: string;
  age: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyForm: FormState = {
  parentName: "",
  childName: "",
  age: "",
  email: "",
  phone: "",
  notes: "",
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.parentName.trim()) errors.parentName = "Your name is required";
  if (!form.childName.trim()) errors.childName = "Your player's name is required";
  if (!form.age) errors.age = "Age is required";
  if (!form.email.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = "Enter a valid email";
  }
  if (!form.phone.trim()) {
    errors.phone = "Phone is required";
  } else if (form.phone.replace(/\D/g, "").length < 10) {
    errors.phone = "Enter a 10-digit phone";
  }
  return errors;
}

export default function YellowBallInquiryForm() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const startedFiredRef = useRef(false);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
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
        interest: "yellow_ball",
        page:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const allErrors = validate(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const first = Object.keys(allErrors)[0];
      document.getElementById(first)?.focus();
      return;
    }

    setStatus("submitting");

    const params = new URLSearchParams(window.location.search);
    const stashed = getUtm();

    try {
      const res = await fetch("/api/yellowball-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_name: form.parentName,
          child_name: form.childName,
          age: Number(form.age),
          contact_email: form.email,
          contact_phone: form.phone,
          notes: form.notes || undefined,
          landing_page: window.location.href,
          visitor_id: getVisitorIdForForm() || null,
          utm_source: params.get("utm_source") ?? stashed.utm_source ?? null,
          utm_medium: params.get("utm_medium") ?? stashed.utm_medium ?? null,
          utm_campaign:
            params.get("utm_campaign") ?? stashed.utm_campaign ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }
      setStatus("success");
      trackEvent("lead_form_submitted", {
        interest: "yellow_ball",
        page:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      // Legacy event kept for back-compat with any consumers that still
      // listen for the bespoke yellowball event.
      trackEvent("yellowball_lead_submitted", {
        child_age: Number(form.age),
        parent_name: form.parentName,
        source: "yellowball_inquiry",
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-ngpa-panel rounded-2xl p-8 sm:p-10 border border-ngpa-slate text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ngpa-skill-yellow/20 mb-6">
          <svg
            className="w-8 h-8 text-ngpa-skill-yellow"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-3">
          Got it, {form.parentName.split(" ")[0]}.
        </h2>
        <p className="text-ngpa-muted text-lg mb-6 max-w-md mx-auto">
          A coach will reach out within 24 hours to set up {form.childName.split(" ")[0]}&rsquo;s
          eval.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full bg-ngpa-slate border border-ngpa-slate rounded-lg px-4 py-3 text-ngpa-white placeholder:text-ngpa-muted/50 focus:outline-none focus:ring-2 focus:ring-ngpa-skill-yellow focus:border-transparent transition-colors";
  const selectClass = `${inputClass} appearance-none cursor-pointer`;
  const labelClass = "block font-heading text-sm font-bold text-ngpa-white mb-1";
  const errorClass = "text-ngpa-red text-sm mt-1";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-ngpa-panel rounded-2xl p-6 sm:p-8 border border-ngpa-slate"
    >
      {serverError && (
        <div className="bg-ngpa-red/10 border border-ngpa-red/30 rounded-lg p-4 mb-6">
          <p className="text-ngpa-red text-sm font-medium">{serverError}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="parentName" className={labelClass}>
            Your name
          </label>
          <input
            id="parentName"
            type="text"
            autoComplete="name"
            className={inputClass}
            value={form.parentName}
            onChange={(e) => updateField("parentName", e.target.value)}
          />
          {errors.parentName && <p className={errorClass}>{errors.parentName}</p>}
        </div>

        <div>
          <label htmlFor="childName" className={labelClass}>
            Your player&rsquo;s name
          </label>
          <input
            id="childName"
            type="text"
            className={inputClass}
            value={form.childName}
            onChange={(e) => updateField("childName", e.target.value)}
          />
          {errors.childName && <p className={errorClass}>{errors.childName}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="age" className={labelClass}>
              Age
            </label>
            <select
              id="age"
              className={selectClass}
              value={form.age}
              onChange={(e) => updateField("age", e.target.value)}
            >
              <option value="">Select age</option>
              {AGE_OPTIONS.map((age) => (
                <option key={age} value={String(age)}>
                  {age}
                </option>
              ))}
            </select>
            {errors.age && <p className={errorClass}>{errors.age}</p>}
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
              placeholder="(301) 555-1234"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>
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
          />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="notes" className={labelClass}>
            Tell us about their game{" "}
            <span className="text-ngpa-muted font-normal">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            className={inputClass}
            placeholder="Tournaments played, coaches, ratings, goals — anything helpful."
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 w-full px-8 py-4 bg-ngpa-skill-yellow text-ngpa-black font-heading font-bold text-lg rounded-full hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "submitting" ? "Sending…" : "Request an eval"}
      </button>

      <p className="text-ngpa-muted text-xs text-center mt-3">
        A coach will reach out within 24 hours.
      </p>
    </form>
  );
}
