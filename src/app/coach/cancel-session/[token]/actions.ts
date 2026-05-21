"use server";

import { fetchSessionById } from "@/lib/notion-sessions";
import { verifySessionCancelToken } from "@/lib/session-cancel-token";
import {
  executeSessionCancel,
  type SessionCancelResult,
} from "@/lib/session-cancel";

/**
 * Token-authorized session cancel. The signed token IS the authorization (no
 * coach cookie), so it is re-verified here server-side — never trust the
 * client. Always cancels with reason "weather" (the briefing's framing).
 */
export async function confirmSessionCancelAction(
  token: string,
): Promise<SessionCancelResult> {
  const sessionId = verifySessionCancelToken(token);
  if (!sessionId) return { ok: false, message: "Invalid or expired link" };

  const session = await fetchSessionById(sessionId);
  if (!session) return { ok: false, message: "Session not found" };
  if (session.status === "Cancelled") {
    return { ok: true, message: "This session is already cancelled.", rosterSize: session.registeredCount };
  }

  return executeSessionCancel({
    sessionRowId: session.id,
    sessionTitle: session.title,
    sessionDate: session.date,
    sessionStartTime: session.startTime,
    reason: "weather",
  });
}
