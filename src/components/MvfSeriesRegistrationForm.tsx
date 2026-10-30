"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateSeriesRegistration, type SeriesRelease, type SeriesRegistration } from "@/data/mvf-series-registration";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";

export default function MvfSeriesRegistrationForm({ release }: { release: SeriesRelease }) {
  const router = useRouter();
  const initial: SeriesRegistration = { division: "12u", resident: true, parentName: "", email: "", phone: "", childFirstName: "", childLastName: "", childDob: "", emergencyName: "", emergencyPhone: "", allergies: "", smsConsent: false, policyAccepted: false, revision: release.revision, submissionId: "" };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [waiver, setWaiver] = useState<string | null>(null);
  const sending = useRef(false);
  const storageKey = `nga:mvf-series:${release.event}:attempt:v1`;
  useEffect(() => {
    let id: string | undefined;
    try {
      const old = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (old && old.expires > Date.now() && old.expires < Date.now() + 31 * 60000 && /^[0-9a-f-]{36}$/i.test(old.id)) id = old.id;
    } catch { /* Storage is optional; the server still rejects duplicates. */ }
    id ??= crypto.randomUUID();
    try { sessionStorage.setItem(storageKey, JSON.stringify({ id, expires: Date.now() + 30 * 60000 })); } catch { /* No personal fields are persisted. */ }
    const chosen = id;
    queueMicrotask(() => setForm(previous => ({ ...previous, submissionId: chosen })));
  }, [storageKey]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || !form.submissionId) return;
    const errors = validateSeriesRegistration(form, release);
    setErrors(errors);
    if (Object.keys(errors).length) return;
    sending.current = true; setBusy(true); setMessage(""); setWaiver(null);
    try {
      const response = await fetch(`/api/mvf-series/${release.event}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (response.ok && typeof result.receiptUrl === "string" && result.receiptUrl.startsWith(`/mvf-junior-tournament/${release.event}/status#receipt=`)) {
        try { sessionStorage.removeItem(storageKey); } catch { /* Successful invoice remains recoverable by email. */ }
        router.push(result.receiptUrl); return;
      }
      if (result.errors) setErrors(result.errors);
      if (result.code === "waiver_required" && typeof result.signUrl === "string" && result.signUrl.startsWith("/waiver/sign?")) setWaiver(result.signUrl);
      setMessage(result.code === "full" ? "This bracket is full. Contact Coach Sam for options; no invoice was created." : result.code === "duplicate" || result.code === "request_conflict" ? "An attempt already exists for these details. Check your invoice email or contact Coach Sam before starting another." : result.code === "registration_closed" ? "Registration is closed." : "We could not finish verifying this request. Keep the same details when retrying, and check your invoice email before submitting another registration.");
    } catch { setMessage("The connection was interrupted. Retry with these same details, or check your invoice email. Do not start another registration for the same player."); }
    finally { sending.current = false; setBusy(false); }
  }
  const inputClass = "w-full rounded-xl border border-ngpa-slate/60 bg-ngpa-deep px-4 py-3 min-h-12 text-ngpa-white";
  const fields = [["parentName", "Parent or guardian name", "text"], ["email", "Parent email", "email"], ["phone", "Parent phone", "tel"], ["childFirstName", "Player first name", "text"], ["childLastName", "Player last name", "text"], ["childDob", "Player date of birth", "date"], ["emergencyName", "Emergency contact name", "text"], ["emergencyPhone", "Emergency contact phone", "tel"]] as const;
  return <form onSubmit={submit} className="mt-6 space-y-5" aria-label="Tournament registration">
    <p>Complete this as the player&rsquo;s parent or guardian. We email your invoice to the parent email. Registration is confirmed after verified payment.</p>
    {fields.map(([name, label, type]) => <div key={name}><label htmlFor={`series-${name}`} className="block mb-2">{label}</label><input id={`series-${name}`} name={name} type={type} required maxLength={name === "email" ? 254 : 100} value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })} className={inputClass} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined} />{errors[name] && <p id={`error-${name}`} className="text-ngpa-red mt-2">{errors[name]}</p>}</div>)}
    <label className="block">Bracket<select value={form.division} onChange={e => setForm({ ...form, division: e.target.value as "12u" | "16u" })} className={inputClass}><option value="12u">12U</option><option value="16u">16U</option></select></label>
    <p>{release.eligibilityText}</p>
    <label className="block">Residency<select value={String(form.resident)} onChange={e => setForm({ ...form, resident: e.target.value === "true" })} className={inputClass}><option value="true">Montgomery Village resident — $50</option><option value="false">Nonresident — $60</option></select></label>
    <label className="block">Allergies or medical notes (optional)<textarea maxLength={480} value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} className={inputClass} /></label>
    <label className="flex gap-3 items-start min-h-12"><input type="checkbox" checked={form.smsConsent} onChange={e => setForm({ ...form, smsConsent: e.target.checked })} className="mt-1 h-6 w-6 shrink-0" />{SMS_CONSENT_TEXT}</label>
    <div className="rounded-xl border border-ngpa-slate p-4 space-y-3"><p>{release.cancellationPolicy}</p><p>{release.rainPolicy}</p><p>{release.minimumEnrollmentPolicy}</p><p>Invoice due in {release.invoiceDueDays} days. An overdue invoice is not automatically cancelled. Paid cancellations require Coach Sam&rsquo;s review under the policy above.</p></div>
    <label className="flex gap-3 items-start min-h-12"><input type="checkbox" required checked={form.policyAccepted} onChange={e => setForm({ ...form, policyAccepted: e.target.checked })} className="mt-1 h-6 w-6 shrink-0" />I am the parent or guardian and accept these event policies.</label>
    {errors.policyAccepted && <p className="text-ngpa-red">{errors.policyAccepted}</p>}
    {message && <p role="alert">{message}</p>}
    {waiver && <a href={waiver} className="inline-block underline min-h-12 py-3 text-ngpa-teal-bright">Sign the one-time waiver, then return to this page</a>}
    <button type="submit" disabled={busy || !form.submissionId} className="rounded-full bg-ngpa-teal text-ngpa-deep font-bold px-6 py-3 min-h-12 disabled:opacity-50">{busy ? "Verifying your registration…" : `Request invoice — $${form.resident ? 50 : 60}`}</button>
  </form>;
}
