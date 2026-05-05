"use client";

import { useEffect, useRef, useState } from "react";
import {
  validateSchoolsLeadForm,
  ORG_TYPE_LABELS,
  FREQUENCY_LABELS,
  STUDENT_BUCKET_LABELS,
  AGE_RANGE_LABELS,
  type SchoolsLeadFormData,
  type SchoolsLeadValidationErrors,
  type OrgType,
  type Frequency,
  type StudentCountBucket,
  type AgeRange,
} from "@/lib/validate-schools";
import { trackEvent, getVisitorIdForForm, getUtm } from "@/lib/funnelClient";
import { site } from "@/data/site";

type FormStatus = "idle" | "submitting" | "success" | "error";

const emptyForm: SchoolsLeadFormData = {
  orgName: "",
  contactName: "",
  email: "",
  phone: "",
  role: "",
  orgType: "",
  studentCount: "",
  ageRange: "",
  frequency: "",
  preferredDates: "",
  location: "",
  notes: "",
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

type EditableField =
  | "orgName"
  | "contactName"
  | "email"
  | "phone"
  | "role"
  | "orgType"
  | "studentCount"
  | "ageRange"
  | "frequency"
  | "preferredDates"
  | "location"
  | "notes";

export default function SchoolsLeadForm() {
  const [form, setForm] = useState<SchoolsLeadFormData>(emptyForm);
  const [errors, setErrors] = useState<SchoolsLeadValidationErrors>({});
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
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof SchoolsLeadValidationErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof SchoolsLeadValidationErrors];
        return next;
      });
    }
    if (!startedFiredRef.current && value) {
      startedFiredRef.current = true;
      trackEvent("lead_form_started", {
        interest: "schools_inquiry",
        page: window.location.pathname,
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const allErrors = validateSchoolsLeadForm(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const firstErrorField = Object.keys(allErrors)[0];
      document.getElementById(firstErrorField)?.focus();
      return;
    }

    setStatus("submitting");

    const payload = {
      ...form,
      ...trackingRef.current,
      visitor_id: getVisitorIdForForm() || null,
    };

    try {
      const res = await fetch("/api/schools-lead", {
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
        interest: "schools_inquiry",
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
      <div className="bg-ngpa-panel rounded-2xl p-8 sm:p-10 border border-ngpa-slate text-center">
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
        <h3 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-3">
          Thanks, {form.contactName.split(" ")[0]}!
        </h3>
        <p className="text-ngpa-muted text-lg mb-2 max-w-md mx-auto">
          We&rsquo;ll review your request and follow up within 1 business day
          with availability and a quote.
        </p>
        <p className="text-ngpa-muted text-sm mb-6 max-w-md mx-auto">
          Need to talk sooner? Text Sam directly at{" "}
          <a
            href={`tel:${site.phone.replace(/\D/g, "")}`}
            className="text-ngpa-lime font-semibold hover:underline"
          >
            {site.phone}
          </a>
          .
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full bg-ngpa-slate border border-ngpa-slate rounded-lg px-4 py-3 text-ngpa-white placeholder:text-ngpa-muted/50 focus:outline-none focus:ring-2 focus:ring-ngpa-lime focus:border-transparent transition-colors";
  const selectClass = `${inputClass} appearance-none cursor-pointer`;
  const labelClass =
    "block font-heading text-sm font-bold text-ngpa-white mb-1";
  const errorClass = "text-ngpa-red text-sm mt-1";

  const orgTypeOptions = Object.entries(ORG_TYPE_LABELS) as [
    OrgType,
    string,
  ][];
  const frequencyOptions = Object.entries(FREQUENCY_LABELS) as [
    Frequency,
    string,
  ][];
  const studentBucketOptions = Object.entries(STUDENT_BUCKET_LABELS) as [
    StudentCountBucket,
    string,
  ][];
  const ageRangeOptions = Object.entries(AGE_RANGE_LABELS) as [
    AgeRange,
    string,
  ][];

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="orgName" className={labelClass}>
            Organization
          </label>
          <input
            id="orgName"
            type="text"
            className={inputClass}
            placeholder="School, rec center, or camp name"
            value={form.orgName}
            onChange={(e) => updateField("orgName", e.target.value)}
          />
          {errors.orgName && <p className={errorClass}>{errors.orgName}</p>}
        </div>

        <div>
          <label htmlFor="contactName" className={labelClass}>
            Your Name
          </label>
          <input
            id="contactName"
            type="text"
            autoComplete="name"
            className={inputClass}
            placeholder="First and last"
            value={form.contactName}
            onChange={(e) => updateField("contactName", e.target.value)}
          />
          {errors.contactName && (
            <p className={errorClass}>{errors.contactName}</p>
          )}
        </div>

        <div>
          <label htmlFor="role" className={labelClass}>
            Role <span className="text-ngpa-muted font-normal">(optional)</span>
          </label>
          <input
            id="role"
            type="text"
            className={inputClass}
            placeholder="e.g. Athletic Director"
            value={form.role}
            onChange={(e) => updateField("role", e.target.value)}
          />
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
            placeholder="you@org.org"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone{" "}
            <span className="text-ngpa-muted font-normal">(optional)</span>
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

        <div>
          <label htmlFor="orgType" className={labelClass}>
            Organization Type
          </label>
          <select
            id="orgType"
            className={selectClass}
            value={form.orgType}
            onChange={(e) => updateField("orgType", e.target.value)}
          >
            <option value="">Select…</option>
            {orgTypeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.orgType && <p className={errorClass}>{errors.orgType}</p>}
        </div>

        <div>
          <label htmlFor="studentCount" className={labelClass}>
            Group Size
          </label>
          <select
            id="studentCount"
            className={selectClass}
            value={form.studentCount}
            onChange={(e) => updateField("studentCount", e.target.value)}
          >
            <option value="">Select…</option>
            {studentBucketOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.studentCount && (
            <p className={errorClass}>{errors.studentCount}</p>
          )}
        </div>

        <div>
          <label htmlFor="ageRange" className={labelClass}>
            Age / Grade Range
          </label>
          <select
            id="ageRange"
            className={selectClass}
            value={form.ageRange}
            onChange={(e) => updateField("ageRange", e.target.value)}
          >
            <option value="">Select…</option>
            {ageRangeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.ageRange && <p className={errorClass}>{errors.ageRange}</p>}
        </div>

        <div>
          <label htmlFor="frequency" className={labelClass}>
            Format
          </label>
          <select
            id="frequency"
            className={selectClass}
            value={form.frequency}
            onChange={(e) => updateField("frequency", e.target.value)}
          >
            <option value="">Select…</option>
            {frequencyOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.frequency && (
            <p className={errorClass}>{errors.frequency}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="preferredDates" className={labelClass}>
            Preferred Dates{" "}
            <span className="text-ngpa-muted font-normal">(optional)</span>
          </label>
          <input
            id="preferredDates"
            type="text"
            className={inputClass}
            placeholder="e.g. Week of July 14, or Tuesdays in October"
            value={form.preferredDates}
            onChange={(e) => updateField("preferredDates", e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="location" className={labelClass}>
            Location{" "}
            <span className="text-ngpa-muted font-normal">(optional)</span>
          </label>
          <input
            id="location"
            type="text"
            className={inputClass}
            placeholder="Facility name + city — or 'we have indoor courts'"
            value={form.location}
            onChange={(e) => updateField("location", e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="notes" className={labelClass}>
            Anything else?{" "}
            <span className="text-ngpa-muted font-normal">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={4}
            className={inputClass}
            placeholder="Goals, prior pickleball exposure, equipment on hand, COI requirements, budget, etc."
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 w-full px-8 py-4 bg-ngpa-lime text-ngpa-black font-heading font-bold text-lg rounded-full hover:bg-ngpa-cyan transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
            Sending…
          </span>
        ) : (
          "Request a Quote"
        )}
      </button>

      <p className="text-ngpa-muted text-xs text-center mt-3">
        We&rsquo;ll respond within 1 business day. No commitment.
      </p>
    </form>
  );
}
