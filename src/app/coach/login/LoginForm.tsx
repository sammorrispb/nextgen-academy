"use client";

import { useState } from "react";

const INPUT =
  "w-full rounded-lg bg-ngpa-panel border border-ngpa-slate/60 text-ngpa-white px-4 py-3 text-base placeholder:text-ngpa-white/40 focus:outline-none focus:border-ngpa-teal focus:ring-1 focus:ring-ngpa-teal transition-colors";

export default function LoginForm() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    if (!email) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/coach/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setServerError(j.error ?? "Could not send the link. Try again.");
        setSubmitting(false);
        return;
      }
      setSent(true);
    } catch {
      setServerError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="px-5 py-6 rounded-2xl bg-ngpa-panel/80 border border-ngpa-teal/40">
        <p className="text-base text-ngpa-white leading-relaxed">
          Check your inbox. If your email is on the coach allowlist, a sign-in
          link is on its way. The link is good for 10 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-bold text-ngpa-white block mb-1.5">
          Email
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className={INPUT}
        />
      </label>
      {serverError && (
        <p role="alert" className="text-sm text-red-400">
          {serverError}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full px-6 py-3.5 rounded-full bg-ngpa-lime text-ngpa-deep font-bold hover:brightness-110 transition-all disabled:opacity-60 min-h-[48px] shadow-xl shadow-ngpa-lime/20"
      >
        {submitting ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  );
}
