import type { FallRosterRow } from "@/lib/notion-fall-registrations";
import {
  findFallSeasonGroup,
  type FallSeasonGroup,
} from "@/data/fall-season-2026";
import { FALL_SEASON_LABEL, FALL_VENUE_SHORT } from "@/data/fall-2026";
import { buildRosterMailto } from "@/lib/roster-mailto";

/**
 * Admin projection of the Fall 2026 season roster for /admin/fall.
 *
 * It manages registrations and money — NOT day-of safety — so it deliberately
 * DROPS the safety fields the Notion row carries (allergies/medical, emergency
 * contact, the stored SMS consent text), exactly as `admin-monday-girls-roster.ts`
 * and `admin-camp-roster.ts` do. Narrowing at the projection is what keeps that
 * child PII off this new admin egress path; the omission is pinned by
 * e2e/invariant-admin-fall-roster.spec.ts.
 *
 * A day-of view with those fields belongs on a coach surface beside
 * `/coach/camps/[slug]`, under its own approval — never by widening this one.
 *
 * Unlike Monday Girls there is no `sessionsPurchased`: the season sells whole,
 * six Sundays for everyone, so the day a family registered is provenance rather
 * than a price input.
 */
export interface AdminFallPlayer {
  pageId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number | null;
  group: string;
  status: string;
  amountPaidUsd: number;
  registeredOnIso: string;
  smsConsent: boolean;
  stripeCheckoutSessionId: string;
}

export function toAdminFallPlayer(row: FallRosterRow): AdminFallPlayer {
  return {
    pageId: row.pageId,
    parentName: row.parentName,
    parentEmail: row.parentEmail,
    parentPhone: row.parentPhone,
    childFirstName: row.childFirstName,
    childBirthYear: row.childBirthYear,
    group: row.group,
    status: row.status,
    amountPaidUsd: row.amountPaidUsd,
    registeredOnIso: row.registeredOnIso,
    smsConsent: row.smsConsent,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
  };
}

/**
 * Confirmed seats held in one group. Green and Yellow hold DIFFERENT counts
 * (8 and 10), so every caller has to say which group it means — a single shared
 * number is the bug invariant-fall-seat-cap-per-group.spec.ts exists for.
 */
export function countConfirmedByGroup(
  players: AdminFallPlayer[],
  group: FallSeasonGroup,
): number {
  return players.filter((p) => p.group === group && p.status === "Confirmed")
    .length;
}

/**
 * Group email for one colour group's confirmed families, through the same
 * bcc-only builder the sessions editor uses — parents never see each other's
 * addresses, and the recipient list is deduped and validated there.
 *
 * Confirmed only: a family who took a refund should not be mailed about a
 * season they left. Nothing about a child travels in the URL.
 *
 * null when nobody is mailable, so the page renders no dead button.
 */
export function buildFallGroupMailto(
  players: AdminFallPlayer[],
  group: FallSeasonGroup,
): string | null {
  const option = findFallSeasonGroup(group);
  return buildRosterMailto({
    emails: players
      .filter((p) => p.group === group && p.status === "Confirmed")
      .map((p) => p.parentEmail),
    sessionTitle: `${option?.label ?? group} (fall season)`,
    prettyDate: FALL_SEASON_LABEL,
    startTime: option?.timeLabel ?? "",
    location: FALL_VENUE_SHORT,
  });
}
