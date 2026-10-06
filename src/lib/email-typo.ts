// Email typo recognition for parent-entered addresses.
//
// Parents type their email into registration forms; a transposed letter in the
// domain (gmail.fom) means invoices and confirmations never arrive. This module
// recognizes those typos and maps them to the intended address.
//
// Design notes:
// - Curated map only, NO fuzzy/edit-distance matching. Edit distance is unsafe:
//   "mail.com" is one insertion from "gmail.com" but is a legitimate provider.
//   Every entry here is a domain that cannot receive mail as typed.
// - Server: `normalizeEmailTypos` runs right after shape validation in the
//   public registration API routes, so the corrected address is what gets
//   stored in the CRM, sent to Stripe, and emailed.
// - Client: `suggestEmailCorrection` powers the "Did you mean …?" hint under
//   email fields so parents catch it before submitting.

const DOMAIN_TYPO_MAP: Record<string, string> = {
  // gmail.com — a real gmail.fom bounce (Oct 1, 2026) came from here
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cim": "gmail.com",
  "gmail.fom": "gmail.com",
  "gmail.vom": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.comm": "gmail.com",
  // yahoo.com
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahoo.cm": "yahoo.com",
  "yahoo.co": "yahoo.com",
  // hotmail.com
  "hotmal.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.cm": "hotmail.com",
  "hotmail.co": "hotmail.com",
  // outlook.com
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outlook.cm": "outlook.com",
  // icloud.com
  "iclod.com": "icloud.com",
  "icloud.con": "icloud.com",
  "icloud.cm": "icloud.com",
  "icloud.co": "icloud.com",
  // aol.com / live.com
  "aol.con": "aol.com",
  "aol.cm": "aol.com",
  "live.con": "live.com",
  "live.cm": "live.com",
  // comcast.net
  "comcast.ne": "comcast.net",
  "comcast.nett": "comcast.net",
};

function splitEmail(email: string): { local: string; domain: string } | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  return { local: trimmed.slice(0, at), domain: trimmed.slice(at + 1).toLowerCase() };
}

/**
 * Returns the corrected email address when the domain is a recognized typo,
 * otherwise null. The local part is never altered.
 */
export function suggestEmailCorrection(email: string): string | null {
  const parts = splitEmail(email);
  if (!parts) return null;
  const fixed = DOMAIN_TYPO_MAP[parts.domain];
  if (!fixed) return null;
  return `${parts.local}@${fixed}`;
}

/**
 * Server-side safety net: returns the email with a recognized domain typo
 * corrected, otherwise the trimmed original. Idempotent — already-correct
 * addresses pass through unchanged.
 */
export function normalizeEmailTypos(email: string): string {
  const corrected = suggestEmailCorrection(email);
  return corrected ?? email.trim();
}

/** True when the address was changed by typo normalization. */
export function hadEmailTypo(email: string): boolean {
  return suggestEmailCorrection(email) !== null;
}
