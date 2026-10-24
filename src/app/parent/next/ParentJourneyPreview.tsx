"use client";
import { useRef, useState } from "react";
import type { NgaPreferences, NgaProgramChoice, NgaPreview } from "@/lib/nga-journey";
const field = "w-full min-h-12 rounded-lg border border-ngpa-slate bg-ngpa-deep px-3 py-2 text-base text-ngpa-white focus:outline-2 focus:outline-offset-2 focus:outline-ngpa-teal";
interface Preview {
  state: NgaPreview["state"];
  reason?: string;
  assessment: { level: string | null; age: number | null };
  nextFocus?: { id: string; label: string };
  programs: NgaProgramChoice[];
  reviewedAt: string;
  expiresAt: string;
}
const headings: Record<string, string> = { recommendation: "Sessions to consider", needs_confirmation: "Coach confirmation needed", no_match: "No matching sessions", clarification: "A fresh coach review is needed", unavailable: "Preview unavailable" };
const timestamp = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const reasonLabels: Record<string, string> = { program_age_policy_unknown: "Your coach needs to confirm this program’s age range and any additional eligibility rules.", age_confirmation_required: "Confirm that the recorded age is current.", program_level_unknown: "Your coach needs to confirm which ball levels this session accepts.", capacity_unknown: "Current availability needs confirmation.", program_status_unknown: "The session’s current status needs confirmation.", program_time_unknown: "The session’s date or time needs confirmation.", required_day_unknown: "The required day could not be verified.", required_location_unknown: "The required venue could not be verified.", required_time_unknown: "The required time window could not be verified.", conflicting_destination_evidence: "The session has conflicting details. Ask your coach to check it before registering." };
export default function ParentJourneyPreview() {
  const [code, setCode] = useState("");
  const [reviewed, setReviewed] = useState<Preview | null>(null);
  const [result, setResult] = useState<Preview | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [dayMode, setDayMode] = useState<"required" | "preferred">("required");
  const [location, setLocation] = useState("");
  const [locationMode, setLocationMode] = useState<"required" | "preferred">("required");
  const [start, setStart] = useState(""), [end, setEnd] = useState("");
  const [timeMode, setTimeMode] = useState<"required" | "preferred">("required");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const generation = useRef(0);
  function changed() { generation.current += 1; setBusy(false); setResult(null); setError(""); }
  async function preview() {
    const version = ++generation.current; setBusy(true); setResult(null); setError("");
    const preferences: NgaPreferences = { ...(days.length ? { days: { mode: dayMode, values: days } } : {}), ...(location.trim() ? { locations: { mode: locationMode, values: [location.trim()] } } : {}), ...(start || end ? { time: { mode: timeMode, start, end } } : {}) };
    try {
      const response = await fetch("/api/parent/journey-preview", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json", Authorization: `Bearer ${code.trim()}` }, body: JSON.stringify({ preferences, ageConfirmed }) });
      const body = await response.json(); if (version !== generation.current) return;
      if (!response.ok) {
        if ([401, 404, 409].includes(response.status)) { setReviewed(null); setAgeConfirmed(false); setError("This preview code is no longer valid for the reviewed record. Ask your coach for a fresh code."); }
        else if ([400, 422].includes(response.status)) setError("Choose valid days, a venue and a time window with the end after the start. Travel distance and saved preferences are not available here.");
        else setError("The current session or assessment source could not be checked. Try again before choosing a session.");
        return;
      }
      setReviewed(body as Preview); setResult(body as Preview);
    } catch { if (version === generation.current) setError("The response was lost. You can safely retry this read-only preview."); }
    finally { if (version === generation.current) setBusy(false); }
  }
  return <div className="space-y-7">
    <form onSubmit={(event) => { event.preventDefault(); void preview(); }} className="space-y-6">
      <div className="rounded-2xl bg-ngpa-panel border border-ngpa-slate p-5 sm:p-6">
        <label htmlFor="parent-preview-code" className="block font-bold mb-2">Preview code from your coach</label>
        <input id="parent-preview-code" type="password" autoComplete="off" spellCheck={false} className={field} value={code} onChange={(event) => { changed(); setCode(event.target.value); setReviewed(null); setAgeConfirmed(false); }} />
        <p className="text-sm leading-relaxed text-ngpa-white/65 mt-3">The code expires after ten minutes and covers one registration. Keep it private. It permits a dated preview, not enrollment or a reserved place.</p>
      </div>
      {reviewed && <section aria-label="Reviewed next focus" className="border-l-4 border-ngpa-teal pl-4 space-y-2">
        <h2 className="font-heading text-xl font-bold">Reviewed next focus</h2>
        <p className="text-base"><strong>{reviewed.nextFocus?.label ?? "Ask your coach for a reviewed focus"}</strong></p>
        <p>Assessed level: {reviewed.assessment.level ? `${reviewed.assessment.level} Ball` : "Awaiting coach assessment"}. Recorded age: {reviewed.assessment.age ?? "Needs confirmation"}.</p>
        <p className="text-sm text-ngpa-white/65">Reviewed <time dateTime={reviewed.reviewedAt}>{timestamp(reviewed.reviewedAt)} ET</time>. Expires <time dateTime={reviewed.expiresAt}>{timestamp(reviewed.expiresAt)} ET</time>.</p>
        <p className="text-sm text-ngpa-white/65">This is the review attached to this code. It does not replace a newer coach assessment.</p>
        <label className="flex items-start gap-3 min-h-12"><input className="mt-1.5" type="checkbox" checked={ageConfirmed} onChange={(event) => { changed(); setAgeConfirmed(event.target.checked); }} /><span>The recorded age is current for my player. Leave this unchecked if your coach needs to correct it.</span></label>
      </section>}
      <fieldset className="rounded-2xl border border-ngpa-slate p-5 space-y-5">
        <legend className="font-heading text-lg font-bold px-2">What works for your family?</legend>
        <p className="text-base text-ngpa-white/70">Required choices must match. Preferred choices help order options. These choices are temporary and never change the assessed level.</p>
        <div><p className="font-bold mb-2">Days</p><div className="flex flex-wrap gap-2">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => <label key={label} className="flex min-h-12 items-center gap-2 rounded-lg border border-ngpa-slate px-3"><input type="checkbox" checked={days.includes(day)} onChange={() => { changed(); setDays((value) => value.includes(day) ? value.filter((v) => v !== day) : [...value, day]); }} />{label}</label>)}</div></div>
        <label className="block">Day priority<select className={field} aria-label="Day priority" value={dayMode} onChange={(event) => { changed(); setDayMode(event.target.value as typeof dayMode); }}><option value="required">Required</option><option value="preferred">Preferred</option></select></label>
        <label className="block">Venue name<input className={field} aria-label="Venue name" value={location} maxLength={150} onChange={(event) => { changed(); setLocation(event.target.value); }} /></label>
        <label className="block">Venue priority<select className={field} aria-label="Venue priority" value={locationMode} onChange={(event) => { changed(); setLocationMode(event.target.value as typeof locationMode); }}><option value="required">Required</option><option value="preferred">Preferred</option></select></label>
        <div className="grid sm:grid-cols-2 gap-4"><label>Earliest start (ET)<input className={field} aria-label="Earliest start (ET)" type="time" value={start} onChange={(event) => { changed(); setStart(event.target.value); }} /></label><label>Latest end (ET)<input className={field} aria-label="Latest end (ET)" type="time" value={end} onChange={(event) => { changed(); setEnd(event.target.value); }} /></label></div>
        <label className="block">Time priority<select className={field} aria-label="Time priority" value={timeMode} onChange={(event) => { changed(); setTimeMode(event.target.value as typeof timeMode); }}><option value="required">Required</option><option value="preferred">Preferred</option></select></label>
      </fieldset>
      <button className="btn btn-primary min-h-12 w-full sm:w-auto" disabled={busy || !code.trim()}>Preview next sessions</button>
    </form>
    {busy && <p role="status">Checking your reviewed next step and current sessions.</p>}
    {error && <p role="alert" className="rounded-lg border border-ngpa-red bg-ngpa-red/15 p-4">{error}</p>}
    {result && <section aria-live="polite" className="space-y-4">
      <h2 className="font-heading text-2xl font-bold">{headings[result.state] ?? "A fresh coach review is needed"}</h2>
      {result.state === "no_match" && <p>No current session meets these requirements. You can explicitly change a choice and check again, or ask your coach about other programs.</p>}
      {result.reason === "outside_youth_age_policy" && <p>The confirmed age is outside NGA’s ages 6 to 16 policy. Check the record with your coach.</p>}
      {result.programs.map((program) => <article key={program.url} className="card card-program rounded-2xl border border-ngpa-slate bg-ngpa-panel p-5 space-y-3">
        <h3 className="card__title font-heading text-xl font-bold">{program.title}</h3>
        <p><time dateTime={program.date}>{program.date}</time>, {program.startTime} to {program.endTime} ET</p><p>{program.location || "Venue needs confirmation"}</p>
        {program.fit === "needs_confirmation" ? <><p className="font-bold text-ngpa-teal">Confirm before registering</p><ul className="list-disc pl-5 space-y-2">{program.reasons.map((reason) => <li key={reason}>{reasonLabels[reason] ?? "Ask your coach to confirm this requirement."}</li>)}</ul></> : <a href={program.url} className="btn btn-secondary min-h-12">View session details</a>}
      </article>)}
    </section>}
    <p className="text-base leading-relaxed text-ngpa-white/65">Nothing is sent, saved, enrolled or held by this preview. Registration checks current availability again. This preview covers upcoming drop-in sessions; ask your coach about lessons, camps, seasons and invite-only tournaments.</p>
  </div>;
}
