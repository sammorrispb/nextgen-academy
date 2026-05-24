"use client";

import { useEffect, useRef, useState } from "react";
import {
  validatePollVote,
  type Level,
  type PollVoteFormData,
  type PollVoteValidationErrors,
  type Vote,
} from "@/lib/validate-poll-vote";

const AGE_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 7); // 7-17
const VOTES: Vote[] = ["Yes", "Maybe", "No"];
const LEVELS: Level[] = ["Red", "Orange", "Green", "Yellow"];

type FormStatus = "idle" | "submitting" | "success" | "error";

const empty: PollVoteFormData = {
  parentName: "",
  email: "",
  phone: "",
  childFirstName: "",
  childAge: "",
  childLevel: "",
  vote: "",
  note: "",
};

interface PollVoteFormProps {
  pollSlug: string;
  pollTitle: string;
  pollLevel: Level | "";
}

type TrackingContext = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export default function PollVoteForm({
  pollSlug,
  pollTitle,
  pollLevel,
}: PollVoteFormProps) {
  const [form, setForm] = useState<PollVoteFormData>(() => ({
    ...empty,
    childLevel: pollLevel,
  }));
  const [errors, setErrors] = useState<PollVoteValidationErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const trackingRef = useRef<TrackingContext>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    trackingRef.current = {
      utm_source: params.get("utm_source") ?? undefined,
      utm_medium: params.get("utm_medium") ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined,
    };
  }, []);

  function update<K extends keyof PollVoteFormData>(
    field: K,
    value: PollVoteFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof PollVoteValidationErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof PollVoteValidationErrors];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const allErrors = validatePollVote(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const first = Object.keys(allErrors)[0];
      document.getElementById(first)?.focus();
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/crew-poll/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollSlug,
          ...form,
          ...trackingRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
          setStatus("error");
          return;
        }
        throw new Error(data.error || "Something went wrong");
      }
      setStatus("success");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-ngpa-panel/80 backdrop-blur rounded-2xl p-8 sm:p-10 border border-ngpa-slate/60 text-center">
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
        <h3 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white mb-3 tracking-tight">
          Got your vote!
        </h3>
        <p className="text-ngpa-white/75 text-base sm:text-lg max-w-md mx-auto">
          We&rsquo;ll text the group when the crew is locked in for{" "}
          <span className="text-ngpa-teal font-bold">{pollTitle}</span>. Check
          your inbox for confirmation.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
  const selectClass = `${inputClass} appearance-none cursor-pointer`;
  const labelClass = "block font-heading text-sm font-bold text-ngpa-white mb-1.5";
  const errorClass = "text-ngpa-red text-sm mt-1.5";

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
          <label htmlFor="parentName" className={labelClass}>
            Your Name
          </label>
          <input
            id="parentName"
            type="text"
            autoComplete="name"
            className={inputClass}
            placeholder="First and last name"
            value={form.parentName}
            onChange={(e) => update("parentName", e.target.value)}
          />
          {errors.parentName && <p className={errorClass}>{errors.parentName}</p>}
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={inputClass}
            placeholder="you@email.com"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone <span className="text-ngpa-white/50 font-normal">(optional, for WhatsApp)</span>
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            className={inputClass}
            placeholder="(301) 555-1234"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="childFirstName" className={labelClass}>
              Child&rsquo;s First Name
            </label>
            <input
              id="childFirstName"
              type="text"
              className={inputClass}
              placeholder="Avery"
              value={form.childFirstName}
              onChange={(e) => update("childFirstName", e.target.value)}
            />
            {errors.childFirstName && (
              <p className={errorClass}>{errors.childFirstName}</p>
            )}
          </div>

          <div>
            <label htmlFor="childAge" className={labelClass}>
              Age
            </label>
            <select
              id="childAge"
              className={selectClass}
              value={form.childAge}
              onChange={(e) => update("childAge", e.target.value)}
            >
              <option value="">Select age</option>
              {AGE_OPTIONS.map((age) => (
                <option key={age} value={String(age)}>
                  {age}
                </option>
              ))}
            </select>
            {errors.childAge && <p className={errorClass}>{errors.childAge}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="childLevel" className={labelClass}>
            Child&rsquo;s Level
          </label>
          <div
            id="childLevel"
            role="radiogroup"
            aria-label="Child's level"
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          >
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                role="radio"
                aria-checked={form.childLevel === lvl}
                onClick={() => update("childLevel", lvl)}
                className={`min-h-[48px] px-3 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                  form.childLevel === lvl
                    ? "border-ngpa-teal bg-ngpa-teal/15 text-ngpa-white"
                    : "border-ngpa-slate/60 bg-ngpa-deep/60 text-ngpa-white/70 hover:border-ngpa-slate"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
          {errors.childLevel && <p className={errorClass}>{errors.childLevel}</p>}
        </div>

        <div>
          <label htmlFor="vote" className={labelClass}>
            Can you make this slot?
          </label>
          <div
            id="vote"
            role="radiogroup"
            aria-label="Vote"
            className="grid grid-cols-3 gap-2"
          >
            {VOTES.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.vote === v}
                onClick={() => update("vote", v)}
                className={`min-h-[48px] px-3 py-3 rounded-xl border-2 font-bold transition-all ${
                  form.vote === v
                    ? "border-ngpa-teal bg-ngpa-teal/15 text-ngpa-white"
                    : "border-ngpa-slate/60 bg-ngpa-deep/60 text-ngpa-white/70 hover:border-ngpa-slate"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {errors.vote && <p className={errorClass}>{errors.vote}</p>}
        </div>

        <div>
          <label htmlFor="note" className={labelClass}>
            Note for Coach <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <textarea
            id="note"
            rows={2}
            className={inputClass}
            placeholder="Anything Sam should know about this slot for your kid"
            value={form.note}
            onChange={(e) => update("note", e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-7 w-full px-8 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
      >
        {status === "submitting" ? "Submitting..." : "Submit my vote →"}
      </button>

      <p className="text-ngpa-white/55 text-xs text-center mt-4">
        No spam. We&rsquo;ll only text when the crew is set. You can pull your
        vote any time &mdash; reply &ldquo;remove&rdquo; to the confirmation.
      </p>
    </form>
  );
}
