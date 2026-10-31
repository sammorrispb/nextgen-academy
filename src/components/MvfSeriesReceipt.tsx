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
  // Headings, pay link and help line mirror the October 24 tournament's
  // status page (src/app/mvf-junior-tournament/success/page.tsx).
  const heading = receipt?.status === "paid" ? "Payment received" : receipt?.status === "pending" ? "One step left: pay your entry fee" : receipt?.status === "cancelled" ? "Unpaid registration cancelled" : receipt?.status === "review_required" ? "Payment needs review — contact Coach Sam" : "We couldn't verify your payment status yet";
  return <section className="space-y-4 mt-4" aria-label="Invoice status">
    {message && <p role="status" className="text-ngpa-white/70">{message}</p>}
    {receipt && <><h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white leading-tight">{heading}</h2>
      <p className="text-ngpa-white/80 text-lg">{receipt.division} division · ${receipt.amountUsd} entry fee{receipt.status === "paid" ? ". Your registration is confirmed." : ""}</p>
      {receipt.status === "pending" && <p className="text-ngpa-white/70">Pay your invoice to lock your player&rsquo;s spot. Check your invoice email, including spam.</p>}
      {receipt.status === "review_required" && <p className="text-ngpa-white/70">A payment adjustment needs review. Its seat remains held while Coach Sam reviews the registration.</p>}
      {receipt.payUrl && <a href={receipt.payUrl} className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-teal text-ngpa-deep font-heading font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-12">Pay the entry fee</a>}
      {receipt.cancelToken && <div className="border border-ngpa-slate/60 rounded-xl p-4"><label className="flex gap-3 min-h-12 text-ngpa-white/80"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="h-6 w-6" />Cancel this unpaid invoice and release its seat.</label><button type="button" disabled={!confirm || busy} onClick={cancel} className="underline min-h-12 py-3 disabled:opacity-50">Confirm unpaid cancellation</button></div>}
    </>}
    <button type="button" disabled={busy} onClick={() => load(hashToken())} className="block underline min-h-12 py-3 text-ngpa-teal-bright disabled:opacity-50">Check payment status again</button>
    <p className="text-ngpa-white/70">{receipt?.status === "paid" ? "Keep your Stripe payment receipt and check your email for tournament details. " : ""}If you need help checking your invoice or registration, text Coach Sam at <a href="tel:+13013254731" className="text-ngpa-teal-bright underline hover:text-ngpa-teal">301-325-4731</a> or email nextgenacademypb@gmail.com. No refund is initiated from this page.</p>
    <a href={`/mvf-junior-tournament/${event}`} className="inline-block underline min-h-12 py-3 text-ngpa-teal-bright">Back to tournament details</a>
  </section>;
}
