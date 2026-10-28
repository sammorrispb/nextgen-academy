import { MVF_JUNIOR_TOURNAMENT_DATE_ISO, MVF_JUNIOR_TOURNAMENT_END_TIME } from "@/data/mvf-junior-tournament-2026";
import { sessionEndUtcMs } from "@/lib/session-time";

export const MVF_REGISTRATION_CLOSED_MESSAGE = "This tournament has ended. Registration is closed.";

// Only public admission expires. Existing invoices and paid callbacks still
// need the capacity ledger and historical registration data after the event.
export function isMvfTournamentRegistrationClosed(now = Date.now()): boolean {
  const end = sessionEndUtcMs(MVF_JUNIOR_TOURNAMENT_DATE_ISO, MVF_JUNIOR_TOURNAMENT_END_TIME);
  return end === null || !Number.isFinite(now) || now >= end;
}
