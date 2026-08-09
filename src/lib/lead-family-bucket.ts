import { classifyLead, type LeadRow } from "./lead-segmentation";

/**
 * Fold every CRM row belonging to ONE parent email into a single decision.
 *
 * The lead CRM has 405 rows for 257 families — botched syncs, per-child rows,
 * and re-imports mean one parent routinely owns three or four rows with
 * different Sources. Classifying row-by-row (the original behaviour) meant a
 * family was mailed if ANY of its rows was clean, because off-limits rows were
 * skipped before the dedup map was populated. Two consequences, both bad:
 * an opt-out recorded on one row was ignored if another row looked clean, and
 * DD provenance leaked (joegadler@, markyuen@, laurenwheelerporter@ each carry
 * a Website row next to a Google Sheet row).
 *
 * Precedence, strongest first:
 *   suppressed  — the person asked us to stop. Absolute, never mailable.
 *   dd_derived  — DD/CourtReserve provenance anywhere in the family.
 *   eligible    — at least one clean own-marketing row.
 *   ambiguous   — own lead, unverifiable Source.
 */
export type FamilyBucket =
  | "suppressed"
  | "dd_derived"
  | "eligible"
  | "ambiguous";

/**
 * @param email             parent email (any casing/whitespace)
 * @param rows              every CRM row for that email
 * @param unsubscribedEmails lowercased emails that unsubscribed from the
 *                          newsletter — a list opt-out must also suppress
 *                          lead-CRM blasts, which are a different sender.
 */
export function resolveFamilyBucket(
  email: string,
  rows: LeadRow[],
  unsubscribedEmails: ReadonlySet<string>,
): FamilyBucket {
  if (unsubscribedEmails.has(email.trim().toLowerCase())) return "suppressed";

  let dd = false;
  let eligible = false;
  for (const row of rows) {
    const { bucket, offLimitsKind } = classifyLead(row);
    if (offLimitsKind === "opt_out") return "suppressed";
    if (offLimitsKind === "dd_derived") dd = true;
    else if (bucket === "eligible") eligible = true;
  }
  if (dd) return "dd_derived";
  if (eligible) return "eligible";
  return "ambiguous";
}
