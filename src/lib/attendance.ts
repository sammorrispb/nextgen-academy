import {
  findDropInPageByCheckoutId,
  setDropInAttendance,
  type AttendanceValue,
} from "./notion-dropins";
import { ingestToOpenBrain } from "./open-brain-ingest";
import { recomputePlayerAttendance } from "./notion-player-sync";

export interface ApplyAttendanceResult {
  ok: boolean;
  message: string;
  attendance?: AttendanceValue | "";
  /** True when the row already held the requested value — a no-op (no write, no
   *  OB activity, no recompute). Lets retry-happy agent callers be idempotent. */
  idempotent?: boolean;
  /** Present on success so a request-scoped caller can revalidate the slug. */
  session?: { title: string; date: string };
  /** The (always-resolving) Open Brain ingest promise when one was fired, else
   *  null. A caller that needs the activity durable (the agent route — it can
   *  freeze on Vercel before a floating promise flushes) awaits it; the coach
   *  action ignores it to stay non-blocking. */
  obIngest?: Promise<void> | null;
}

/**
 * The full day-of attendance fan-out, in ONE place so every caller fires the
 * same triggers: the coach dashboard server action (`markAttendanceAction`) and
 * the secret-gated `/api/coach/attendance` route an agent calls both funnel
 * through here. Writing the Notion `Attendance` select directly instead drops
 * the Open Brain check-in activity AND the player-profile stat recompute — the
 * exact regression this consolidation exists to prevent.
 *
 * Auth is the CALLER's responsibility (coach cookie for the action, admin
 * secret for the route); this core assumes an already-authorized caller.
 * Cache revalidation also stays with the caller — it needs a Next request scope
 * this library doesn't have.
 */
export async function applyAttendance(input: {
  checkoutSessionId: string;
  attended: AttendanceValue | "clear";
}): Promise<ApplyAttendanceResult> {
  if (!input.checkoutSessionId?.trim()) {
    return { ok: false, message: "Missing checkoutSessionId" };
  }
  const value: AttendanceValue | null =
    input.attended === "clear" ? null : input.attended;
  if (value !== null && value !== "Present" && value !== "No-show") {
    return { ok: false, message: "Invalid attendance value" };
  }

  const dropIn = await findDropInPageByCheckoutId(input.checkoutSessionId);
  if (!dropIn) return { ok: false, message: "Registration not found" };

  // Idempotency: a re-fire with the value already on the row is a no-op — skip
  // the write AND the OB activity append so agent retries don't pile duplicate
  // check-ins onto the player's profile. The coach UI never sends a same-value
  // repeat (it toggles to "clear"), so this never alters the click path.
  if ((dropIn.attendance || "") === (value ?? "")) {
    return {
      ok: true,
      message: value ?? "Cleared",
      attendance: value ?? "",
      idempotent: true,
      session: { title: dropIn.sessionTitle, date: dropIn.sessionDate },
      obIngest: null,
    };
  }

  const ok = await setDropInAttendance(dropIn.id, value);
  if (!ok) return { ok: false, message: "Failed to update Notion" };

  // Tie the check-in to the player's Open Brain profile. Keyed on parent
  // email/phone (OB dedups to the existing contact). Returned (not voided) so
  // the agent route can await durability; only fires for a real Present/No-show.
  let obIngest: Promise<void> | null = null;
  if (value && (dropIn.parentEmail || dropIn.parentPhone)) {
    obIngest = ingestToOpenBrain({
      business: "nga",
      source: "nga_attendance",
      email: dropIn.parentEmail || undefined,
      phone: dropIn.parentPhone || undefined,
      name: dropIn.parentName || undefined,
      interest: dropIn.childFirstName || undefined,
      metadata: {
        child_first_name: dropIn.childFirstName,
        child_birth_year: dropIn.childBirthYear || undefined,
        session_title: dropIn.sessionTitle,
        session_date: dropIn.sessionDate,
        session_start_time: dropIn.sessionStartTime,
        location: dropIn.location,
        attendance: value,
      },
    });
  }

  // Recompute the child's attendance stats on their player profile. Runs for
  // every change (Present / No-show / clear) so the count stays exact — e.g.
  // clearing a Present row decrements it. Awaited but never fatal to the
  // check-in.
  if (dropIn.parentEmail || dropIn.parentPhone) {
    await recomputePlayerAttendance({
      parentEmail: dropIn.parentEmail || null,
      parentPhone: dropIn.parentPhone || "",
      childFirstName: dropIn.childFirstName,
    });
  }

  return {
    ok: true,
    message: value ?? "Cleared",
    attendance: value ?? "",
    idempotent: false,
    session: { title: dropIn.sessionTitle, date: dropIn.sessionDate },
    obIngest,
  };
}
