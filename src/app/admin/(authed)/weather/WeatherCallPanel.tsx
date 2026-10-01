"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface PanelGroup {
  group: "Green" | "Yellow";
  label: string;
  timeLabel: string;
  callTime: string;
  status: string;
  state: string;
  stateLabel: string;
}

export interface PanelDate {
  date: string;
  label: string;
  groups: PanelGroup[];
}

export interface PanelRainDate {
  date: string;
  label: string;
  cupf: string;
  usedBy: string[];
  needsBooking: boolean;
  bookingLine: string;
}

interface Props {
  dates: PanelDate[];
  focus: string | null;
  rain: PanelRainDate[];
  todayIso: string;
  enabled: boolean;
  activeMontgomeryUrl: string;
}

interface CallResult {
  ok: boolean;
  dryRun: boolean;
  action: string;
  error?: string;
  makeups: { group: string; makeupDate: string | null }[];
  cupf: { date: string; cupf: string; usedBy: { group: string; makeupFor: string }[] }[];
  whatsapp: { group: string; text: string; shareUrl: string }[];
  email: {
    subject: string | null;
    preview: string | null;
    recipients: string[];
    sent: string[];
    failed: string[];
    skipped: { group: string; reason: string }[];
  } | null;
  warnings: string[];
}

const SKIP_REASON: Record<string, string> = {
  already_notified: "already emailed — tick “email again” to resend",
  past_date: "date has passed — recorded only",
  notify_off: "email turned off",
};

/** "2026-11-01" → "Sun, Nov 1" — noon-UTC anchor so the day never shifts. */
function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const btn =
  "inline-flex items-center justify-center px-4 py-2.5 rounded-full font-heading text-sm font-bold transition-all min-h-[44px] disabled:opacity-50";

// One screen for Sunday morning: pick the date and group, preview who gets told,
// make the call, then post it to WhatsApp and book the rain date. Every action
// is a POST to /api/admin/fall-calls; the server re-reads and re-validates.
export default function WeatherCallPanel({
  dates,
  focus,
  rain,
  todayIso,
  enabled,
  activeMontgomeryUrl,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState(focus ?? dates[0]?.date ?? "");
  const current = useMemo(() => dates.find((d) => d.date === date), [dates, date]);
  const [groups, setGroups] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [extra, setExtra] = useState("");
  const [resend, setResend] = useState(false);
  const [preview, setPreview] = useState<CallResult | null>(null);
  const [result, setResult] = useState<CallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = (current?.groups ?? []).filter((g) => groups.includes(g.group));

  function reset(nextDate?: string) {
    if (nextDate !== undefined) setDate(nextDate);
    setGroups([]);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function post(body: Record<string, unknown>): Promise<CallResult | null> {
    const res = await fetch("/api/admin/fall-calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as CallResult & { error?: string };
    if (!res.ok || !json.ok) {
      setError(json.error ?? `Request failed (${res.status})`);
      return null;
    }
    return json;
  }

  function cancelBody(dryRun: boolean) {
    return {
      action: "cancel",
      date,
      groups,
      note,
      ...(extra.trim() ? { extraEmails: extra } : {}),
      ...(resend ? { resend: true } : {}),
      dryRun,
    };
  }

  function runPreview() {
    startTransition(async () => {
      setError(null);
      setResult(null);
      setPreview(await post(cancelBody(true)));
    });
  }

  function runCancel() {
    const who = chosen.map((g) => g.label).join(" and ");
    const n = preview?.email?.recipients.length ?? 0;
    if (!window.confirm(`Cancel ${who} on ${current?.label}?\n\nThis updates the website and emails ${n} famil${n === 1 ? "y" : "ies"}.`)) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const r = await post(cancelBody(false));
      if (r) {
        setResult(r);
        setPreview(null);
        router.refresh();
      }
    });
  }

  function runSimple(action: "on" | "revert") {
    startTransition(async () => {
      setError(null);
      setPreview(null);
      const r = await post({ action, date, groups });
      if (r) {
        setResult(r);
        router.refresh();
      }
    });
  }

  function setCupf(rainDate: string, cupf: string) {
    startTransition(async () => {
      setError(null);
      const r = await post({ action: "cupf", date: rainDate, cupf });
      if (r) router.refresh();
    });
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  const shown = result ?? preview;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4 sm:p-6">
        <label className="flex flex-col gap-1 text-xs text-ngpa-white/70 mb-4">
          Date
          <select
            value={date}
            onChange={(e) => reset(e.target.value)}
            className="min-h-[44px] rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-3 py-2 text-sm text-ngpa-white focus:border-ngpa-teal focus:outline-none"
          >
            {dates.map((d) => (
              <option key={d.date} value={d.date}>
                {d.label}
                {d.date === todayIso ? " (today)" : ""} —{" "}
                {d.groups.map((g) => `${g.group}: ${g.stateLabel}`).join(" · ")}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2 mb-4">
          <legend className="text-xs text-ngpa-white/70 mb-1">Which group(s)?</legend>
          {(current?.groups ?? []).map((g) => (
            <label
              key={g.group}
              className="flex items-center gap-3 rounded-xl border border-ngpa-slate/60 bg-ngpa-deep/40 px-3 py-3 min-h-[48px]"
            >
              <input
                type="checkbox"
                className="h-5 w-5 accent-lime-400"
                checked={groups.includes(g.group)}
                onChange={(e) => {
                  setPreview(null);
                  setResult(null);
                  setGroups((prev) =>
                    e.target.checked ? [...prev, g.group] : prev.filter((x) => x !== g.group),
                  );
                }}
              />
              <span className="flex-1">
                <span className="font-bold">{g.label}</span>{" "}
                <span className="text-ngpa-white/60 text-sm">
                  {g.timeLabel} · call by {g.callTime}
                </span>
              </span>
              <span className="text-xs text-ngpa-white/70">{g.stateLabel}</span>
            </label>
          ))}
          {!current?.groups.length && (
            <p className="text-sm text-ngpa-white/60">No session on this date.</p>
          )}
        </fieldset>

        <label className="flex flex-col gap-1 text-xs text-ngpa-white/70 mb-3">
          Reason families will see (optional)
          <input
            value={note}
            maxLength={200}
            onChange={(e) => {
              setNote(e.target.value);
              setPreview(null);
            }}
            placeholder="steady rain and wet courts"
            className="min-h-[44px] rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-3 py-2 text-sm text-ngpa-white focus:border-ngpa-teal focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ngpa-white/70 mb-3">
          Also email (families who paid off the website and have no roster row)
          <textarea
            value={extra}
            rows={2}
            onChange={(e) => {
              setExtra(e.target.value);
              setPreview(null);
            }}
            placeholder="parent@example.com, other@example.com"
            className="rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-3 py-2 text-sm text-ngpa-white focus:border-ngpa-teal focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-ngpa-white/70 mb-5">
          <input
            type="checkbox"
            checked={resend}
            onChange={(e) => {
              setResend(e.target.checked);
              setPreview(null);
            }}
          />
          Email again even if these families were already told
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runPreview}
            disabled={!enabled || pending || groups.length === 0}
            className={`${btn} border border-amber-300/70 text-amber-200 hover:bg-amber-300/10`}
          >
            {pending && !result ? "Working…" : "Preview cancellation"}
          </button>
          <button
            type="button"
            onClick={runCancel}
            disabled={!enabled || pending || !preview || groups.length === 0}
            className={`${btn} bg-red-500 text-white hover:brightness-110`}
          >
            Cancel &amp; notify families
          </button>
          <button
            type="button"
            onClick={() => runSimple("on")}
            disabled={!enabled || pending || groups.length === 0}
            className={`${btn} bg-ngpa-lime text-ngpa-deep hover:brightness-110`}
          >
            We&rsquo;re on
          </button>
          <button
            type="button"
            onClick={() => runSimple("revert")}
            disabled={!enabled || pending || groups.length === 0}
            className={`${btn} border border-ngpa-slate/60 text-ngpa-white/70 hover:border-ngpa-teal`}
          >
            Undo — back to scheduled
          </button>
        </div>
        <p className="mt-2 text-xs text-ngpa-white/50">
          Preview first: it shows exactly who gets the email and writes nothing.
        </p>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      </section>

      {shown && (
        <section className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4 sm:p-6 space-y-5">
          <h2 className="font-heading text-lg font-black">
            {shown.dryRun ? "Preview — nothing sent yet" : "Done"}
          </h2>

          {shown.warnings.length > 0 && (
            <ul className="text-sm text-amber-200 list-disc pl-5 space-y-1">
              {shown.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {shown.makeups.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-ngpa-white/55 mb-1">Make-up</p>
              {shown.makeups.map((m) => (
                <p key={m.group} className="text-sm">
                  {m.group} Ball → {m.makeupDate ? dayLabel(m.makeupDate) : "no rain date left"}
                </p>
              ))}
            </div>
          )}

          {shown.email && (
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-ngpa-white/55 mb-1">Email</p>
              {shown.email.skipped.map((s) => (
                <p key={s.group} className="text-sm text-ngpa-white/70">
                  {s.group}: not emailed — {SKIP_REASON[s.reason] ?? s.reason}
                </p>
              ))}
              {shown.email.subject && (
                <>
                  <p className="text-sm">
                    <b>{shown.email.subject}</b>
                  </p>
                  <p className="text-sm text-ngpa-white/70">
                    {shown.dryRun
                      ? `Will go to ${shown.email.recipients.length}: ${shown.email.recipients.join(", ") || "nobody"}`
                      : `Sent ${shown.email.sent.length}${shown.email.failed.length ? ` · FAILED ${shown.email.failed.join(", ")}` : ""}`}
                  </p>
                  {shown.email.preview && (
                    <details className="mt-2">
                      <summary className="text-xs text-ngpa-teal cursor-pointer">Read the email</summary>
                      <pre className="mt-2 whitespace-pre-wrap text-xs text-ngpa-white/75 bg-ngpa-deep/60 rounded-lg p-3">
                        {shown.email.preview}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}

          {shown.whatsapp.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-ngpa-white/55 mb-2">
                WhatsApp {shown.dryRun ? "(post after you confirm)" : "— post it in each group"}
              </p>
              <div className="space-y-3">
                {shown.whatsapp.map((w) => (
                  <div key={w.group} className="rounded-xl bg-ngpa-deep/60 p-3">
                    <pre className="whitespace-pre-wrap text-xs text-ngpa-white/80 mb-3">{w.text}</pre>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={w.shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`${btn} bg-emerald-500 text-white hover:brightness-110`}
                      >
                        Post to {w.group} WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={() => copy(w.text, w.group)}
                        className={`${btn} border border-ngpa-slate/60 hover:border-ngpa-teal`}
                      >
                        {copied === w.group ? "Copied" : "Copy text"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4 sm:p-6">
        <h2 className="font-heading text-lg font-black mb-1">Rain dates &amp; CUPF</h2>
        <p className="text-sm text-ngpa-white/60 mb-4">
          Rain dates aren&rsquo;t booked up front. When a cancellation claims one, book it on
          ActiveMONTGOMERY as the Next Gen org account (Purpose: Youth Sports) — or run{" "}
          <code className="font-mono text-ngpa-teal">/am-book</code> on the Mac — then mark it here.
          CUPF reviews requests, so book the same day.
        </p>
        <div className="space-y-3">
          {rain.map((r) => (
            <div
              key={r.date}
              className={`rounded-xl border p-3 ${r.needsBooking ? "border-amber-300/60 bg-amber-300/5" : "border-ngpa-slate/60 bg-ngpa-deep/40"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{r.label}</p>
                <p className="text-xs text-ngpa-white/70">CUPF: {r.cupf}</p>
              </div>
              <p className="text-sm text-ngpa-white/70">
                {r.usedBy.length ? `Claimed by ${r.usedBy.join(", ")}` : "Not needed yet"}
              </p>
              {r.needsBooking && (
                <p className="text-sm text-amber-200 mt-1">Book: {r.bookingLine}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <a
                  href={activeMontgomeryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${btn} border border-ngpa-slate/60 hover:border-ngpa-teal`}
                >
                  Open ActiveMONTGOMERY
                </a>
                {["Not booked", "Requested", "Booked"]
                  .filter((s) => s !== r.cupf)
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!enabled || pending}
                      onClick={() => setCupf(r.date, s)}
                      className={`${btn} ${s === "Booked" ? "bg-ngpa-lime text-ngpa-deep" : "border border-ngpa-slate/60"}`}
                    >
                      Mark {s.toLowerCase()}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
