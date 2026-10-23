"use client";

import { useRef, useState } from "react";

type ReviewedInvoice = { invoiceId: string; originalDivision: "10u" | "14u" };
interface OpaqueExport {
  sourceRevision: string;
  count: number;
  invoices: { invoiceId: string; eventKey: string; attendeeKey: string; requestKey: string; poolAttendeeKey: string }[];
}
const EXAMPLE = '{\n  "invoices": [\n    { "invoiceId": "in_example", "originalDivision": "14u" }\n  ]\n}';
const INPUT_ERROR = "Use 1–24 unique invoice IDs with an originalDivision of 10u or 14u. Include only these two fields per invoice.";
const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Your admin sign-in has expired. Sign in again before exporting.",
  bad_origin: "Open this form on the NGA website and try again.",
  bad_input: INPUT_ERROR,
  not_configured: "Capacity reconciliation is unavailable on this deployment.",
  source_identity_invalid: "A registration has incomplete or ambiguous source details. Review the private registration before exporting again.",
  source_registration_missing: "A reviewed invoice could not be matched to one registration. Check the private source before exporting again.",
  source_unavailable: "The registration source could not be verified. Try again in a moment.",
};
const inputClass = "min-h-[48px] w-full rounded-xl border border-ngpa-slate/60 bg-ngpa-deep/60 px-4 py-3 text-base text-ngpa-white focus:border-ngpa-teal focus:outline-none focus:ring-2 focus:ring-ngpa-teal disabled:opacity-70";
const primaryButton = "btn btn-primary flex min-h-[48px] w-full items-center justify-center rounded-xl bg-ngpa-teal px-5 py-3 text-base font-bold text-ngpa-deep transition-colors hover:bg-ngpa-teal-bright disabled:cursor-wait disabled:opacity-50 sm:w-auto";
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function reviewedInput(raw: string): { invoices: ReviewedInvoice[] } | null {
  if (raw.length > 16_384) return null;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!object(data) || Object.keys(data).length !== 1 || !Array.isArray(data.invoices) ||
    data.invoices.length < 1 || data.invoices.length > 24) return null;
  const invoices: ReviewedInvoice[] = [];
  const ids = new Set<string>();
  for (const invoice of data.invoices) {
    if (!object(invoice) || Object.keys(invoice).length !== 2 || typeof invoice.invoiceId !== "string" ||
      !/^in_[A-Za-z0-9]{1,250}$/.test(invoice.invoiceId) || ids.has(invoice.invoiceId) ||
      (invoice.originalDivision !== "10u" && invoice.originalDivision !== "14u")) return null;
    ids.add(invoice.invoiceId);
    invoices.push({ invoiceId: invoice.invoiceId, originalDivision: invoice.originalDivision });
  }
  return { invoices };
}
function opaqueResult(raw: unknown, reviewed: ReviewedInvoice[]): OpaqueExport | null {
  const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  if (!object(raw) || raw.ok !== true || raw.count !== reviewed.length || !digest(raw.sourceRevision) ||
    !Array.isArray(raw.invoices) || raw.invoices.length !== reviewed.length) return null;
  const invoices: OpaqueExport["invoices"] = [];
  for (let i = 0; i < reviewed.length; i++) {
    const row: unknown = raw.invoices[i];
    if (!object(row) || row.invoiceId !== reviewed[i].invoiceId ||
      row.eventKey !== `mvf-junior-tournament-${reviewed[i].originalDivision}-2026-10-24` ||
      !digest(row.attendeeKey) || !digest(row.requestKey) || !digest(row.poolAttendeeKey)) return null;
    // Project allowlisted opaque fields even if an upstream response adds data.
    invoices.push({ invoiceId: reviewed[i].invoiceId, eventKey: row.eventKey,
      attendeeKey: row.attendeeKey, requestKey: row.requestKey, poolAttendeeKey: row.poolAttendeeKey });
  }
  return { sourceRevision: raw.sourceRevision, count: reviewed.length, invoices };
}

export default function MvfCapacityExportForm() {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<OpaqueExport | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    setError(""); setResult(null);
    const reviewed = reviewedInput(input);
    if (!reviewed) { setError(INPUT_ERROR); return; }
    inFlight.current = true; setPending(true);
    try {
      const response = await fetch("/api/admin/mvf-capacity-export", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" }, body: JSON.stringify(reviewed),
      });
      const data: unknown = await response.json();
      if (!response.ok || !object(data) || data.ok !== true) {
        const code = object(data) && typeof data.error === "string" ? data.error : "source_unavailable";
        setError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.source_unavailable);
        return;
      }
      const exported = opaqueResult(data, reviewed.invoices);
      if (!exported) { setError(ERROR_MESSAGES.source_unavailable); return; }
      setResult(exported);
    } catch { setError(ERROR_MESSAGES.source_unavailable); }
    finally { inFlight.current = false; setPending(false); }
  }

  return <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-6" aria-busy={pending}>
    <section className="card card-program space-y-4 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/45 p-5 sm:p-6">
      <label htmlFor="mvf-capacity-invoices" className="block font-heading text-lg font-bold">
        Reviewed invoice IDs and original divisions
      </label>
      <p id="mvf-capacity-input-help" className="text-base leading-relaxed text-ngpa-white/75">
        Paste JSON in the example format. Use the division on the original invoice,
        even if the player later moved to 14U. Enter invoice references only.
      </p>
      <textarea id="mvf-capacity-invoices" required rows={8} maxLength={16_384} value={input}
        onChange={event => { setInput(event.target.value); setError(""); setResult(null); }}
        disabled={pending} spellCheck={false} autoComplete="off" placeholder={EXAMPLE}
        aria-describedby={`mvf-capacity-input-help${error ? " mvf-capacity-error" : ""}`} aria-invalid={!!error}
        className={`${inputClass} font-mono`} />
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Preparing export…" : "Prepare private export"}
      </button>
      {error && <p id="mvf-capacity-error" role="alert" className="text-base leading-relaxed text-ngpa-red">{error}</p>}
    </section>
    {result && <section aria-labelledby="mvf-capacity-result-title" className="space-y-4 rounded-2xl border border-ngpa-green/50 bg-ngpa-panel/60 p-5 sm:p-6">
      <h2 id="mvf-capacity-result-title" className="font-heading text-xl font-bold">Private reconciliation export</h2>
      <p role="status" className="text-base text-ngpa-green">NGA registrations matched: {result.count}.</p>
      <p className="break-all text-base leading-relaxed text-ngpa-white/75">
        Source revision: <span className="font-mono">{result.sourceRevision}</span>
      </p>
      <label htmlFor="mvf-capacity-output" className="block font-heading text-sm font-bold">Opaque reconciliation JSON</label>
      <textarea id="mvf-capacity-output" readOnly rows={16} value={JSON.stringify({ ok: true, ...result }, null, 2)}
        spellCheck={false} autoComplete="off" className={`${inputClass} font-mono`} />
      <p className="text-base leading-relaxed text-ngpa-white/75">
        This export covers the listed registrations. Complete the provider and roster
        reconciliation before the separately approved capacity activation.
      </p>
    </section>}
  </form>;
}
