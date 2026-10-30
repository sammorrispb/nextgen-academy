"use client";
import { useEffect, useState } from "react";
type Receipt = { status: string; amountUsd: number; division: string; payUrl: string | null; cancelToken: string | null };
export default function MvfSeriesReceipt({ event }: { event: string }) {
  const [token, setToken] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [message, setMessage] = useState("Checking your invoice…");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function load(value: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/mvf-series/${event}/receipt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: value }) });
      if (!response.ok) throw new Error();
      const result = await response.json(); setReceipt(result); setMessage("");
    } catch { setMessage("We could not verify this invoice. Check your invoice email or contact Coach Sam. This page does not confirm a reserved spot or payment."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const value = new URLSearchParams(location.hash.slice(1)).get("receipt") ?? "";
    setToken(value); void load(value);
    // The capability stays in the fragment, outside server logs and referrers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  async function cancel() {
    if (!confirm || !receipt?.cancelToken || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/mvf-series/${event}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: receipt.cancelToken }) });
      if (!response.ok) throw new Error();
      setConfirm(false); await load(token);
    } catch { setMessage("Cancellation is not confirmed. Check your invoice and contact Coach Sam before registering again."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5 mt-6" aria-label="Invoice status">
    {message && <p role="status">{message}</p>}
    {receipt && <><h2 className="font-heading text-2xl font-bold">{receipt.status === "paid" ? "Payment received — registration confirmed" : receipt.status === "pending" ? "Payment pending" : receipt.status === "cancelled" ? "Unpaid registration cancelled" : "Payment or registration verification pending"}</h2><p>{receipt.division} · ${receipt.amountUsd} entry fee</p>
      {receipt.payUrl && <a href={receipt.payUrl} className="inline-block bg-ngpa-teal text-ngpa-deep font-bold rounded-full px-6 py-3 min-h-12">Pay your invoice on Stripe</a>}
      {receipt.cancelToken && <div className="border border-ngpa-slate rounded-xl p-4"><label className="flex gap-3 min-h-12"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="h-6 w-6" />Cancel this unpaid invoice and release its seat.</label><button type="button" disabled={!confirm || busy} onClick={cancel} className="underline min-h-12 py-3 disabled:opacity-50">Confirm unpaid cancellation</button></div>}
    </>}
    <button type="button" disabled={busy} onClick={() => load(token)} className="underline min-h-12 py-3 disabled:opacity-50">Check payment status again</button>
    <p>For paid cancellations or help, contact nextgenacademypb@gmail.com or 301-325-4731. No refund is initiated from this page.</p>
  </section>;
}
