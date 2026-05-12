"use client";

import { useState } from "react";
import type { NgaSession } from "@/lib/notion-sessions";
import { REGISTRATION_WINDOW_DAYS } from "@/data/schedule";
import {
  validateRsvpForm,
  type RsvpFormData,
  type RsvpValidationErrors,
} from "@/lib/validate-rsvp";

const FIELD_INPUT =
  "w-full rounded-lg bg-ngpa-black border border-ngpa-slate text-ngpa-white px-3 py-2.5 text-base placeholder:text-ngpa-muted focus:outline-none focus:border-ngpa-lime";

interface Props {
  session: NgaSession;
}

export default function ReserveButton({ session }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<RsvpValidationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

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
      childAge: String(fd.get("childAge") ?? ""),
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

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reserve-title"
        >
          <div className="bg-ngpa-panel w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-ngpa-slate max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between p-5 border-b border-ngpa-slate">
              <div>
                <h3
                  id="reserve-title"
                  className="font-heading text-lg font-bold text-ngpa-white"
                >
                  {session.title || `${session.level ?? ""} Ball`}
                </h3>
                <p className="text-sm text-ngpa-muted mt-1">
                  {formatLongDate(session.date)} · {session.startTime}–
                  {session.endTime} · {session.location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ngpa-muted hover:text-ngpa-white text-2xl leading-none -mt-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-5 space-y-4">
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
              <Field label="Child's age" error={errors.childAge}>
                <input
                  name="childAge"
                  type="number"
                  inputMode="numeric"
                  min={4}
                  max={16}
                  className={FIELD_INPUT}
                />
              </Field>

              {serverError && (
                <p className="text-sm text-red-400">{serverError}</p>
              )}

              <p className="text-xs text-ngpa-muted">
                You&rsquo;ll be redirected to Stripe to pay $40 for this
                1-hour slot. Drop-in payments are non-refundable.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3.5 rounded-full bg-ngpa-lime text-ngpa-black font-bold hover:bg-ngpa-cyan transition-colors disabled:opacity-60"
              >
                {submitting ? "Redirecting…" : "Continue to payment · $40"}
              </button>
            </form>
          </div>
        </div>
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
