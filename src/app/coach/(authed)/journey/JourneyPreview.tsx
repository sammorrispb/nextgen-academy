"use client";
import { useRef, useState } from "react";
import { NGA_NEXT_FOCUS_OPTIONS, type NgaAssessment, type NgaPreferences, type NgaPreview } from "@/lib/nga-journey";
const inputClass = "w-full min-h-12 rounded-lg border border-ngpa-slate bg-ngpa-deep px-3 py-2 text-base text-ngpa-white focus:outline-2 focus:outline-offset-2 focus:outline-ngpa-teal";
const labels: Record<string, string> = {
  assessment_changed: "The recorded assessment changed. Review the current assessment before trying again.",
  coach_assessment_required: "A coach must assign a recorded ball level before this preview can check sessions.",
  coach_review_required: "Choose a next focus and confirm your review to check upcoming sessions.",
  invalid_next_focus: "Choose a focus from the coaching curriculum.",
  source_not_configured: "The assessment or session source is unavailable. Ask an administrator to check the connection.",
  source_unavailable: "The assessment or session source could not be checked. Try again before recommending a session.",
  assessment_not_found: "This player assessment is unavailable in the youth CRM. Check the record and your access.",
  source_revision_unavailable: "The source did not provide a current revision. Try again before recommending a session.",
  inventory_record_invalid: "An upcoming session could not be verified against the program source. A coach must check the source before recommending it.",
  inventory_incomplete: "The complete upcoming session list could not be checked. Try again before recommending a session.",
  invalid_player_id: "Enter the Player CRM record ID.",
  outside_youth_age_policy: "The recorded age is outside NGA’s ages 6 to 16 policy. Confirm the record with the family.",
  invalid_parent_requirements: "Choose valid days, venues and a time window with the end after the start.",
  unsupported_parent_requirement: "This preview cannot verify that requirement. Confirm it with the family and coach.",
  parent_preference_authority_unavailable: "Saved parent preferences are unavailable. These choices are temporary and stay separate from the assessed level.",
  program_age_policy_unknown: "Confirm this program’s age range and any additional eligibility rules. The session source does not publish these as verified fields.",
  age_confirmation_required: "Confirm the player’s current age.",
  program_level_unknown: "Confirm which ball levels this session accepts.",
  program_status_unknown: "Confirm that this session is open.",
  capacity_unknown: "Confirm current availability.",
  program_time_unknown: "Confirm the session’s date and time.",
  required_day_unknown: "Confirm the required day.",
  required_location_unknown: "Confirm the required venue.",
  required_time_unknown: "Confirm the required time window.",
  conflicting_destination_evidence: "Multiple records point to this session with conflicting details. A coach must resolve them first.",
};
const stateLabels = { recommendation: "Sessions to consider", needs_confirmation: "Coach confirmation needed", clarification: "Review needed", no_match: "No matching sessions", unavailable: "Preview unavailable", stale: "Assessment changed", unsupported: "Requirement unavailable" };

export default function JourneyPreview() {
  const [playerId, setPlayerId] = useState("");
  const [assessment, setAssessment] = useState<NgaAssessment | null>(null);
  const [focusId, setFocusId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [dayMode, setDayMode] = useState<"required" | "preferred">("required");
  const [location, setLocation] = useState("");
  const [locationMode, setLocationMode] = useState<"required" | "preferred">("required");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [timeMode, setTimeMode] = useState<"required" | "preferred">("required");
  const [result, setResult] = useState<NgaPreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  function changed() { generation.current += 1; setBusy(false); setResult(null); setError(""); setConfirmed(false); }
  async function request(load: boolean) {
    const version = ++generation.current; setBusy(true); setError(""); setResult(null);
    const preferences: NgaPreferences = {
      ...(days.length ? { days: { mode: dayMode, values: days } } : {}),
      ...(location.trim() ? { locations: { mode: locationMode, values: [location.trim()] } } : {}),
      ...(start || end ? { time: { mode: timeMode, start, end } } : {}),
    };
    try {
      const response = await fetch("/api/coach/journey-preview", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: playerId.trim(), ...(load ? {} : { review: { assessmentRevision: assessment?.revision, focusId, confirmed, ageConfirmed }, preferences }) }) });
      const body = await response.json();
      if (version !== generation.current) return;
      if (response.status === 401 || response.status === 403) { setAssessment(null); setConfirmed(false); setError("Your coach access could not be verified. Sign in again before reviewing this player."); return; }
      if (body.assessment) {
        if (body.assessment.revision !== assessment?.revision) { setConfirmed(false); setAgeConfirmed(false); }
        setAssessment(body.assessment);
      }
      if (response.status === 409) setConfirmed(false);
      if (body.state) setResult(body as NgaPreview); else setError("The preview could not be loaded. Try again before recommending a session.");
    } catch { if (version === generation.current) setError("The response was lost. You can safely retry this read-only preview."); }
    finally { if (version === generation.current) setBusy(false); }
  }
  return <div className="space-y-8 max-w-3xl">
    <form onSubmit={(event) => { event.preventDefault(); void request(true); }} className="rounded-2xl bg-ngpa-panel border border-ngpa-slate p-5 sm:p-6 space-y-4">
      <label className="block text-base font-bold" htmlFor="journey-player">Player CRM record ID</label>
      <input id="journey-player" value={playerId} className={inputClass} autoComplete="off" spellCheck={false} onChange={(event) => { changed(); setPlayerId(event.target.value); setAssessment(null); setAgeConfirmed(false); setFocusId(""); setBusy(false); }} />
      <button className="btn btn-secondary min-h-12" disabled={busy || !playerId.trim()}>Load recorded assessment</button>
    </form>
    {assessment && <form onSubmit={(event) => { event.preventDefault(); void request(false); }} className="space-y-6">
      <section aria-label="Recorded assessment" className="border-l-4 border-ngpa-teal pl-4">
        <h2 className="font-heading text-xl font-bold">Recorded assessment</h2>
        <p className="text-base mt-2">{assessment.level ? `${assessment.level} Ball` : "Ball level not assigned"}. {assessment.age === null ? "Age needs confirmation." : `Recorded age: ${assessment.age}.`}</p>
        <p className="text-sm text-ngpa-white/65 mt-2">This preview does not change the assessed level. Confirm the current age with the family before registration.</p>
      </section>
      <div>
        <label htmlFor="journey-focus" className="block font-bold mb-2">Next focus</label>
        <select id="journey-focus" className={inputClass} value={focusId} onChange={(event) => { changed(); setFocusId(event.target.value); }}><option value="">Choose a focus</option>{NGA_NEXT_FOCUS_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
      </div>
      <fieldset className="rounded-2xl border border-ngpa-slate p-5 space-y-5">
        <legend className="font-heading text-lg font-bold px-2">Scheduling choices for this preview</legend>
        <p className="text-base text-ngpa-white/70">Enter the family’s choices here. They are temporary. This tool cannot save parent preferences or verify travel distance.</p>
        <div>
          <p className="font-bold mb-2">Days</p>
          <div className="flex flex-wrap gap-2">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => <label key={label} className="flex min-h-12 items-center gap-2 rounded-lg border border-ngpa-slate px-3"><input type="checkbox" checked={days.includes(day)} onChange={() => { changed(); setDays((value) => value.includes(day) ? value.filter((v) => v !== day) : [...value, day]); }} />{label}</label>)}</div>
          <label className="block mt-3">Day priority<select aria-label="Day priority" className={inputClass} value={dayMode} onChange={(event) => { changed(); setDayMode(event.target.value as typeof dayMode); }}><option value="required">Required</option><option value="preferred">Preferred</option></select></label>
        </div>
        <label className="block">Venue name<input aria-label="Venue name" className={`${inputClass} mt-2`} value={location} maxLength={150} onChange={(event) => { changed(); setLocation(event.target.value); }} /></label>
        <label className="block">Venue priority<select aria-label="Venue priority" className={inputClass} value={locationMode} onChange={(event) => { changed(); setLocationMode(event.target.value as typeof locationMode); }}><option value="required">Required</option><option value="preferred">Preferred</option></select></label>
        <div className="grid sm:grid-cols-2 gap-4"><label>Earliest start (ET)<input aria-label="Earliest start (ET)" type="time" className={inputClass} value={start} onChange={(event) => { changed(); setStart(event.target.value); }} /></label><label>Latest end (ET)<input aria-label="Latest end (ET)" type="time" className={inputClass} value={end} onChange={(event) => { changed(); setEnd(event.target.value); }} /></label></div>
        <label className="block">Time priority<select aria-label="Time priority" className={inputClass} value={timeMode} onChange={(event) => { changed(); setTimeMode(event.target.value as typeof timeMode); }}><option value="required">Required</option><option value="preferred">Preferred</option></select></label>
      </fieldset>
      <label className="flex gap-3 items-start min-h-12"><input type="checkbox" className="mt-1.5" checked={ageConfirmed} onChange={(event) => { changed(); setAgeConfirmed(event.target.checked); }} /><span>I confirmed the recorded age is current with the family. Leave this unchecked if age still needs confirmation.</span></label>
      <label className="flex gap-3 items-start min-h-12"><input type="checkbox" className="mt-1.5" checked={confirmed} onChange={(event) => { changed(); setConfirmed(event.target.checked); }} /><span>I reviewed this recorded assessment and chose this next focus. These scheduling choices do not change the player’s level.</span></label>
      <button className="btn btn-primary min-h-12 w-full sm:w-auto" disabled={busy || !confirmed || !focusId || !assessment.level}>Preview next sessions</button>
    </form>}
    {busy && <p role="status">Checking the assessment and upcoming sessions.</p>}
    {error && <p role="alert" className="text-ngpa-white bg-ngpa-red/20 border border-ngpa-red rounded-lg p-4">{error}</p>}
    {result && <section aria-live="polite" className="space-y-4">
      <h2 className="font-heading text-2xl font-bold">{stateLabels[result.state]}</h2>
      {result.reason && <p className="text-base text-ngpa-white/80">{labels[result.reason] ?? "The preview needs a fresh review before proceeding."}</p>}
      {result.nextFocus && <p className="text-base">Next focus for this preview: <strong>{result.nextFocus.label}</strong>.</p>}
      {result.state === "no_match" && <p>No current session meets these requirements. Change a requirement explicitly or check the schedule again later.</p>}
      {result.programs.map((program) => <article key={program.url} className="card card-program rounded-2xl border border-ngpa-slate bg-ngpa-panel p-5 space-y-3">
        <h3 className="card__title font-heading text-xl font-bold">{program.title}</h3>
        <p className="card__meta"><time dateTime={program.date}>{program.date}</time>, {program.startTime} to {program.endTime} ET</p>
        <p>{program.location || "Venue needs confirmation"}</p>
        {program.fit === "needs_confirmation" ? <><p className="font-bold text-ngpa-teal">Confirm before recommending</p><ul className="list-disc pl-5 space-y-1">{program.reasons.map((reason) => <li key={reason}>{labels[reason] ?? "Confirm this detail with the coach."}</li>)}</ul></> : <><p>Matches the recorded ball level, youth age policy, current session status and availability, and your required scheduling choices.</p><a className="btn btn-secondary min-h-12" href={program.url}>View session details</a></>}
      </article>)}
      <p className="text-base text-ngpa-white/65">Preview only. No message is sent, no player is enrolled, no attendance is recorded and no place is held. Registration checks current availability again. Camps, seasons, lessons and invite-only tournaments need their own coach review.</p>
    </section>}
    <ParentCodeIssue key={`${playerId}:${focusId}:${assessment?.revision ?? ""}`} playerId={playerId} focusId={focusId} assessmentRevision={assessment?.revision ?? ""} />
  </div>;
}


interface AssociationInspection {
  associationRevision: string;
  assessment: NgaAssessment & { identity: { childFirstName: string; parentEmail: string; parentPhone: string } };
  registration: { id: string; identity: { childFirstName: string; parentEmail: string; parentPhone: string }; sessionDate: string };
}
function ParentCodeIssue({ playerId, focusId, assessmentRevision }: { playerId: string; focusId: string; assessmentRevision: string }) {
  const [registrationId, setRegistrationId] = useState("");
  const [inspection, setInspection] = useState<AssociationInspection | null>(null);
  const [associationConfirmed, setAssociationConfirmed] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  function changed() { generation.current += 1; setBusy(false); setCode(""); setMessage(""); setAssociationConfirmed(false); }
  async function request(action: "inspect" | "issue") {
    const version = ++generation.current; setBusy(true); setCode(""); setMessage("");
    try {
      const response = await fetch("/api/coach/journey-parent-capability", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, playerId: playerId.trim(), registrationId: registrationId.trim(), ...(action === "issue" ? { associationRevision: inspection?.associationRevision, associationConfirmed, review: { confirmed: true, focusId, assessmentRevision } } : {}) }) });
      const body = await response.json(); if (version !== generation.current) return;
      if (!response.ok) {
        setAssociationConfirmed(false);
        if ([401, 403].includes(response.status)) { setInspection(null); setMessage("Your coach access could not be verified. Sign in again."); }
        else if (response.status === 503) setMessage("Parent previews are unavailable. The connection and dedicated preview configuration need to be checked before a code can be shared.");
        else { setInspection(null); setMessage("The registration and assessment could not be matched to this reviewed association. Check the exact source records and inspect again."); }
        return;
      }
      if (action === "inspect") { setInspection(body as AssociationInspection); setAssociationConfirmed(false); }
      else { setCode(body.code); setMessage("Read-only code created. It expires in ten minutes. No message has been sent."); }
    } catch { if (version === generation.current) setMessage("The response was lost. You can safely retry this read-only action."); }
    finally { if (version === generation.current) setBusy(false); }
  }
  const focus = NGA_NEXT_FOCUS_OPTIONS.find((option) => option.id === focusId);
  const stale = !!inspection && inspection.assessment.revision !== assessmentRevision;
  return <details className="rounded-2xl border border-ngpa-slate bg-ngpa-panel p-5 space-y-4">
    <summary className="font-heading text-xl font-bold cursor-pointer min-h-12">Parent preview code</summary>
    <p>Review one exact registration and its Player CRM assessment, then create a dated preview code. Share it only with the registered parent through a separately authorized action.</p>
    <label className="block">Notion drop-in registration ID<input aria-label="Notion drop-in registration ID" className={inputClass} value={registrationId} autoComplete="off" spellCheck={false} onChange={(event) => { changed(); setRegistrationId(event.target.value); setInspection(null); }} /></label>
    <button type="button" className="btn btn-secondary min-h-12" disabled={busy || !playerId.trim() || !registrationId.trim() || !assessmentRevision} onClick={() => void request("inspect")}>Inspect registration association</button>
    {inspection && <div className="space-y-4">
      <dl className="space-y-3 text-base"><div><dt className="font-bold">Registration record</dt><dd>{inspection.registration.identity.childFirstName}, {inspection.registration.identity.parentEmail || inspection.registration.identity.parentPhone}, {inspection.registration.sessionDate}</dd></div><div><dt className="font-bold">Assessment record</dt><dd>{inspection.assessment.identity.childFirstName}, {inspection.assessment.identity.parentEmail || inspection.assessment.identity.parentPhone}, {inspection.assessment.level ?? "Level not assigned"} Ball</dd></div></dl>
      {stale && <p role="alert">The assessment changed. Reload it above and inspect this association again.</p>}
      <label className="flex items-start gap-3 min-h-12"><input type="checkbox" className="mt-1.5" checked={associationConfirmed} onChange={(event) => { changed(); setAssociationConfirmed(event.target.checked); }} /><span>I reviewed these exact records, confirmed this registration belongs to this assessed player, and chose {focus?.label ?? "a next focus above"} for this dated proposal.</span></label>
      <button type="button" className="btn btn-primary min-h-12" disabled={busy || !associationConfirmed || !focus || stale} onClick={() => void request("issue")}>Create parent preview code</button>
    </div>}
    {busy && <p role="status">Checking the reviewed association.</p>}
    {message && <p role="status">{message}</p>}
    {code && <div className="space-y-3"><label className="block font-bold">Parent preview code<textarea aria-label="Parent preview code" className={`${inputClass} mt-2 text-sm break-all`} value={code} readOnly rows={4} spellCheck={false} /></label><button type="button" className="btn btn-secondary min-h-12" onClick={async () => { try { await navigator.clipboard.writeText(code); setMessage("Code copied. Share it only with the registered parent."); } catch { setMessage("Select and copy the code manually."); } }}>Copy preview code</button><p>Parent page: <a href="/parent/next" className="text-ngpa-teal underline">Open the private preview</a>. Paste the code there; it is never put into the page address.</p></div>}
    <p className="text-sm leading-relaxed text-ngpa-white/65">This is a dated proposal for one registration. It saves no preferences and changes no assessment. Editing this draft does not revoke a code already copied. Source changes, loss of issuer access and ten-minute expiry invalidate it. Individual code revocation is not available.</p>
  </details>;
}
