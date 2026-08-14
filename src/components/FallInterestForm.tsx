"use client";

import { useEffect, useRef, useState } from "react";
import {
  validateFallInterest,
  type FallInterestErrors,
  type FallInterestFormData,
} from "@/lib/validate-fall-interest";
import {
  FALL_ADULT_BRACKETS,
  FALL_COMMITMENTS,
  FALL_DAYS,
  FALL_NO_HOLD_NOTE,
  FALL_PRICE_BANDS,
  FALL_SEASON_WEEKS,
  FALL_YOUTH_LEVELS,
  type FallAdultBracket,
  type FallDay,
  type FallTrack,
  type FallYouthLevel,
} from "@/data/fall-2026";
import { trackEvent, getVisitorIdForForm, getUtm } from "@/lib/funnelClient";

const AGE_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 6);

const LEVEL_HINTS: Record<FallYouthLevel, string> = {
  Red: "First time on a court",
  Orange: "Rallies a bit, still learning",
  Green: "Rallies well, knows the rules",
  Yellow: "Competitive / tournament-track",
};

const BRACKET_HINTS: Record<FallAdultBracket, string> = {
  New: "Just starting — serve, kitchen, rules",
  Rallying: "Sustaining rallies, learning to keep score",
  Playing: "Full games with intent; learning the third shot",
  Competing: "Controls pace and placement",
  "Tournament Level": "Playing competitive tournaments",
};

const TRACK_OPTIONS: { key: FallTrack; label: string; hint: string }[] = [
  { key: "youth", label: "My kid", hint: "Ages 6–16, the youth season" },
  { key: "adult", label: "Me", hint: "Adults, the round robin" },
];

type FormStatus = "idle" | "submitting" | "success" | "error";

const emptyForm: FallInterestFormData = {
  respondentName: "",
  email: "",
  phone: "",
  track: [],
  childFirstName: "",
  childAge: "",
  childLevel: "",
  adultBracket: "",
  days: [],
  commitment: "",
  subListInterest: false,
  youthPriceBand: "",
  adultPriceBand: "",
  notes: "",
};

type TrackingContext = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing_page?: string;
};

export default function FallInterestForm() {
  const [form, setForm] = useState<FallInterestFormData>(emptyForm);
  const [errors, setErrors] = useState<FallInterestErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState("");
  const trackingRef = useRef<TrackingContext>({});
  const startedFiredRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stashed = getUtm();
    trackingRef.current = {
      utm_source: params.get("utm_source") ?? stashed.utm_source ?? undefined,
      utm_medium: params.get("utm_medium") ?? stashed.utm_medium ?? undefined,
      utm_campaign:
        params.get("utm_campaign") ?? stashed.utm_campaign ?? undefined,
      referrer: document.referrer || undefined,
      landing_page: window.location.href,
    };
  }, []);

  const wantsYouth = form.track.includes("youth");
  const wantsAdult = form.track.includes("adult");

  type SimpleField =
    | "respondentName"
    | "email"
    | "phone"
    | "childFirstName"
    | "childAge"
    | "childLevel"
    | "adultBracket"
    | "commitment"
    | "youthPriceBand"
    | "adultPriceBand"
    | "notes";

  function clearError(field: keyof FallInterestErrors) {
    if (!errors[field]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function updateField(field: SimpleField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearError(field as keyof FallInterestErrors);
    if (!startedFiredRef.current && value) {
      startedFiredRef.current = true;
      trackEvent("fall_interest_started", {
        interest: "fall_interest",
        page: window.location.pathname,
      });
    }
  }

  function toggleTrack(track: FallTrack) {
    setForm((prev) => ({
      ...prev,
      track: prev.track.includes(track)
        ? prev.track.filter((t) => t !== track)
        : [...prev.track, track],
    }));
    clearError("track");
  }

  function toggleDay(day: FallDay) {
    setForm((prev) => {
      // "Sunday doesn't work" is mutually exclusive with "Sunday" — holding
      // both would make the answer unreadable.
      if (day === "Sunday doesn't work") {
        return {
          ...prev,
          days: prev.days.includes(day) ? [] : ["Sunday doesn't work"],
        };
      }
      const withoutNo = prev.days.filter((d) => d !== "Sunday doesn't work");
      return {
        ...prev,
        days: withoutNo.includes(day)
          ? withoutNo.filter((d) => d !== day)
          : [...withoutNo, day],
      };
    });
    clearError("days");
  }

  function handleBlur(field: SimpleField) {
    const fieldErrors = validateFallInterest(form);
    const key = field as keyof FallInterestErrors;
    if (fieldErrors[key]) {
      setErrors((prev) => ({ ...prev, [key]: fieldErrors[key] }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const allErrors = validateFallInterest(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      document.getElementById(Object.keys(allErrors)[0])?.focus();
      return;
    }

    setStatus("submitting");

    const payload = {
      ...form,
      ...trackingRef.current,
      visitor_id: getVisitorIdForForm() || null,
    };

    try {
      const res = await fetch("/api/fall-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      trackEvent("fall_interest_submitted", {
        interest: "fall_interest",
        page: window.location.pathname,
      });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setStatus("error");
    }
  }

  const inputClass =
    "w-full bg-ngpa-deep/60 border border-ngpa-slate/60 rounded-xl px-4 py-3.5 text-ngpa-white placeholder:text-ngpa-white/40 focus:outline-none focus:ring-2 focus:ring-ngpa-teal focus:border-ngpa-teal transition-all";
  const selectClass = `${inputClass} appearance-none cursor-pointer`;
  const labelClass =
    "block font-heading text-sm font-bold text-ngpa-white mb-1.5";
  const hintClass = "block text-xs text-ngpa-white/55 mb-1.5";
  const errorClass = "text-ngpa-red text-sm mt-1.5";
  const chipBase =
    "min-h-[48px] px-4 py-3 rounded-xl border text-sm font-semibold transition-colors";
  const chipOn = "bg-ngpa-teal text-ngpa-deep border-ngpa-teal";
  const chipOff =
    "bg-ngpa-deep/60 text-ngpa-white border-ngpa-slate/60 hover:border-ngpa-teal/60";

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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white mb-3 tracking-tight">
          Got it, {form.respondentName.split(" ")[0]}.
        </h3>
        <p className="text-ngpa-white/75 text-lg mb-4 max-w-md mx-auto">
          That&rsquo;s exactly what we needed. Check your inbox for a summary of
          what you told us.
        </p>
        <p className="text-ngpa-white/55 text-sm max-w-md mx-auto">
          {FALL_NO_HOLD_NOTE}
        </p>
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

      <div className="space-y-6">
        {/* Who's playing — drives which branch of the form appears. */}
        <fieldset>
          <legend className={labelClass}>Who would be playing?</legend>
          <span className={hintClass}>Pick one or both.</span>
          <div id="track" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TRACK_OPTIONS.map((opt) => {
              const on = form.track.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTrack(opt.key)}
                  className={`${chipBase} text-left ${on ? chipOn : chipOff}`}
                >
                  <span className="block">{opt.label}</span>
                  <span
                    className={`block text-xs font-normal mt-0.5 ${on ? "text-ngpa-deep/70" : "text-ngpa-white/55"}`}
                  >
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.track && <p className={errorClass}>{errors.track}</p>}
        </fieldset>

        <div>
          <label htmlFor="respondentName" className={labelClass}>
            Your name
          </label>
          <input
            id="respondentName"
            type="text"
            autoComplete="name"
            className={inputClass}
            placeholder="First and last name"
            value={form.respondentName}
            onChange={(e) => updateField("respondentName", e.target.value)}
            onBlur={() => handleBlur("respondentName")}
          />
          {errors.respondentName && (
            <p className={errorClass}>{errors.respondentName}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              onChange={(e) => updateField("email", e.target.value)}
              onBlur={() => handleBlur("email")}
            />
            {errors.email && <p className={errorClass}>{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone{" "}
              <span className="text-ngpa-white/50 font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              className={inputClass}
              placeholder="301-555-0142"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              onBlur={() => handleBlur("phone")}
            />
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>
        </div>

        {wantsYouth && (
          <div className="rounded-xl border border-ngpa-slate/60 bg-ngpa-deep/40 p-4 sm:p-5 space-y-4">
            <p className="font-heading text-sm font-bold text-ngpa-lime uppercase tracking-widest">
              About your kid
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="childFirstName" className={labelClass}>
                  First name
                </label>
                <input
                  id="childFirstName"
                  type="text"
                  className={inputClass}
                  placeholder="Ava"
                  value={form.childFirstName}
                  onChange={(e) =>
                    updateField("childFirstName", e.target.value)
                  }
                  onBlur={() => handleBlur("childFirstName")}
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
                  onChange={(e) => updateField("childAge", e.target.value)}
                  onBlur={() => handleBlur("childAge")}
                >
                  <option value="">Select age</option>
                  {AGE_OPTIONS.map((age) => (
                    <option key={age} value={String(age)}>
                      {age}
                    </option>
                  ))}
                </select>
                {errors.childAge && (
                  <p className={errorClass}>{errors.childAge}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="childLevel" className={labelClass}>
                Color group
              </label>
              <span className={hintClass}>
                Not sure? Pick your best guess — we sort it out on court.
              </span>
              <select
                id="childLevel"
                className={selectClass}
                value={form.childLevel}
                onChange={(e) => updateField("childLevel", e.target.value)}
                onBlur={() => handleBlur("childLevel")}
              >
                <option value="">Select a color group</option>
                {FALL_YOUTH_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level} — {LEVEL_HINTS[level]}
                  </option>
                ))}
              </select>
              {errors.childLevel && (
                <p className={errorClass}>{errors.childLevel}</p>
              )}
            </div>

            <div>
              <label htmlFor="youthPriceBand" className={labelClass}>
                What would the youth season be worth to you?{" "}
                <span className="text-ngpa-white/50 font-normal">
                  (optional)
                </span>
              </label>
              <span className={hintClass}>
                {FALL_SEASON_WEEKS} weeks, 90 minutes a session. We
                haven&rsquo;t set a price — your answer helps us set a fair one.
              </span>
              <select
                id="youthPriceBand"
                className={selectClass}
                value={form.youthPriceBand}
                onChange={(e) => updateField("youthPriceBand", e.target.value)}
              >
                <option value="">Prefer not to say</option>
                {FALL_PRICE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band}
                  </option>
                ))}
              </select>
              {errors.youthPriceBand && (
                <p className={errorClass}>{errors.youthPriceBand}</p>
              )}
            </div>
          </div>
        )}

        {wantsAdult && (
          <div className="rounded-xl border border-ngpa-slate/60 bg-ngpa-deep/40 p-4 sm:p-5 space-y-4">
            <p className="font-heading text-sm font-bold text-ngpa-lime uppercase tracking-widest">
              About you
            </p>

            <div>
              <label htmlFor="adultBracket" className={labelClass}>
                Your bracket
              </label>
              <span className={hintClass}>
                Same brackets Link &amp; Dink uses. Guess if you&rsquo;re new —
                nobody&rsquo;s locked in.
              </span>
              <select
                id="adultBracket"
                className={selectClass}
                value={form.adultBracket}
                onChange={(e) => updateField("adultBracket", e.target.value)}
                onBlur={() => handleBlur("adultBracket")}
              >
                <option value="">Select a bracket</option>
                {FALL_ADULT_BRACKETS.map((b) => (
                  <option key={b} value={b}>
                    {b} — {BRACKET_HINTS[b]}
                  </option>
                ))}
              </select>
              {errors.adultBracket && (
                <p className={errorClass}>{errors.adultBracket}</p>
              )}
            </div>

            <div>
              <label htmlFor="adultPriceBand" className={labelClass}>
                What would the adult round robin be worth to you?{" "}
                <span className="text-ngpa-white/50 font-normal">
                  (optional)
                </span>
              </label>
              <span className={hintClass}>
                {FALL_SEASON_WEEKS} weeks. No price set yet.
              </span>
              <select
                id="adultPriceBand"
                className={selectClass}
                value={form.adultPriceBand}
                onChange={(e) => updateField("adultPriceBand", e.target.value)}
              >
                <option value="">Prefer not to say</option>
                {FALL_PRICE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band}
                  </option>
                ))}
              </select>
              {errors.adultPriceBand && (
                <p className={errorClass}>{errors.adultPriceBand}</p>
              )}
            </div>
          </div>
        )}

        <fieldset>
          <legend className={labelClass}>Does Sunday work?</legend>
          <span className={hintClass}>
            Sunday afternoons at Wood Middle School — Green Ball
            1:00&ndash;2:30 PM, Yellow Ball 2:30&ndash;4:00 PM.
          </span>
          <div id="days" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FALL_DAYS.map((day) => {
              const on = form.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(day)}
                  className={`${chipBase} ${on ? chipOn : chipOff}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {errors.days && <p className={errorClass}>{errors.days}</p>}
        </fieldset>

        <div>
          <label htmlFor="commitment" className={labelClass}>
            Could you commit to the full {FALL_SEASON_WEEKS} weeks, paid up
            front?
          </label>
          <span className={hintClass}>
            Straight answers help most — &ldquo;maybe&rdquo; is a real answer.
          </span>
          <select
            id="commitment"
            className={selectClass}
            value={form.commitment}
            onChange={(e) => updateField("commitment", e.target.value)}
            onBlur={() => handleBlur("commitment")}
          >
            <option value="">Select an answer</option>
            {FALL_COMMITMENTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {errors.commitment && (
            <p className={errorClass}>{errors.commitment}</p>
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer min-h-[48px] py-2">
          <input
            type="checkbox"
            className="mt-1 w-5 h-5 rounded border-ngpa-slate/60 bg-ngpa-deep/60 text-ngpa-teal focus:ring-ngpa-teal"
            checked={form.subListInterest}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                subListInterest: e.target.checked,
              }))
            }
          />
          <span className="text-sm text-ngpa-white/85">
            <span className="font-bold text-ngpa-white">
              Add me to the sub list.
            </span>{" "}
            I&rsquo;d play week to week when a spot opens, even if I can&rsquo;t
            commit to the whole season.
          </span>
        </label>

        <div>
          <label htmlFor="notes" className={labelClass}>
            Anything else?{" "}
            <span className="text-ngpa-white/50 font-normal">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            className={inputClass}
            placeholder="A time that would work better, a friend who'd want in, a question…"
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 w-full inline-flex items-center justify-center px-6 py-4 bg-ngpa-lime text-ngpa-deep font-heading font-black rounded-full hover:bg-ngpa-lime/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors min-h-[48px] text-lg"
      >
        {status === "submitting" ? "Sending…" : "Send my answer →"}
      </button>

      <p className="mt-4 text-xs text-ngpa-white/55 text-center">
        {FALL_NO_HOLD_NOTE}
      </p>
    </form>
  );
}
