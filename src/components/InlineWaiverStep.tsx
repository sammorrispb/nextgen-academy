"use client";

import { useEffect, useRef, useState } from "react";
import {
  WAIVER_UPDATED,
  WAIVER_INTRO,
  WAIVER_SECTIONS,
  WAIVER_CONTACT_PHONE,
} from "@/data/waiver";
import {
  validateWaiverSignForm,
  type WaiverSignValidationErrors,
} from "@/lib/validate-waiver-sign";
import { getUtm } from "@/lib/funnelClient";

/**
 * The one-time waiver, signed WITHOUT leaving the registration form.
 *
 * The gate 409s mid-checkout. Sending the parent to /waiver/sign meant a full
 * page navigation, which discarded the React state holding their whole
 * registration — they came back to an empty form and had to retype every
 * field, so the funnel died there instead of reaching Stripe. Rendering the
 * waiver in place keeps the payload alive in state: sign, and the form retries
 * checkout with what it already had.
 *
 * Parent name / email / phone come from the registration form the parent just
 * filled in, so the only thing asked for here is the signature and the "I
 * agree" attestation. The waiver copy renders from src/data/waiver.ts — the
 * same source /waiver, /waiver/sign and the emailed record copy use — so the
 * text a parent agrees to inline can never drift from the archived version.
 */

interface InlineWaiverStepProps {
  parentName: string;
  email: string;
  phone?: string;
  /** Signed successfully — the host form resumes checkout from here. */
  onSigned: () => void;
  /** Back out to the registration fields (they are hidden, never unmounted). */
  onCancel: () => void;
  /** Where the parent was headed, e.g. "the season". Used in the CTA copy. */
  continueLabel?: string;
}

type Status = "idle" | "submitting" | "done";

export default function InlineWaiverStep({
  parentName,
  email,
  phone,
  onSigned,
  onCancel,
  continueLabel = "payment",
}: InlineWaiverStepProps) {
  const [signatureName, setSignatureName] = useState("");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<WaiverSignValidationErrors>({});
  const [serverError, setServerError] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The fields the parent was looking at just vanished behind this step —
  // move focus so the change is announced rather than silent.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function handleSign() {
    setServerError("");
    const payload = {
      parentName,
      email,
      phone,
      signatureName,
      agree,
      ...getUtm(),
    };
    const allErrors = validateWaiverSignForm(payload);
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
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.errors) {
          setErrors(json.errors);
          setStatus("idle");
          return;
        }
        throw new Error(json.error || "Something went wrong");
      }
      // Hand straight back to the form — it still holds the registration.
      setStatus("done");
      onSigned();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setStatus("idle");
    }
  }

  const busy = status === "submitting" || status === "done";

  return (
    <div className="bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal-bright">
        One quick thing
      </p>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-xl sm:text-2xl font-black text-ngpa-white mt-1 tracking-tight focus:outline-none"
      >
        Sign your one-time waiver
      </h3>
      <p className="mt-2 text-sm text-ngpa-white/75 leading-relaxed">
        You only sign this once and it covers your player for every NGA program.{" "}
        <strong className="text-ngpa-white">
          Your registration details are saved
        </strong>{" "}
        — sign below and we&rsquo;ll take you straight to {continueLabel}.
      </p>
      <p className="mt-1 text-xs text-ngpa-muted">
        Last updated: {WAIVER_UPDATED}
      </p>

      <p className="mt-4 text-xs leading-relaxed text-ngpa-muted">
        {WAIVER_INTRO}
      </p>

      <div className="mt-4 space-y-4 rounded-xl border border-ngpa-slate/60 bg-ngpa-deep/40 p-4 max-h-64 overflow-y-auto">
        {WAIVER_SECTIONS.map((s) => (
          <div key={s.n}>
            <h4 className="font-heading text-sm font-bold text-ngpa-white">
              {s.n}. {s.title}
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-ngpa-muted">
              {s.body}
            </p>
          </div>
        ))}
      </div>

      {serverError && (
        <div className="bg-ngpa-red/10 border border-ngpa-red/30 rounded-lg p-4 mt-5">
          <p className="text-ngpa-red text-sm font-medium">{serverError}</p>
        </div>
      )}

      <div className="mt-5">
        <label
          htmlFor="waiverSignatureName"
          className="block font-heading text-sm font-bold text-ngpa-white mb-1.5"
        >
          Type your full legal name to sign
        </label>
        <input
          id="waiverSignatureName"
          type="text"
          className="w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white font-[cursive] text-lg placeholder:text-ngpa-white/40 placeholder:font-sans placeholder:text-base focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all"
          placeholder="Your legal signature"
          value={signatureName}
          onChange={(e) => {
            setSignatureName(e.target.value);
            if (errors.signatureName) {
              setErrors((prev) => ({ ...prev, signatureName: undefined }));
            }
          }}
        />
        {errors.signatureName && (
          <p className="text-ngpa-red text-sm mt-1.5">{errors.signatureName}</p>
        )}
        {(errors.parentName || errors.email) && (
          <p className="text-ngpa-red text-sm mt-1.5">
            {errors.parentName ?? errors.email} — go back and check your details.
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer mt-4">
        <input
          type="checkbox"
          className="mt-1 w-5 h-5 rounded border-ngpa-slate/60 bg-ngpa-deep/80 accent-ngpa-lime shrink-0"
          checked={agree}
          onChange={(e) => {
            setAgree(e.target.checked);
            if (errors.agree) {
              setErrors((prev) => ({ ...prev, agree: undefined }));
            }
          }}
        />
        <span className="text-sm text-ngpa-white/80 leading-snug">
          I am the participant&rsquo;s parent or legal guardian. I have read and
          agree to the Liability Waiver, Assumption of Risk &amp; Media Release
          above, and I am signing it electronically on my child&rsquo;s behalf.
        </span>
      </label>
      {errors.agree && (
        <p className="text-ngpa-red text-sm mt-1.5">{errors.agree}</p>
      )}

      <button
        type="button"
        onClick={handleSign}
        disabled={busy}
        className="mt-6 w-full px-8 py-4 bg-ngpa-lime text-ngpa-deep font-heading font-bold text-lg rounded-full hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-xl shadow-ngpa-lime/20 min-h-[48px]"
      >
        {busy ? "Signing…" : `Sign & continue to ${continueLabel} →`}
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="mt-3 w-full px-4 py-3 text-sm font-semibold text-ngpa-white/70 hover:text-ngpa-white transition-colors disabled:opacity-60 min-h-[48px]"
      >
        ← Back to your details
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-3">
        We email a copy to {email} for your records. Questions? Text Coach Sam
        at {WAIVER_CONTACT_PHONE}.
      </p>
    </div>
  );
}
