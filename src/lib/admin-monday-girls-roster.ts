import { MONDAY_GIRLS_LEVELS } from "@/data/monday-girls-2026";
import type { MondayGirlsRosterRow } from "@/lib/notion-monday-girls-registrations";
import { mondayGirlsSessionsPurchasedOn } from "@/lib/monday-girls-refund-policy";

/**
 * Admin projection of the Monday Girls roster for /admin/monday-girls.
 *
 * It manages registrations and money — NOT day-of safety — so it deliberately
 * DROPS the safety fields the Notion row carries (allergies/medical, emergency
 * contact name and phone), exactly as `admin-camp-roster.ts` drops them for the
 * camps panel. Narrowing at the projection is what keeps allergy and
 * emergency-contact child PII off this new admin egress path; the omission is
 * pinned by e2e/invariant-admin-monday-girls-roster.spec.ts.
 *
 * If a day-of view with those fields is ever wanted, it belongs on a coach
 * surface beside `/coach/camps/[slug]`, under its own approval — not by
 * widening this one.
 *
 * `sessionsPurchased` is derived, not stored: mid-season joining (2026-09-14)
 * means two families can hold different-sized blocks, and the day a row was
 * created is the same input checkout priced from. Showing it is what makes a
 * $150 row legible next to a $225 one.
 */
export interface AdminMondayGirlsPlayer {
  pageId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number | null;
  group: string;
  status: string;
  amountPaidUsd: number;
  /** Sessions this family actually bought — 6 for a full block, fewer if they joined late. */
  sessionsPurchased: number;
  registeredOnIso: string;
  smsConsent: boolean;
  stripeCheckoutSessionId: string;
}

export function toAdminMondayGirlsPlayer(
  row: MondayGirlsRosterRow,
): AdminMondayGirlsPlayer {
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
    sessionsPurchased: mondayGirlsSessionsPurchasedOn(row.registeredOnIso),
    registeredOnIso: row.registeredOnIso,
    smsConsent: row.smsConsent,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
  };
}

/** Only Confirmed rows hold a seat — the same rule the checkout capacity gate uses. */
export function countConfirmed(players: AdminMondayGirlsPlayer[]): number {
  return players.filter((p) => p.status === "Confirmed").length;
}

/**
 * Confirmed seats broken down by level, in MONDAY_GIRLS_LEVELS order.
 *
 * NOT a capacity view — the block has ONE cap for both levels (see
 * MONDAY_GIRLS_BLOCK_SEATS). This is a MIX view, and it exists because the
 * mix is the one risk widening the block introduced that code cannot fix: a
 * roster of seven advanced beginners and one beginner leaves that beginner the
 * only girl at her level, which is the exact objection this block was built to
 * answer. Sam can only act on what he can see.
 *
 * A row whose Group is blank or typo'd counts under `unknown` rather than
 * vanishing — same rule as the /admin/fall "Not in a group" section.
 */
export function countConfirmedByLevel(players: AdminMondayGirlsPlayer[]): {
  byLevel: { level: string; count: number }[];
  unknown: number;
} {
  const confirmed = players.filter((p) => p.status === "Confirmed");
  const byLevel = MONDAY_GIRLS_LEVELS.map((level) => ({
    level,
    count: confirmed.filter((p) => p.group === level).length,
  }));
  const known = new Set<string>(MONDAY_GIRLS_LEVELS);
  return {
    byLevel,
    unknown: confirmed.filter((p) => !known.has(p.group)).length,
  };
}

/**
 * Split the admin roster: registrations (Confirmed / Refunded / Cancelled, the
 * rows that ever held or paid for a seat) vs maybes (families Sam is still
 * talking to). Dismissed maybes are dropped from both. Split BEFORE any count,
 * money total or empty-state check, so a maybe can never read as a $0 seat.
 */
export function splitMondayGirlsRoster(players: AdminMondayGirlsPlayer[]): {
  registrations: AdminMondayGirlsPlayer[];
  maybes: AdminMondayGirlsPlayer[];
} {
  return {
    registrations: players.filter((p) => p.status !== "Maybe" && p.status !== "Dismissed"),
    maybes: players.filter((p) => p.status === "Maybe"),
  };
}
