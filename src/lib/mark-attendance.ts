import { revalidatePath } from "next/cache";
import {
  findDropInPageByCheckoutId,
  setDropInAttendance,
  type AttendanceValue,
} from "@/lib/notion-dropins";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import { recomputePlayerAttendance } from "@/lib/notion-player-sync";
import { sessionToSlug } from "@/lib/session-slug";

// Shared attendance check-in core. Owns the FULL fan-out (Notion write + Open
// Brain activity + player-profile stat recompute + cache revalidation) so every
// caller — the coach UI action (cookie-gated) and the agent route (secret-gated)
// — gets identical side-effects. Mirrors the executeSessionCancel pattern: a
// plain lib (NOT "use server") shared by two differently-authed wrappers.

export interface MarkAttendanceInput {
  checkoutSessionId: string;
  attended: AttendanceValue | "clear";
}

export interface MarkAttendanceResult {
  ok: boolean;
  message: string;
  attendance?: AttendanceValue | "";
  pageId?: string;
  idempotent?: boolean;
  reason?: "not_found";
  // The (always-resolving) Open Brain ingest promise when one was fired, else
  // null. Callers needing durability (the agent route, which can freeze on
  // Vercel) await it; the coach UI action ignores it to stay non-blocking.
  obIngest?: Promise<void> | null;
}

export async function markAttendanceCore(
  input: MarkAttendanceInput,
): Promise<MarkAttendanceResult> {
  if (!input.checkoutSessionId?.trim()) {
    return { ok: false, message: "Missing checkoutSessionId" };
  }
  const value: AttendanceValue | null =
    input.attended === "clear" ? null : input.attended;
  if (value !== null && value !== "Present" && value !== "No-show") {
    return { ok: false, message: "Invalid attendance value" };
  }

  const dropIn = await findDropInPageByCheckoutId(input.checkoutSessionId);
  if (!dropIn) {
    return { ok: false, message: "Registration not found", reason: "not_found" };
  }

  // Idempotency: a re-fire with the value already on the row is a no-op — skip
  // the write AND the OB activity append so agent retries don't pile duplicate
  // check-ins onto the player's profile. The coach UI never sends a same-value
  // repeat (it toggles to "clear"), so this never alters the click path.
  const requested: AttendanceValue | "" = value ?? "";
  if ((dropIn.attendance || "") === requested) {
    return {
      ok: true,
      message: value ?? "Cleared",
      attendance: requested,
      pageId: dropIn.id,
      idempotent: true,
      obIngest: null,
    };
  }

  const wrote = await setDropInAttendance(dropIn.id, value);
  if (!wrote) {
    return { ok: false, message: "Failed to update Notion", pageId: dropIn.id };
  }

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

  if (dropIn.parentEmail || dropIn.parentPhone) {
    await recomputePlayerAttendance({
      parentEmail: dropIn.parentEmail || null,
      parentPhone: dropIn.parentPhone || "",
      childFirstName: dropIn.childFirstName,
    });
  }

  // revalidatePath throws synchronously when there's no request store (e.g. a
  // pure unit test invoking the core directly). The data fan-out above has
  // already fired, so swallow it; in a real request scope (action or route) it
  // never throws. A sync try/catch is required — .catch() would miss it.
  try {
    const slug = sessionToSlug({ title: dropIn.sessionTitle, date: dropIn.sessionDate });
    if (slug) revalidatePath(`/coach/${slug}`);
    revalidatePath("/coach");
  } catch {
    // no-op outside a request context
  }

  return {
    ok: true,
    message: value ?? "Cleared",
    attendance: requested,
    pageId: dropIn.id,
    idempotent: false,
    obIngest,
  };
}
