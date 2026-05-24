"use client";

import { useState } from "react";

interface CommitFormProps {
  token: string;
  parentEmail: string;
  childFirstName: string;
}

type FormStatus = "idle" | "submitting" | "error";

export default function CommitForm({
  token,
  parentEmail,
  childFirstName,
}: CommitFormProps) {
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    if (!parentName.trim()) {
      setErrorMessage("Please enter your name");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/commit/start-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          parentName: parentName.trim(),
          parentPhone: parentPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Could not start checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  const inputClass =
    "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
  const labelClass = "block font-heading text-sm font-bold text-ngpa-white mb-1.5";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20"
    >
      {errorMessage && (
        <div className="bg-ngpa-red/10 border border-ngpa-red/30 rounded-lg p-4 mb-6">
          <p className="text-ngpa-red text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="parentName" className={labelClass}>
            Your Name
          </label>
          <input
            id="parentName"
            type="text"
            autoComplete="name"
            className={inputClass}
            placeholder="First and last name"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="parentPhone" className={labelClass}>
            Phone <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <input
            id="parentPhone"
            type="tel"
            autoComplete="tel"
            className={inputClass}
            placeholder="(301) 555-1234"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <p className="text-ngpa-white/65 text-sm bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5">
            {parentEmail}
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full px-8 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
      >
        {status === "submitting"
          ? "Redirecting to Stripe..."
          : `Save card & lock in 4 weeks for ${childFirstName} →`}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        We&rsquo;ll save your card on Stripe and only charge $40 on weeks{" "}
        {childFirstName} is reserved. Skip any week and we refund automatically.
        Stop the auto-reserve any time.
      </p>
    </form>
  );
}
