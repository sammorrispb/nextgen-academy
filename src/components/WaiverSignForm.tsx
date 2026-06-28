"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  validateWaiverSignForm,
  type WaiverSignFormData,
  type WaiverSignValidationErrors,
} from "@/lib/validate-waiver-sign";
import { getUtm } from "@/lib/funnelClient";

type FormStatus = "idle" | "submitting" | "success" | "error";

const FIELD =
  "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
const LABEL = "block font-heading text-sm font-bold text-ngpa-white mb-1.5";
const ERR = "text-ngpa-red text-sm mt-1.5";

export default function WaiverSignForm() {
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<WaiverSignValidationErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const nextRef = useRef<string>("/schedule");

  // Prefill from the gate redirect (?email=&name=&next=) so a parent bounced
  // out of checkout doesn't retype what they just entered.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("email");
    const n = params.get("name");
    if (e) setEmail(e);
    if (n) setParentName(n);
    const next = params.get("next");
    if (next && next.startsWith("/")) nextRef.current = next;
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const data: Partial<WaiverSignFormData> = {
      parentName,
      email,
      phone,
      signatureName,
      agree,
      ...getUtm(),
    };
    const allErrors = validateWaiverSignForm(data);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return;
    }
    setErrors({});
    setStatus("submitting");

    try {
      const res = await fetch("/api/waiver-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.errors) {
          setErrors(json.errors);
          setStatus("error");
          return;
        }
        throw new Error(json.error || "Something went wrong");
      }
      setStatus("success");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-ngpa-panel/80 backdrop-blur rounded-2xl p-8 border border-ngpa-slate/60 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ngpa-green/15 mb-6">
          <svg
            className="w-8 h-8 text-ngpa-green"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-heading text-2xl font-black text-ngpa-white mb-3 tracking-tight">
          Waiver signed — you&rsquo;re all set!
        </h3>
        <p className="text-ngpa-white/75 mb-6 max-w-md mx-auto">
          We emailed a copy to <span className="text-ngpa-white">{email}</span> for
          your records. This covers your child for every NGA program.
        </p>
        <Link
          href={nextRef.current}
          className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-lime text-ngpa-deep font-bold rounded-full hover:brightness-110 transition-all min-h-[48px]"
        >
          Continue to registration →
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20"
    >
      {serverError && (
        <div className="bg-ngpa-red/10 border border-ngpa-red/30 rounded-lg p-4 mb-6">
          <p className="text-ngpa-red text-sm font-medium">{serverError}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="parentName" className={LABEL}>
            Parent / guardian name
          </label>
          <input
            id="parentName"
            type="text"
            autoComplete="name"
            className={FIELD}
            placeholder="First and last name"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
          />
          {errors.parentName && <p className={ERR}>{errors.parentName}</p>}
        </div>

        <div>
          <label htmlFor="email" className={LABEL}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={FIELD}
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <p className={ERR}>{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="phone" className={LABEL}>
            Phone <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            className={FIELD}
            placeholder="301-555-0100"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="signatureName" className={LABEL}>
            Type your full legal name to sign
          </label>
          <input
            id="signatureName"
            type="text"
            className={`${FIELD} font-[cursive] text-lg`}
            placeholder="Your legal signature"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
          />
          {errors.signatureName && <p className={ERR}>{errors.signatureName}</p>}
        </div>

        <label className="flex items-start gap-3 cursor-pointer pt-1">
          <input
            type="checkbox"
            className="mt-1 w-5 h-5 rounded border-ngpa-slate/60 bg-ngpa-deep/80 accent-ngpa-lime shrink-0"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span className="text-sm text-ngpa-white/80 leading-snug">
            I am the participant&rsquo;s parent or legal guardian. I have read and
            agree to the Liability Waiver, Assumption of Risk &amp; Media Release
            above, and I am signing it electronically on my child&rsquo;s behalf.
          </span>
        </label>
        {errors.agree && <p className={ERR}>{errors.agree}</p>}
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-7 w-full px-8 py-4 bg-ngpa-lime text-ngpa-deep font-heading font-bold text-lg rounded-full hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-xl shadow-ngpa-lime/20 min-h-[48px]"
      >
        {status === "submitting" ? "Signing…" : "Sign & save waiver"}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        You only sign once — it covers your child for every NGA program. We email
        you a copy for your records.
      </p>
    </form>
  );
}
