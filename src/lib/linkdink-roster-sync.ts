/**
 * NGA → Link & Dink roster sync for the MVF Junior Tournament.
 *
 * After an MVF tournament registration's invoice goes out, this puts the
 * player onto the matching Link & Dink popup roster so the organizer (and
 * MVF, via co-organizer access) sees real-time registration numbers and the
 * day-of bracket/scoring tooling has the players.
 *
 * Which event: each division sends a stable `event_key` (the event slug
 * without L&D's "-N" re-creation suffix), never one event row's exact slug.
 * L&D re-creates an event under a new suffix and cancels the old row; the
 * endpoint resolves the key to the ONE non-cancelled event, so a
 * cancel-and-recreate keeps working. The exact slugs this module first
 * shipped with were both cancelled before a single registration synced.
 *
 * What leaves NGA (a child-PII egress — see the docs/source-inventory.md risk
 * log): the event key, the child's first and last name, and the parent's
 * email, which L&D uses only as an input to its idempotency key and never
 * stores. Nothing else, and only from a production deploy. Pinned by
 * e2e/invariant-linkdink-roster-egress.spec.ts.
 *
 * Posture: never throws, never fails a registration. A failed sync is logged
 * and alerted without registrant data (L&D's error code, the division, the
 * key); the Notion roster row stays the source of truth and the endpoint is
 * idempotent, so a re-send is safe.
 */

import { after } from "next/server";
import type { MvfTournamentDivision } from "@/data/mvf-junior-tournament-2026";
import { deliverCronAlert } from "@/lib/cron-alert";

const DEFAULT_LD_BASE_URL = "https://www.linkanddink.com";

const TAG = "[linkdink-roster-sync]";

/** Room for a cold L&D function, short enough that a hung call doesn't hold
 * the parent's checkout response open (the route awaits this sync). */
const LD_TIMEOUT_MS = 8000;

/** The endpoint's refusal codes (community-os apps/p3/src/app/api/internal/
 * nga-roster-add/route.ts). Only these reach a log line or an alert; any
 * other response is reported by HTTP status alone, so an error body can
 * never carry a registrant's name into either. */
const LD_ERROR_CODES = new Set([
  "not_configured",
  "unauthorized",
  "bad_event_slug",
  "bad_input",
  "event_lookup_failed",
  "event_not_found",
  "event_cancelled",
  "event_ambiguous",
  "event_not_youth",
  "event_live",
  "roster_lookup_failed",
  "player_create_failed",
  "roster_insert_failed",
]);

/** NGA division → Link & Dink event key (the slug minus any "-N" suffix). */
export const MVF_TOURNAMENT_LD_EVENT_KEYS: Record<
  MvfTournamentDivision["division"],
  string
> = {
  "10u": "mvf-junior-tournament-10u-2026-10-24",
  "14u": "mvf-junior-tournament-14u-2026-10-24",
};

export interface MvfRosterSyncInput {
  division: string;
  childFirstName: string;
  childLastName: string;
  parentEmail: string;
  /** Never sent: L&D stores no contact on a child's row. Accepted so the
   * checkout route (a Slop-Free Zone) calls this unchanged. */
  parentPhone?: string;
}

/** The JSON the L&D endpoint receives: these four fields and nothing else. */
export interface MvfRosterSyncBody {
  event_key: string;
  first_name: string;
  last_name: string;
  email: string;
}

export function mvfTournamentLdEventKey(division: string): string | null {
  return Object.hasOwn(MVF_TOURNAMENT_LD_EVENT_KEYS, division)
    ? MVF_TOURNAMENT_LD_EVENT_KEYS[division as MvfTournamentDivision["division"]]
    : null;
}

/** The request body for one registrant, or null when the division has no
 * L&D event. */
export function buildMvfRosterSyncBody(
  input: MvfRosterSyncInput,
): MvfRosterSyncBody | null {
  const eventKey = mvfTournamentLdEventKey(input.division);
  if (!eventKey) return null;
  return {
    event_key: eventKey,
    first_name: input.childFirstName,
    last_name: input.childLastName,
    email: input.parentEmail,
  };
}

/**
 * Tell Sam, with no registrant data: the failure code, the division and key,
 * and how to recover. Inside a request it is delivered after the response
 * goes out, so a slow Resend or the SMS fallback never holds a parent's
 * checkout open; outside one (a script, a test) it is delivered inline.
 */
async function alertSyncFailure(
  signature: string,
  ref: string,
  detail: string,
): Promise<void> {
  const deliver = async () => {
    try {
      await deliverCronAlert("linkdink-roster-sync", {
        attempted: 1,
        succeeded: 0,
        failures: [
          {
            signature,
            ref,
            detail: `${detail}. The player is not on the Link & Dink roster. Match this alert's time to the "invoice sent" admin email or a row in the NGA MVF Junior Tournament Registrations DB, then re-send that registration to the L&D endpoint (dry_run first; it is idempotent) or add the player on L&D by hand. Log tag ${TAG}.`,
          },
        ],
      });
    } catch {
      // deliverCronAlert never throws; this keeps that promise if it ever does.
      console.error(`${TAG} alert delivery threw for ${ref} (${signature})`);
    }
  };
  try {
    after(deliver);
  } catch {
    await deliver();
  }
}

/**
 * Push one MVF tournament registrant to the Link & Dink roster.
 * Returns true when the player is on the roster (or already was).
 * Never throws — logs, alerts and returns false on any failure.
 */
export async function syncMvfRegistrationToLinkDink(
  input: MvfRosterSyncInput,
): Promise<boolean> {
  let ref = "unknown registration";
  try {
    // Logs and alerts name the division and key, never the registrant.
    const division = /^[a-z0-9]{1,8}$/.test(input.division)
      ? input.division
      : "invalid";
    const body = buildMvfRosterSyncBody(input);
    ref = `${division} → ${body?.event_key ?? "no event key"}`;

    // Only a production deploy sends. A preview or local build would seat
    // test children on the live roster, so it skips unless LINKDINK_BASE_URL
    // points it at an L&D instance on purpose.
    const production = process.env.VERCEL_ENV === "production";
    const baseUrlOverride = process.env.LINKDINK_BASE_URL;
    if (!production && !baseUrlOverride) {
      console.info(`${TAG} not a production deploy — skipping L&D roster sync (${ref})`);
      return false;
    }

    const secret = process.env.NGA_SYNC_SECRET;
    if (!secret) {
      console.error(`${TAG} NGA_SYNC_SECRET not set — skipping L&D roster sync (${ref})`);
      if (production) {
        await alertSyncFailure(
          "nga_secret_unset",
          ref,
          "NGA_SYNC_SECRET is not set on the NGA production deploy",
        );
      }
      return false;
    }
    if (!body) {
      console.error(`${TAG} no L&D event for division ${division} — skipping L&D roster sync`);
      await alertSyncFailure(
        "unknown_division",
        ref,
        "No L&D event key for this division: the key map has drifted from the tournament data",
      );
      return false;
    }

    const res = await fetch(
      `${baseUrlOverride ?? DEFAULT_LD_BASE_URL}/play/api/internal/nga-roster-add`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nga-sync-secret": secret,
        },
        body: JSON.stringify(body),
        // A redirect would carry the secret header (and, on a 307/308, the
        // child's name) to wherever it points; treat one as a failure.
        redirect: "error",
        signal: AbortSignal.timeout(LD_TIMEOUT_MS),
      },
    );
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: unknown;
    };
    if (res.ok && payload.ok === true) return true;
    // Only L&D's error vocabulary reaches the log and the alert, never the
    // raw response.
    const code =
      typeof payload.error === "string" && LD_ERROR_CODES.has(payload.error)
        ? payload.error
        : res.ok
          ? "not_ok"
          : `http_${res.status}`;
    console.error(`${TAG} L&D roster add failed: ${code} (HTTP ${res.status}) for ${ref}`);
    await alertSyncFailure(code, ref, `HTTP ${res.status}`);
    return false;
  } catch (err) {
    const name =
      err instanceof Error && /^[A-Za-z]{1,40}$/.test(err.name)
        ? err.name
        : "UnknownError";
    console.error(`${TAG} L&D roster sync threw ${name} for ${ref}`);
    await alertSyncFailure("request_failed", ref, name);
    return false;
  }
}
