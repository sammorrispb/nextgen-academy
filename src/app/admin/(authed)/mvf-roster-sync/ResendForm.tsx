"use client";

import { useState } from "react";

type Action = "preview" | "replay" | "payment_preview" | "payment_sync";
interface Receipt { outcome: string; eventKey: string; previewToken?: string }
const messages: Record<string, string> = {
  unauthorized: "Sign in as an NGA admin before continuing.",
  not_configured: "Roster sync is unavailable on this deployment. Contact the site administrator.",
  registration_not_found: "No tournament registration matches that invoice ID.",
  registration_ambiguous: "Multiple registrations match. Resolve the duplicate in Notion before syncing.",
  registration_ineligible: "The stored registration is incomplete or ineligible. Review it in Notion.",
  payment_verification_required: "Stripe payment could not be verified. Review the invoice and payment before retrying.",
  payment_provider_unavailable: "Stripe verification is unavailable. Try a fresh preview later.",
  payment_sync_unavailable: "Link & Dink has not confirmed payment sync. Preview again before retrying.",
  preview_expired_or_changed: "The preview expired or the registration changed. Preview again.",
};
export default function ResendForm() {
  const [mode, setMode] = useState<"roster" | "payment">("payment");
  const [invoiceId, setInvoiceId] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(action: Action) {
    if (pending || (["replay", "payment_sync"].includes(action) && !receipt?.previewToken)) return;
    const previewToken = receipt?.previewToken;
    setPending(true); setError(""); setReceipt(null);
    try {
      const res = await fetch("/api/admin/mvf-roster-sync", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceId: invoiceId.trim(), action,
          ...(["replay", "payment_sync"].includes(action) ? { previewToken } : {}) }),
      });
      const data = await res.json() as Receipt & { ok?: boolean; error?: string };
      if (!res.ok || data.ok !== true) {
        setError(messages[data.error ?? ""] ?? "Sync could not be confirmed. Preview again before retrying.");
      } else { setReceipt(data); }
    } catch {
      setError("Sync could not be confirmed. Preview again before retrying.");
    } finally { setPending(false); }
  }
  const button = "btn btn-primary min-h-[48px] rounded-lg bg-ngpa-teal px-4 py-2 font-bold text-ngpa-deep disabled:opacity-50";
  return <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(mode === "payment" ? "payment_preview" : "preview"); }}>
    <fieldset className="space-y-2" disabled={pending}>
      <legend className="font-bold">Action</legend>
      {(["payment", "roster"] as const).map(value => <label key={value} className="flex min-h-[48px] items-center gap-3">
        <input type="radio" name="sync-mode" value={value} checked={mode === value}
          onChange={() => { setMode(value); setReceipt(null); setError(""); }} />
        {value === "payment" ? "Sync a verified NGA payment" : "Recover a missing roster entry"}
      </label>)}
    </fieldset>
    <div className="space-y-2">
      <label htmlFor="invoice-id" className="block text-base font-bold">Existing Stripe invoice ID</label>
      <input id="invoice-id" value={invoiceId} required maxLength={103} autoComplete="off" disabled={pending}
        onChange={(e) => { setInvoiceId(e.target.value); setReceipt(null); setError(""); }}
        className="w-full min-h-[48px] rounded-lg border border-ngpa-slate/60 bg-ngpa-panel px-3 py-2"
        placeholder="in_…" />
    </div>
    <button type="submit" className={button} disabled={pending || !invoiceId.trim()}>
      {pending ? "Checking…" : mode === "payment" ? "Preview payment sync" : "Preview roster sync"}
    </button>
    {error && <p role="alert" className="text-base text-ngpa-red">{error}</p>}
    {receipt && <div aria-live="polite" className="space-y-3 rounded-lg border border-ngpa-slate/60 p-4 text-base">
      <p>Division: {receipt.eventKey.includes("-10u-") ? "10U" : "14U"} · <time dateTime="2026-10-24">October 24, 2026</time></p>
      <p>{receipt.outcome === "would_sync_payment" ? "Stripe payment verified. Preview has not changed Link & Dink."
        : receipt.outcome === "would_record_payment" ? "Stripe payment verified. A payment receipt can be saved for the protected roster entry to claim when it arrives. Preview has not changed Link & Dink."
        : receipt.outcome === "payment_synced" ? "Payment sync confirmed. Link & Dink shows this protected entry paid."
        : receipt.outcome === "payment_pending_roster" ? "Payment receipt saved. Link & Dink will apply it when the protected roster entry arrives; this has not added a player."
        : receipt.outcome === "would_add" ? "Eligible to sync. Preview has not added a roster entry."
        : receipt.outcome === "already_on_roster" ? "This registration is already on the roster."
        : "Roster sync confirmed. Verify the protected junior entry in Link & Dink."}</p>
      {["would_sync_payment", "would_record_payment"].includes(receipt.outcome) && receipt.previewToken &&
        <button type="button" className={button} disabled={pending} onClick={() => void submit("payment_sync")}>
          Sync this verified payment
        </button>}
      {receipt.outcome === "would_add" && receipt.previewToken &&
        <button type="button" className={button} disabled={pending} onClick={() => void submit("replay")}>
          Sync this registration
        </button>}
    </div>}
  </form>;
}
