"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { NgaSession } from "@/lib/notion-sessions";
import { REGISTRATION_WINDOW_DAYS } from "@/data/schedule";
import {
  validateRsvpForm,
  type RsvpFormData,
  type RsvpValidationErrors,
} from "@/lib/validate-rsvp";

const FIELD_INPUT =
  "w-full rounded-lg bg-ngpa-deep/80 border border-ngpa-slate/60 text-ngpa-white px-3 py-2.5 text-base placeholder:text-ngpa-white/40 focus:outline-none focus:border-ngpa-teal focus:ring-1 focus:ring-ngpa-teal transition-colors";

interface Props {
  session: NgaSession;
}

export default function ReserveButton({ session }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<RsvpValidationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const disabled =
    session.status !== "Open" ||
    session.spotsLeft <= 0 ||
    !isWithinRegistrationWindow(session.date);

  const label =
    session.status === "Cancelled"
      ? "Cancelled"
      : session.spotsLeft <= 0
        ? "Full"
        : !isWithinRegistrationWindow(session.date)
          ? `Opens ${REGISTRATION_WINDOW_DAYS} days out`
          : "Reserve · $40";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const fd = new FormData(e.currentTarget);
    const data: Partial<RsvpFormData> = {
      parentName: String(fd.get("parentName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      childFirstName: String(fd.get("childFirstName") ?? ""),
      childBirthYear: String(fd.get("childBirthYear") ?? ""),
      sessionId: session.id,
    };
    const ve = validateRsvpForm(data);
    setErrors(ve);
    if (Object.keys(ve).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setServerError(json.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setServerError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={
          disabled
            ? "px-4 py-2.5 rounded-full text-sm font-bold bg-ngpa-slate text-ngpa-muted cursor-not-allowed min-w-[160px]"
            : "px-4 py-2.5 rounded-full text-sm font-bold bg-ngpa-lime text-ngpa-black hover:bg-ngpa-cyan transition-colors min-w-[160px]"
        }
      >
        {label}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 bg-ngpa-deep/90 backdrop-blur-md overflow-y-auto overscroll-contain"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reserve-title"
          onClick={() => setOpen(false)}
        >
          <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative bg-ngpa-panel w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-ngpa-slate/60 shadow-2xl shadow-black/60"
            >
              <div className="flex items-start justify-between p-5 border-b border-ngpa-slate/60">
                <div className="min-w-0 pr-3">
                  <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-1">
                    Reserve a Slot
                  </p>
                  <h3
                    id="reserve-title"
                    className="font-heading text-lg font-black text-ngpa-white tracking-tight"
                  >
                    {session.title || `${session.level ?? ""} Ball`}
                  </h3>
                  <p className="text-sm text-ngpa-white/70 mt-1">
                    {formatLongDate(session.date)} · {session.startTime}–
                    {session.endTime}
                  </p>
                  <p className="text-xs text-ngpa-white/55 mt-0.5">
                    {session.location}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-ngpa-white/60 hover:text-ngpa-white text-3xl leading-none -mt-1 shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form onSubmit={onSubmit}>
                <div className="px-5 py-5 space-y-4">
                  <Field label="Parent name" error={errors.parentName}>
                    <input
                      name="parentName"
                      type="text"
                      autoComplete="name"
                      className={FIELD_INPUT}
                    />
                  </Field>
                  <Field label="Email" error={errors.email}>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      className={FIELD_INPUT}
                    />
                  </Field>
                  <Field label="Phone" error={errors.phone}>
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      className={FIELD_INPUT}
                    />
                  </Field>
                  <Field
                    label="Child's first name"
                    error={errors.childFirstName}
                  >
                    <input
                      name="childFirstName"
                      type="text"
                      className={FIELD_INPUT}
                    />
                  </Field>
                  <Field
                    label="Child's birth year"
                    error={errors.childBirthYear}
                  >
                    <input
                      name="childBirthYear"
                      type="number"
                      inputMode="numeric"
                      placeholder="e.g., 2015"
                      min={new Date().getFullYear() - 18}
                      max={new Date().getFullYear() - 4}
                      className={FIELD_INPUT}
                    />
                  </Field>

                  {serverError && (
                    <p className="text-sm text-red-400" role="alert">
                      {serverError}
                    </p>
                  )}
                </div>

                <div className="sticky bottom-0 px-5 py-4 border-t border-ngpa-slate/60 bg-ngpa-panel sm:rounded-b-2xl space-y-3">
                  <p className="text-xs text-ngpa-white/60 leading-relaxed">
                    You&rsquo;ll be redirected to Stripe to pay $40 for this
                    1-hour slot. Drop-in payments are non-refundable.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-6 py-3.5 rounded-full bg-ngpa-lime text-ngpa-deep font-bold hover:brightness-110 transition-all disabled:opacity-60 min-h-[48px] shadow-xl shadow-ngpa-lime/20"
                  >
                    {submitting ? "Redirecting…" : "Continue to payment · $40"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-ngpa-white block mb-1.5">
        {label}
      </span>
      {children}
      {error && <span className="text-xs text-red-400 mt-1 block">{error}</span>}
    </label>
  );
}

function isWithinRegistrationWindow(date: string): boolean {
  if (!date) return false;
  const d = new Date(`${date}T00:00:00Z`);
  const ms = d.getTime() - Date.now();
  const windowMs = REGISTRATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return ms <= windowMs && ms > -24 * 60 * 60 * 1000;
}

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
