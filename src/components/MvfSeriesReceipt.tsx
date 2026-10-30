"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type Receipt = { status: string; amountUsd: number; division: string; payUrl: string | null; cancelToken: string | null };
const hashToken = () => new URLSearchParams(location.hash.slice(1)).get("receipt") ?? "";
export default function MvfSeriesReceipt({ event }: { event: string }) {
  const [token, setToken] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [message, setMessage] = useState("Checking your invoice…");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const requests = useRef(0);
  const verified = useRef(false);
  const current = useRef({ event, token: "" });
  const invalidate = useCallback(() => { requests.current++; verified.current = false; }, []);
  const matches = useCallback((value: string, version: number) => requests.current === version && current.current.event === event && current.current.token === value && hashToken() === value, [event]);
  const load = useCallback(async (value: string) => {
    const version = ++requests.current;
    current.current = { event, token: value }; verified.current = false;
    setToken(value); setReceipt(null); setConfirm(false); setMessage("Checking your invoice…"); setBusy(true);
    try {
      const response = await fetch(`/api/mvf-series/${event}/receipt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: value }) });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!matches(value, version)) return;
      verified.current = true; setReceipt(result); setMessage("");
    } catch {
      if (!matches(value, version)) return;
      verified.current = false; setReceipt(null); setConfirm(false);
      setMessage("We could not verify this invoice. Check your invoice email or contact Coach Sam. This page does not confirm a reserved spot or payment.");
    }
    finally { if (matches(value, version)) setBusy(false); }
  }, [event, matches]);
  useEffect(() => {
    let previous: string | undefined;
    let active = true;
    const navigate = () => {
      if (!active) return;
      const value = hashToken();
      if (value === previous) return;
      previous = value; void load(value);
    };
    navigate();
    addEventListener("hashchange", navigate); addEventListener("popstate", navigate);
    // pushState/replaceState do not emit hashchange or popstate. Observe
    // same-document router navigation too, preserving the existing wrappers.
    const originalPush = history.pushState, originalReplace = history.replaceState;
    const push: History["pushState"] = (...args) => { originalPush.apply(history, args); navigate(); };
    const replace: History["replaceState"] = (...args) => { originalReplace.apply(history, args); navigate(); };
    history.pushState = push; history.replaceState = replace;
    // The capability stays in the fragment, outside server logs and referrers.
    return () => {
      active = false; invalidate(); removeEventListener("hashchange", navigate); removeEventListener("popstate", navigate);
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace) history.replaceState = originalReplace;
    };
  }, [load, invalidate]);
  async function cancel() {
    if (!confirm || !receipt?.cancelToken || busy || !verified.current || current.current.event !== event || current.current.token !== token || hashToken() !== token) return;
    const cancelToken = receipt.cancelToken, value = token, version = ++requests.current;
    verified.current = false; setReceipt(null); setConfirm(false); setBusy(true);
    try {
      const response = await fetch(`/api/mvf-series/${event}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: cancelToken }) });
      if (!matches(value, version)) return;
      if (!response.ok) throw new Error();
      await load(value);
    } catch { if (matches(value, version)) setMessage("Cancellation is not confirmed. Check your invoice and contact Coach Sam before registering again."); }
    finally { if (matches(value, version)) setBusy(false); }
  }
  return <section className="space-y-5 mt-6" aria-label="Invoice status">
    {message && <p role="status">{message}</p>}
    {receipt && <><h2 className="font-heading text-2xl font-bold">{receipt.status === "paid" ? "Payment received — registration confirmed" : receipt.status === "pending" ? "Payment pending" : receipt.status === "cancelled" ? "Unpaid registration cancelled" : receipt.status === "review_required" ? "Payment needs review — contact Coach Sam" : "Payment or registration verification pending"}</h2><p>{receipt.division} · ${receipt.amountUsd} entry fee</p>
      {receipt.status === "review_required" && <p>A payment adjustment needs review. Its seat remains held while Coach Sam reviews the registration.</p>}
      {receipt.payUrl && <a href={receipt.payUrl} className="inline-block bg-ngpa-teal text-ngpa-deep font-bold rounded-full px-6 py-3 min-h-12">Pay your invoice on Stripe</a>}
      {receipt.cancelToken && <div className="border border-ngpa-slate rounded-xl p-4"><label className="flex gap-3 min-h-12"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="h-6 w-6" />Cancel this unpaid invoice and release its seat.</label><button type="button" disabled={!confirm || busy} onClick={cancel} className="underline min-h-12 py-3 disabled:opacity-50">Confirm unpaid cancellation</button></div>}
    </>}
    <button type="button" disabled={busy} onClick={() => load(hashToken())} className="underline min-h-12 py-3 disabled:opacity-50">Check payment status again</button>
    <p>For paid cancellations or help, contact nextgenacademypb@gmail.com or 301-325-4731. No refund is initiated from this page.</p>
    <a href={`/mvf-junior-tournament/${event}`} className="inline-block underline min-h-12 py-3">Back to tournament details</a>
  </section>;
}
