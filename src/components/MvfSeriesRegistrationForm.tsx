"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InlineWaiverStep from "@/components/InlineWaiverStep";
import EmailTypoHint from "@/components/EmailTypoHint";
import { submissionKeyFor } from "@/lib/submission-key";
import { isWaiverRequired } from "@/lib/waiver-required";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import { validateSeriesRegistration, type SeriesDivision, type SeriesRelease, type SeriesRegistration } from "@/data/mvf-series-registration";
import type { MvfJuniorSeriesEvent } from "@/data/mvf-junior-series";

// MVF junior series sign-up form. Same steps, layout and copy as the
// October 24 tournament form (MvfJuniorTournamentForm; Sam 2026-10-30:
// "mirror the last tournament registration flow"): division cards, resident
// cards with the price on each, parent and player fields, the one-time waiver
// signed in place, then "Continue to payment". It still posts to the series
// service, which owns price, capacity, waiver and invoice checks.
//
// The submission id follows the form's content, as on October 24: a retry of
// the same details (a dropped connection, the resubmit after the inline
// waiver) reuses its id and gets the same invoice; an edit starts a new one.

type Fields = Omit<SeriesRegistration, "submissionId">;
type FormStatus = "idle" | "submitting" | "redirecting" | "error";

const FIELD_ORDER = ["division", "resident", "parentName", "email", "phone", "childFirstName", "childLastName", "childDob", "emergencyName", "emergencyPhone", "allergies", "smsConsent", "policyAccepted"] as const;

function shiftDate(iso: string, years: number, days = 0): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y + years, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Date-of-birth picker hints for a bracket; the server re-checks the age. */
export function seriesDobBounds(release: SeriesRelease, division: SeriesDivision): { min: string; max: string } {
  const { minAge, maxAge } = release.eligibility[division];
  return { min: shiftDate(release.date, -(maxAge + 1), 1), max: shiftDate(release.date, -minAge) };
}

function fieldId(field: string): string {
  return field === "division" ? "series-division-12u" : field === "resident" ? "series-resident-yes" : `series-${field}`;
}

export default function MvfSeriesRegistrationForm({ release, event }: { release: SeriesRelease; event: MvfJuniorSeriesEvent }) {
  const router = useRouter();
  const [form, setForm] = useState<Fields>({
    division: "12u", resident: true, parentName: "", email: "", phone: "",
    childFirstName: "", childLastName: "", childDob: "", emergencyName: "", emergencyPhone: "",
    allergies: "", smsConsent: false, policyAccepted: false, revision: release.revision,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const [waiverNeeded, setWaiverNeeded] = useState(false);
  const submissionKeys = useRef(new Map<string, string>());
  const sending = useRef(false);

  const price = form.resident ? event.prices.residentUsd : event.prices.nonresidentUsd;
  const dobBounds = seriesDobBounds(release, form.division);
  const when = `${event.dates[0].label} · ${release.startTime}–${release.endTime} ET · ${event.venue.name}`;

  function update<K extends keyof Fields>(field: K, value: Fields[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function showErrors(next: Record<string, string>) {
    setErrors(next);
    const first = FIELD_ORDER.find((field) => next[field]);
    if (first) document.getElementById(fieldId(first))?.focus();
  }

  function payload(): SeriesRegistration {
    return { ...form, submissionId: submissionKeyFor(submissionKeys.current, form) };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const request = payload();
    const allErrors = validateSeriesRegistration(request, release);
    if (Object.keys(allErrors).length > 0) {
      showErrors(allErrors);
      return;
    }
    await startCheckout(request);
  }

  async function startCheckout(request: SeriesRegistration) {
    if (sending.current) return;
    sending.current = true;
    setServerError("");
    setStatus("submitting");
    try {
      const res = await fetch(`/api/mvf-series/${release.event}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await res.json().catch(() => ({}));
      if (isWaiverRequired(res.status, data)) {
        setWaiverNeeded(true);
        setStatus("idle");
        return;
      }
      if (res.ok && typeof data.receiptUrl === "string" && data.receiptUrl.startsWith(`/mvf-junior-tournament/${release.event}/status#receipt=`)) {
        setStatus("redirecting");
        // The invoice is emailed too; the status page shows it and a
        // Pay-the-entry-fee button that points at the hosted invoice.
        router.push(data.receiptUrl);
        return;
      }
      if (data.errors) {
        showErrors(data.errors);
        setStatus("error");
        return;
      }
      setServerError(
        data.code === "full" ? "This division is full. Text Coach Sam at 301-325-4731 for options; no invoice was created."
          : data.code === "duplicate" || data.code === "request_conflict" ? "This player already has a registration for this tournament. Check your invoice email, or text Coach Sam at 301-325-4731 before submitting again."
            : data.code === "registration_closed" ? "Registration for this tournament is closed."
              : "We couldn't finish your registration. Try again with these same details, and check your invoice email before submitting another form.",
      );
      setStatus("error");
    } catch {
      setServerError("The connection dropped. Try again with these same details, and check your invoice email before submitting another form.");
      setStatus("error");
    } finally {
      sending.current = false;
    }
  }

  const inputClass =
    "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
  const labelClass = "block font-heading text-sm font-bold text-ngpa-white mb-1.5";
  const errorClass = "text-ngpa-red text-sm mt-1.5";
  const busy = status === "submitting" || status === "redirecting";

  const textField = (field: "parentName" | "email" | "phone" | "childFirstName" | "childLastName" | "emergencyName" | "emergencyPhone", label: string, type = "text", autoComplete?: string) => (
    <div>
      <label className={labelClass} htmlFor={fieldId(field)}>{label}</label>
      <input
        id={fieldId(field)}
        type={type}
        className={inputClass}
        value={form[field]}
        maxLength={field === "email" ? 254 : 100}
        onChange={(e) => update(field, e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={!!errors[field]}
      />
      {field === "email" && <EmailTypoHint email={form.email} onApply={(fixed) => update("email", fixed)} />}
      {errors[field] && <p className={errorClass}>{errors[field]}</p>}
    </div>
  );

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
            void startCheckout(payload());
          }}
          onCancel={() => setWaiverNeeded(false)}
        />
      )}
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="Tournament registration"
        className={`bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20${waiverNeeded ? " hidden" : ""}`}
      >
        {serverError && (
          <div role="alert" className="bg-ngpa-red/10 border border-ngpa-red/30 rounded-lg p-4 mb-6">
            <p className="text-ngpa-red text-sm font-medium">{serverError}</p>
          </div>
        )}

        <fieldset className="mb-6">
          <legend className={labelClass}>Which division?</legend>
          <p className="text-sm text-ngpa-white/70 mb-3">{when}</p>
          <div className="grid grid-cols-1 gap-3">
            {event.divisions.map((option) => {
              const selected = form.division === option.slug;
              const ages = release.eligibility[option.slug];
              return (
                <label
                  key={option.slug}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${selected ? "border-ngpa-teal bg-ngpa-teal/10" : "border-ngpa-slate/60 bg-ngpa-deep/60 hover:border-ngpa-teal/50"}`}
                >
                  <input
                    id={`series-division-${option.slug}`}
                    type="radio"
                    name="division"
                    value={option.slug}
                    checked={selected}
                    onChange={() => update("division", option.slug)}
                    className="sr-only"
                  />
                  <span className="font-heading font-bold text-ngpa-white">{option.label}</span>
                  <span className="block text-sm text-ngpa-teal-bright font-bold mt-0.5">
                    Ages {ages.minAge}–{ages.maxAge}
                  </span>
                  <span className="block text-sm text-ngpa-white/65 mt-1">
                    Max {option.capacity} players
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-sm text-ngpa-white/70 mt-3">{release.eligibilityText}</p>
          {errors.division && <p className={errorClass}>{errors.division}</p>}
        </fieldset>

        <fieldset className="mb-6">
          <legend className={labelClass}>Are you a Montgomery Village resident?</legend>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: true, label: "Yes, resident", price: event.prices.residentUsd },
              { value: false, label: "No, non-resident", price: event.prices.nonresidentUsd },
            ] as const).map((option) => {
              const selected = form.resident === option.value;
              return (
                <label
                  key={option.label}
                  className={`cursor-pointer rounded-xl border p-4 transition-all text-center ${selected ? "border-ngpa-teal bg-ngpa-teal/10" : "border-ngpa-slate/60 bg-ngpa-deep/60 hover:border-ngpa-teal/50"}`}
                >
                  <input
                    id={`series-resident-${option.value ? "yes" : "no"}`}
                    type="radio"
                    name="resident"
                    value={option.value ? "yes" : "no"}
                    checked={selected}
                    onChange={() => update("resident", option.value)}
                    className="sr-only"
                  />
                  <span className="font-heading font-bold text-ngpa-white block">{option.label}</span>
                  <span className="block text-sm text-ngpa-teal-bright font-bold mt-0.5">${option.price}</span>
                </label>
              );
            })}
          </div>
          {errors.resident && <p className={errorClass}>{errors.resident}</p>}
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {textField("parentName", "Parent name", "text", "name")}
          {textField("email", "Email", "email", "email")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {textField("phone", "Phone", "tel", "tel")}
          {textField("childFirstName", "Child’s first name")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {textField("childLastName", "Child’s last name")}
          <div>
            <label className={labelClass} htmlFor="series-childDob">Child&rsquo;s date of birth</label>
            <input
              id="series-childDob"
              type="date"
              min={dobBounds.min}
              max={dobBounds.max}
              className={inputClass}
              value={form.childDob}
              onChange={(e) => update("childDob", e.target.value)}
              aria-invalid={!!errors.childDob}
            />
            {errors.childDob && <p className={errorClass}>{errors.childDob}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {textField("emergencyName", "Emergency contact name")}
          {textField("emergencyPhone", "Emergency contact phone", "tel")}
        </div>

        <div className="mb-6">
          <label className={labelClass} htmlFor="series-allergies">
            Allergies / medical notes <span className="font-normal text-ngpa-white/50">(optional)</span>
          </label>
          <input
            id="series-allergies"
            className={inputClass}
            value={form.allergies}
            maxLength={480}
            onChange={(e) => update("allergies", e.target.value)}
          />
          {errors.allergies && <p className={errorClass}>{errors.allergies}</p>}
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            id="series-smsConsent"
            type="checkbox"
            checked={form.smsConsent}
            onChange={(e) => update("smsConsent", e.target.checked)}
            className="mt-1 h-4 w-4 accent-teal-400"
          />
          <span className="text-xs text-ngpa-white/60 leading-relaxed">{SMS_CONSENT_TEXT}</span>
        </label>
        {errors.smsConsent && <p className={errorClass}>{errors.smsConsent}</p>}

        <div className="bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl p-4 mb-4 space-y-1">
          <p className="text-sm text-ngpa-white/80">
            <strong className="text-ngpa-white">{release.cancellationPolicy}</strong> {release.rainPolicy}
          </p>
          <p className="text-sm text-ngpa-white/70">{release.minimumEnrollmentPolicy}</p>
          <p className="text-sm text-ngpa-white/70">
            We&rsquo;ll email you an invoice, due in {release.invoiceDueDays} days. Your player&rsquo;s spot is confirmed once it&rsquo;s paid.
          </p>
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            id="series-policyAccepted"
            type="checkbox"
            checked={form.policyAccepted}
            onChange={(e) => update("policyAccepted", e.target.checked)}
            className="mt-1 h-4 w-4 accent-teal-400"
          />
          <span className="text-sm text-ngpa-white/80">I am the parent or guardian and accept these event policies.</span>
        </label>
        {errors.policyAccepted && <p className={`${errorClass} -mt-4 mb-6`}>{errors.policyAccepted}</p>}
        {errors.revision && <p className={`${errorClass} mb-6`}>{errors.revision}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors text-base shadow-xl shadow-ngpa-teal/20 min-h-[52px] disabled:opacity-60"
        >
          {status === "redirecting" ? "Taking you to checkout…" : busy ? "Working…" : `Continue to payment — $${price}`}
        </button>
      </form>
    </>
  );
}
