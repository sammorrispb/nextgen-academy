"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  isCalendarDob,
  MVF_JUNIOR_TOURNAMENT_DATE_ISO,
  NONRESIDENT_PRICE_USD,
  RESIDENT_PRICE_USD,
} from "@/data/mvf-junior-tournament-2026";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import type { MvfJuniorTournamentData } from "@/lib/validate-mvf-junior-tournament";

const STORAGE_KEY = "nga.admin.mvf-registration.submission-id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INITIAL_FORM: MvfJuniorTournamentData = {
  division: "14u", resident: false, parentName: "", email: "", phone: "",
  childFirstName: "", childLastName: "", childDob: "", emergencyName: "",
  emergencyPhone: "", allergies: "", smsConsent: false,
};

interface Preview {
  previewToken: string;
  summary: {
    amountUsd: number; divisionLabel: string; childName: string; childDob: string;
    age: number; ageException: boolean; parentEmail: string;
  };
}
interface Receipt {
  completed: boolean; invoiceId: string; invoiceUrl: string | null;
  invoiceStatus: string; registrationSaved: boolean; rosterSynced: boolean;
  alreadySent: boolean;
}
type FieldErrors = Partial<Record<keyof MvfJuniorTournamentData | "ageExceptionApproved" | "ageExceptionReason", string>>;
type ApiResult = Partial<Preview & Receipt> & {
  ok?: boolean; error?: string; errors?: FieldErrors; waiverUrl?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Your admin sign-in has expired. Sign in again before continuing.",
  bad_origin: "This request could not be verified. Open this form on the NGA website and try again.",
  bad_input: "Check the highlighted details before previewing again.",
  not_configured: "Tournament registration is unavailable on this deployment. Contact the site administrator.",
  waiver_required: "The parent needs a signed NGA waiver under this email address before registration can continue.",
  waiver_unavailable: "The waiver could not be checked. Try previewing again in a moment.",
  wrong_stripe_account: "The payment account could not be verified. Contact the site administrator before continuing.",
  stripe_unavailable: "The payment service is unavailable. Retry this same registration in a moment.",
  preview_expired_or_changed: "The review expired or the details changed. Preview again before continuing.",
  registration_exists: "A registration already exists for this player. Review the existing registration before continuing.",
  registration_changed: "This attempt belongs to different registration details. Review the existing registration before continuing.",
  sold_out: "The tournament is full. Review the roster before adding another player.",
  capacity_unavailable: "Available spaces could not be confirmed. Try previewing again in a moment.",
  invoice_unavailable: "The invoice could not be confirmed. Retry this same registration to continue.",
  registration_ineligible: "This registration cannot continue. Check the player, date of birth and approved age exception.",
  request_failed: "Completion could not be confirmed. Retry this same registration to continue.",
};

const inputClass = "min-h-[48px] w-full rounded-xl border border-ngpa-slate/60 bg-ngpa-deep/60 px-4 py-3 text-base text-ngpa-white focus:border-ngpa-teal focus:outline-none focus:ring-2 focus:ring-ngpa-teal disabled:opacity-70";
const primaryButton = "btn btn-primary flex min-h-[48px] w-full items-center justify-center rounded-xl bg-ngpa-teal px-5 py-3 text-base font-bold text-ngpa-deep transition-colors hover:bg-ngpa-teal-bright disabled:cursor-wait disabled:opacity-50 sm:w-auto";
const secondaryButton = "btn btn-secondary flex min-h-[48px] w-full items-center justify-center rounded-xl border border-ngpa-slate bg-ngpa-panel px-5 py-3 text-base font-bold transition-colors hover:border-ngpa-teal disabled:opacity-50 sm:w-auto";

function eventAge(dob: string): number | null {
  if (!isCalendarDob(dob)) return null;
  const eventYear = Number(MVF_JUNIOR_TOURNAMENT_DATE_ISO.slice(0, 4));
  return eventYear - Number(dob.slice(0, 4)) -
    (dob.slice(5) > MVF_JUNIOR_TOURNAMENT_DATE_ISO.slice(5) ? 1 : 0);
}

function displayDob(dob: string): string {
  if (!isCalendarDob(dob)) return dob;
  return new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${dob}T00:00:00Z`));
}

export default function MvfRegistrationForm() {
  const [form, setForm] = useState<MvfJuniorTournamentData>({ ...INITIAL_FORM });
  const [ageExceptionApproved, setAgeExceptionApproved] = useState(false);
  const [ageExceptionReason, setAgeExceptionReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState<"preview" | "register" | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const submissionId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const reviewPanel = useRef<HTMLDivElement | null>(null);
  const age = eventAge(form.childDob);
  const exceptionNeeded = age !== null && age >= 15 && age <= 16;
  const detailsLocked = pending !== null || attempted;

  function invalidatePreview() {
    setPreview(null); setError(""); setErrorCode(""); setErrors({});
  }

  function update<K extends keyof MvfJuniorTournamentData>(key: K, value: MvfJuniorTournamentData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    invalidatePreview();
    if (key === "childDob") {
      setAgeExceptionApproved(false); setAgeExceptionReason("");
    }
  }

  function getSubmissionId(): string {
    if (submissionId.current) return submissionId.current;
    // Only an opaque operation ID belongs in storage. Family and medical fields
    // remain in memory; a reload requires re-entering the same details.
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    const id = saved && UUID_RE.test(saved) ? saved : window.crypto.randomUUID();
    window.sessionStorage.setItem(STORAGE_KEY, id);
    submissionId.current = id;
    return id;
  }

  async function submit(action: "preview" | "register") {
    if (inFlight.current || (action === "register" && !preview)) return;
    inFlight.current = true;
    setPending(action); setError(""); setErrorCode(""); setErrors({});
    let id: string;
    try { id = getSubmissionId(); }
    catch {
      setStorageFailed(true);
      setError("Allow this tab to use session storage before continuing so retries can safely resume the same registration.");
      setPending(null); inFlight.current = false; return;
    }
    setStorageFailed(false);
    if (action === "register") setAttempted(true);
    try {
      const response = await fetch("/api/admin/mvf-registration", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action, submissionId: id, registration: form,
          ageExceptionApproved: exceptionNeeded && ageExceptionApproved,
          ageExceptionReason: exceptionNeeded ? ageExceptionReason : "",
          ...(action === "register" ? { previewToken: preview?.previewToken } : {}),
        }),
      });
      const data = await response.json() as ApiResult;
      if (!response.ok || data.ok !== true) {
        setErrorCode(data.error ?? "request_failed");
        setError(ERROR_MESSAGES[data.error ?? "request_failed"] ?? ERROR_MESSAGES.request_failed);
        setErrors(data.errors ?? {});
        setPreview(null);
        return;
      }
      if (action === "preview" && data.previewToken && data.summary) {
        setPreview({ previewToken: data.previewToken, summary: data.summary });
        window.requestAnimationFrame(() => reviewPanel.current?.focus());
      } else if (action === "register" && typeof data.completed === "boolean" && data.invoiceId) {
        if (data.completed) {
          try {
            window.sessionStorage.removeItem(STORAGE_KEY);
            submissionId.current = null;
          } catch {
            setError("Registration is complete. Allow session storage before starting another player so this tab can clear its finished attempt.");
          }
        }
        setReceipt(data as Receipt);
        setPreview(null);
      } else {
        setError(ERROR_MESSAGES.request_failed); setPreview(null);
      }
    } catch {
      setError(ERROR_MESSAGES.request_failed); setPreview(null);
    } finally {
      setPending(null); inFlight.current = false;
    }
  }

  function registerAnother() {
    try { window.sessionStorage.removeItem(STORAGE_KEY); }
    catch { setError("Allow session storage before starting another registration."); return; }
    submissionId.current = null;
    setForm({ ...INITIAL_FORM }); setAgeExceptionApproved(false); setAgeExceptionReason("");
    setReceipt(null); setAttempted(false); setStorageFailed(false); invalidatePreview();
  }

  function fieldError(key: keyof FieldErrors) {
    return errors[key] ? <p id={`mvf-admin-${key}-error`} className="mt-2 text-sm text-ngpa-red">{errors[key]}</p> : null;
  }

  function textField(key: "parentName" | "email" | "phone" | "childFirstName" | "childLastName" | "emergencyName" | "emergencyPhone", label: string, type = "text", autoComplete = "off") {
    return <div>
      <label htmlFor={`mvf-admin-${key}`} className="mb-2 block font-heading text-sm font-bold">{label}</label>
      <input id={`mvf-admin-${key}`} type={type} autoComplete={autoComplete}
        required maxLength={key === "email" ? 254 : key.toLowerCase().includes("phone") ? 30 : 120}
        value={form[key]} onChange={(event) => update(key, event.target.value)}
        aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `mvf-admin-${key}-error` : undefined}
        className={inputClass} />
      {fieldError(key)}
    </div>;
  }

  if (receipt?.completed) {
    return <div role="status" className="space-y-6 rounded-2xl border border-ngpa-green/50 bg-ngpa-panel/60 p-5 sm:p-8">
      <div className="space-y-2">
        <p className="text-sm font-bold text-ngpa-green">Registration complete</p>
        <h2 className="font-heading text-2xl font-black">Ready for tournament day</h2>
        <p className="text-base leading-relaxed text-ngpa-white/80">
          {form.childFirstName} {form.childLastName} is registered with NGA and added to the protected junior roster on Link &amp; Dink.
          {receipt.alreadySent ? " The parent’s invoice was already sent." : " The parent’s invoice has been emailed."}
        </p>
        <p className="text-base text-ngpa-white/70">Invoice status: <span className="font-mono">{receipt.invoiceStatus}</span>. Registration does not mark the invoice paid.</p>
        <p className="break-all font-mono text-sm text-ngpa-white/65">Invoice: {receipt.invoiceId}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {receipt.invoiceUrl && <a href={receipt.invoiceUrl} target="_blank" rel="noopener noreferrer" className={primaryButton}>View invoice</a>}
        <button type="button" onClick={registerAnother} className={secondaryButton}>Register another player</button>
      </div>
      {error && <p role="alert" className="text-base text-ngpa-red">{error}</p>}
    </div>;
  }

  return <form onSubmit={(event) => { event.preventDefault(); void submit("preview"); }} className="space-y-6" aria-busy={pending !== null}>
    <fieldset disabled={detailsLocked} className="min-w-0 space-y-6">
      <legend className="sr-only">Tournament registration details</legend>
      <section aria-labelledby="mvf-admin-player-heading" className="card card-program rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/45 p-5 sm:p-6">
        <h2 id="mvf-admin-player-heading" className="card__title mb-5 font-heading text-xl font-bold">Player</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {textField("childFirstName", "Child’s first name")}
          {textField("childLastName", "Child’s last name")}
          <div>
            <label htmlFor="mvf-admin-childDob" className="mb-2 block font-heading text-sm font-bold">Child&rsquo;s real date of birth</label>
            <input id="mvf-admin-childDob" type="date" required value={form.childDob}
              onChange={(event) => update("childDob", event.target.value)}
              aria-invalid={!!errors.childDob} aria-describedby={`mvf-admin-dob-help${errors.childDob ? " mvf-admin-childDob-error" : ""}`} className={inputClass} />
            <p id="mvf-admin-dob-help" className="mt-2 text-sm leading-relaxed text-ngpa-white/70">
              Use the actual birthdate. Age is checked on October 24, 2026{age !== null ? `: age ${age}.` : "."}
            </p>
            {fieldError("childDob")}
          </div>
          <div className="rounded-xl border border-ngpa-slate/60 bg-ngpa-deep/35 p-4">
            <p className="font-heading text-sm font-bold">Division</p>
            <p className="mt-2 text-lg font-bold">14U event</p>
            <p className="mt-1 text-sm leading-relaxed text-ngpa-white/70">Ages 11–14. Ages 15–16 need an explicitly approved exception.</p>
            {fieldError("division")}
          </div>
        </div>
        {exceptionNeeded && <div className="mt-5 space-y-4 rounded-xl border border-ngpa-orange/60 bg-ngpa-deep/50 p-4">
          <p className="font-heading text-base font-bold text-ngpa-orange">Age exception required</p>
          <p className="text-base leading-relaxed text-ngpa-white/80">Keep the real date of birth. Record Sam&rsquo;s approval for this player to join the 14U event.</p>
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 text-base leading-relaxed">
            <input id="mvf-admin-ageExceptionApproved" type="checkbox" checked={ageExceptionApproved} required
              onChange={(event) => { setAgeExceptionApproved(event.target.checked); invalidatePreview(); }}
              className="h-5 w-5 shrink-0 accent-ngpa-teal" />
            <span>Sam has explicitly approved this player&rsquo;s age exception.</span>
          </label>
          {fieldError("ageExceptionApproved")}
          <div>
            <label htmlFor="mvf-admin-ageExceptionReason" className="mb-2 block font-heading text-sm font-bold">Approval reason</label>
            <textarea id="mvf-admin-ageExceptionReason" required maxLength={240} rows={3} value={ageExceptionReason}
              onChange={(event) => { setAgeExceptionReason(event.target.value); invalidatePreview(); }}
              className={inputClass} aria-invalid={!!errors.ageExceptionReason} />
            <p className="mt-2 text-sm text-ngpa-white/70">Note the approval and reason; include only what is needed for this exception.</p>
            {fieldError("ageExceptionReason")}
          </div>
        </div>}
      </section>

      <section aria-labelledby="mvf-admin-parent-heading" className="card card-program rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/45 p-5 sm:p-6">
        <h2 id="mvf-admin-parent-heading" className="card__title mb-2 font-heading text-xl font-bold">Parent or guardian</h2>
        <p className="mb-5 text-base leading-relaxed text-ngpa-white/70">Use the email on the signed NGA waiver. The invoice goes to this parent.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {textField("parentName", "Parent or guardian name", "text", "section-parent name")}
          {textField("email", "Parent email", "email", "section-parent email")}
          {textField("phone", "Parent phone", "tel", "section-parent tel")}
        </div>
        <label className="mt-5 flex min-h-[48px] cursor-pointer items-start gap-3 text-sm leading-relaxed text-ngpa-white/75">
          <input id="mvf-admin-smsConsent" type="checkbox" checked={form.smsConsent}
            onChange={(event) => update("smsConsent", event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-ngpa-teal" />
          <span><strong className="font-bold text-ngpa-white">Parent has opted in to text messages (optional).</strong> {SMS_CONSENT_TEXT}</span>
        </label>
        {fieldError("smsConsent")}
      </section>

      <section aria-labelledby="mvf-admin-emergency-heading" className="card card-program rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/45 p-5 sm:p-6">
        <h2 id="mvf-admin-emergency-heading" className="card__title mb-5 font-heading text-xl font-bold">Day-of contact</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {textField("emergencyName", "Emergency contact name")}
          {textField("emergencyPhone", "Emergency contact phone", "tel")}
          <div className="sm:col-span-2">
            <label htmlFor="mvf-admin-allergies" className="mb-2 block font-heading text-sm font-bold">Allergies or medical notes <span className="font-normal text-ngpa-white/65">(optional)</span></label>
            <textarea id="mvf-admin-allergies" rows={2} maxLength={480} value={form.allergies}
              onChange={(event) => update("allergies", event.target.value)} className={inputClass} />
            {fieldError("allergies")}
          </div>
        </div>
      </section>

      <fieldset className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/45 p-5 sm:p-6">
        <legend className="px-2 font-heading text-xl font-bold">Entry fee</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[{ resident: false, label: "Non-resident", price: NONRESIDENT_PRICE_USD }, { resident: true, label: "Montgomery Village resident", price: RESIDENT_PRICE_USD }].map((option) =>
            <label key={String(option.resident)} className={`flex min-h-[72px] cursor-pointer items-center gap-3 rounded-xl border p-4 ${form.resident === option.resident ? "border-ngpa-teal bg-ngpa-teal/10" : "border-ngpa-slate/60 bg-ngpa-deep/35"}`}>
              <input type="radio" name="resident" checked={form.resident === option.resident}
                onChange={() => update("resident", option.resident)} className="h-5 w-5 shrink-0 accent-ngpa-teal" />
              <span className="flex flex-1 flex-wrap items-center justify-between gap-2 text-base"><span>{option.label}</span><strong className="font-mono text-xl">${option.price}</strong></span>
            </label>)}
        </div>
        {fieldError("resident")}
      </fieldset>
    </fieldset>

    {error && <div role="alert" className="space-y-3 rounded-xl border border-ngpa-red/60 bg-ngpa-panel/60 p-4 text-base leading-relaxed">
      <p className="text-ngpa-white">{error}</p>
      {errorCode === "waiver_required" && <a href="/waiver/sign" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center font-bold text-ngpa-teal-bright underline underline-offset-4">Open NGA waiver</a>}
      {errorCode === "unauthorized" && <Link href="/admin/login" className="inline-flex min-h-[48px] items-center font-bold text-ngpa-teal-bright underline underline-offset-4">Sign in to NGA Admin</Link>}
    </div>}

    {receipt && !receipt.completed && <div role="status" className="space-y-3 rounded-2xl border border-ngpa-orange/60 bg-ngpa-panel/60 p-5">
      <h2 className="font-heading text-xl font-bold">Registration needs another step</h2>
      <ul className="space-y-2 text-base text-ngpa-white/80">
        <li>NGA registration: {receipt.registrationSaved ? "saved" : "not yet confirmed"}</li>
        <li>Link &amp; Dink roster: {receipt.rosterSynced ? "added" : "not yet confirmed"}</li>
        <li>Invoice status: <span className="font-mono">{receipt.invoiceStatus}</span></li>
      </ul>
      <p className="break-all font-mono text-sm text-ngpa-white/65">Invoice: {receipt.invoiceId}</p>
      {!receipt.registrationSaved && <p className="text-base leading-relaxed text-ngpa-white/80">The NGA registration row is not confirmed. This attempt may already hold a space, so an admin may need to reconcile the missing row before registration can finish.</p>}
      <p className="text-base leading-relaxed text-ngpa-white/80">Keep this tab open and retry this same registration to check the existing row and continue the Link &amp; Dink sync. Do not create another invoice.</p>
      {receipt.invoiceUrl && <a href={receipt.invoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center font-bold text-ngpa-teal-bright underline underline-offset-4">View existing invoice</a>}
    </div>}

    {attempted && !receipt?.completed && <p className="text-sm leading-relaxed text-ngpa-white/70">These details are held for this registration. Preview again to safely continue the same attempt. If the connection was interrupted, a retry checks the existing invoice.</p>}

    {preview ? <div ref={reviewPanel} tabIndex={-1} className="space-y-5 rounded-2xl border border-ngpa-teal/70 bg-ngpa-panel/70 p-5 focus:outline-none focus:ring-2 focus:ring-ngpa-teal sm:p-6" aria-labelledby="mvf-admin-review-heading">
      <div>
        <p className="mb-2 text-sm font-bold text-ngpa-teal-bright">Waiver checked · review before sending</p>
        <h2 id="mvf-admin-review-heading" className="font-heading text-xl font-bold">Confirm this registration</h2>
      </div>
      <dl className="grid gap-4 text-base sm:grid-cols-2">
        {[
          ["Player", preview.summary.childName], ["Date of birth", `${displayDob(preview.summary.childDob)} · age ${preview.summary.age}`],
          ["Event", `${preview.summary.divisionLabel} · October 24, 2026`], ["Entry fee", `$${preview.summary.amountUsd} · ${form.resident ? "MV resident" : "non-resident"}`],
          ["Parent or guardian", form.parentName], ["Invoice email", preview.summary.parentEmail],
        ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="mb-1 text-sm text-ngpa-white/65">{label}</dt><dd className="break-words font-semibold">{value}</dd></div>)}
      </dl>
      {preview.summary.ageException && <p className="rounded-xl border border-ngpa-orange/50 bg-ngpa-deep/45 p-3 text-base leading-relaxed">Approved age exception: {ageExceptionReason}. The player&rsquo;s real date of birth will be kept.</p>}
      <p className="text-base leading-relaxed text-ngpa-white/80">Confirming will register this player with NGA, email the parent&rsquo;s invoice and add the protected junior entry to Link &amp; Dink. Payment remains due until the invoice is paid.</p>
      <button type="button" disabled={pending !== null} onClick={() => void submit("register")} className={primaryButton}>
        {pending === "register" ? "Completing registration…" : "Register and email invoice"}
      </button>
    </div> : <div className="space-y-3 border-t border-ngpa-slate/50 pt-5">
      <p className="text-sm leading-relaxed text-ngpa-white/70">Preview checks the waiver and payment account, and confirms the entry fee. Available space is checked when you register. If you return after an interruption, re-enter the same details to continue.</p>
      <button type="submit" disabled={pending !== null} className={primaryButton}>
        {pending === "preview" ? "Checking registration…" : attempted ? "Preview again and continue" : "Preview registration"}
      </button>
      {storageFailed && <p className="text-sm text-ngpa-white/70">Your browser must remember this registration attempt before an invoice can be created.</p>}
    </div>}
  </form>;
}
