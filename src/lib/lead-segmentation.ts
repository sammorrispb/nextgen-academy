/**
 * DD-provenance segmentation for the NGA lead CRM.
 *
 * Encodes the "no DD-derived sales" hard rule: NGA marketing may only target
 * leads from Sam's own post-DD channels — never contacts traceable to his
 * Dill Dinkers / CourtReserve era. This classifier is the single source of
 * truth for that split so any outreach (e.g. the eval-lead newsletter invite)
 * can filter to ELIGIBLE-only before sending. Pure + unit-tested.
 */

export type LeadBucket = "eligible" | "off_limits" | "ambiguous";

export interface LeadRow {
  parentEmail: string;
  source: string; // Notion select name, "" if unset
  crEventsAttended: number | null;
  crEventHistory: string;
  lastCrEvent: string;
  season: string; // "" if unset
  notes: string;
  // Operator-set "do not market" flag on the CRM (the Quarantine checkbox).
  // Set when a parent opts out (e.g. replies "skip" to an outreach blast). Wins
  // over every provenance check so an opt-out is honored regardless of Source.
  quarantine?: boolean;
}

export interface LeadClassification {
  bucket: LeadBucket;
  reason: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sources that are unambiguously Sam's own post-DD marketing.
const ELIGIBLE_SOURCES = new Set([
  "Website",
  "Website Lead Form",
  "Free Trial",
  "Facebook Ad",
  "Ad: test",
  "Ad: peachjar-test",
  "School Outreach",
  "MCCPTA",
  "Walk-up",
  "Drop-In",
]);

// Sources that scream DD/CourtReserve provenance.
const DD_SOURCES = new Set(["CourtReserve", "Google Sheet"]);

// Seasons NGA ran inside DD facilities (pre-relocation).
const DD_SEASONS = new Set(["Fall 2025", "Winter 2026"]);

const DD_NOTE_RE = /\b(courtreserve|court reserve|dill\s*dinkers|\bDD\b)\b/i;

export function isMailable(email: string): boolean {
  return EMAIL_RE.test((email ?? "").trim());
}

// Internal / fake / Sam's-own addresses that must never receive outreach,
// plus obvious QA rows. Filtered before DD classification.
const INTERNAL_EMAILS = new Set(["nextgenacademypb@gmail.com"]);

export function isTestOrInternal(name: string, email: string): boolean {
  const n = (name ?? "").toLowerCase();
  const e = (email ?? "").trim().toLowerCase();
  if (/\b(test|smoke)\b/.test(n)) return true;
  if (INTERNAL_EMAILS.has(e)) return true;
  if (e.startsWith("sam.morris2131")) return true; // Sam's own + plus-aliases
  if (e.endsWith("@example.com")) return true;
  if (/(\+[^@]*(test|smoke|nga-test)|\btest\.)/.test(e)) return true;
  return false;
}

export function classifyLead(row: LeadRow): LeadClassification {
  // Honored opt-out — off-limits for any outreach, before any provenance check.
  // A parent who asked to be removed must never be mailed again, whatever their
  // Source bucket (e.g. a clean "Website" lead who replied "skip").
  if (row.quarantine) {
    return { bucket: "off_limits", reason: "Quarantined (opted out)" };
  }

  // DD-derived — off-limits for any outreach.
  if (DD_SOURCES.has(row.source)) {
    return { bucket: "off_limits", reason: `Source=${row.source}` };
  }
  if ((row.crEventsAttended ?? 0) > 0) {
    return { bucket: "off_limits", reason: "CR events attended" };
  }
  if (row.crEventHistory.trim() || row.lastCrEvent.trim()) {
    return { bucket: "off_limits", reason: "CR event history" };
  }
  if (DD_SEASONS.has(row.season)) {
    return { bucket: "off_limits", reason: `DD-era season (${row.season})` };
  }
  if (DD_NOTE_RE.test(row.notes)) {
    return { bucket: "off_limits", reason: "DD/CR mention in notes" };
  }

  // Clean own-marketing source → eligible.
  if (ELIGIBLE_SOURCES.has(row.source)) {
    return { bucket: "eligible", reason: `Source=${row.source}` };
  }

  // No DD signal, but source is empty/unverifiable (Evaluation, Referral,
  // Demo Day, EBB, or blank) — hold for manual review, never blanket-mail.
  return {
    bucket: "ambiguous",
    reason: row.source ? `Source=${row.source} (unverifiable)` : "Source empty",
  };
}
