/**
 * NGA → Link & Dink roster sync for the MVF Junior Tournament.
 *
 * After an MVF tournament registration's invoice goes out, this puts the
 * player onto the matching Link & Dink popup roster so the organizer (and
 * MVF, via co-organizer access) sees real-time registration numbers and the
 * day-of bracket/scoring tooling has the players.
 *
 * Posture: never throws, never fails a registration. A sync failure is
 * logged for a hand retry — the Notion roster row remains the source of
 * truth and the endpoint itself is idempotent, so a retry is safe.
 */

const LD_BASE_URL =
  process.env.LINKDINK_BASE_URL ?? "https://www.linkanddink.com";

/** NGA division slug → Link & Dink popup event slug. */
export const MVF_TOURNAMENT_LD_EVENT_SLUGS: Record<string, string> = {
  "10u": "mvf-junior-tournament-10u-2026-10-24-3",
  "14u": "mvf-junior-tournament-14u-2026-10-24-2",
};

export interface MvfRosterSyncInput {
  division: string;
  childFirstName: string;
  childLastName: string;
  parentEmail: string;
  parentPhone: string;
}

export function mvfTournamentLdEventSlug(division: string): string | null {
  return MVF_TOURNAMENT_LD_EVENT_SLUGS[division] ?? null;
}

/**
 * Push one MVF tournament registrant to the Link & Dink roster.
 * Returns true when the player is on the roster (or already was).
 * Never throws — logs and returns false on any failure.
 */
export async function syncMvfRegistrationToLinkDink(
  input: MvfRosterSyncInput,
): Promise<boolean> {
  const tag = "[linkdink-roster-sync]";
  try {
    const secret = process.env.NGA_SYNC_SECRET;
    if (!secret) {
      console.error(`${tag} NGA_SYNC_SECRET not set — skipping L&D roster sync`);
      return false;
    }
    const eventSlug = mvfTournamentLdEventSlug(input.division);
    if (!eventSlug) {
      console.error(`${tag} unknown division ${input.division} — skipping L&D roster sync`);
      return false;
    }
    const res = await fetch(`${LD_BASE_URL}/play/api/internal/nga-roster-add`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nga-sync-secret": secret,
      },
      body: JSON.stringify({
        event_slug: eventSlug,
        first_name: input.childFirstName,
        last_name: input.childLastName,
        email: input.parentEmail,
        phone: input.parentPhone,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `${tag} L&D roster add failed (${res.status}) for ${input.childFirstName} ${input.childLastName} → ${eventSlug}: ${text.slice(0, 300)}`,
      );
      return false;
    }
    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!payload.ok) {
      console.error(`${tag} L&D roster add not ok for ${input.childFirstName} ${input.childLastName}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      `${tag} L&D roster sync threw for ${input.childFirstName} ${input.childLastName}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
