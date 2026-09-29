/**
 * A person's name, reduced to what Stripe may print on an invoice.
 *
 * The lesson, Monday Girls drop-in and MVF routes turn an anonymous form into
 * a finalized Stripe invoice emailed to the address typed in, and names used
 * to reach the line description, memo and customer name verbatim — so anyone
 * could make NGA's Stripe account email "Pay at evil.example" to a stranger
 * (security review 2026-09-28, H2). Letters (any script), combining marks,
 * apostrophes, hyphens and spaces survive; everything else — digits, dots,
 * slashes, colons, @ — becomes a space, so no link, domain or address can.
 * LATIN script only: other scripts carry letters that LOOK like punctuation
 * (Lisu U+A4F8 "ꓸ", modifier colon U+02D0 "ː", Canadian syllabics U+141F "ᐟ"),
 * which would let "evilꓸcom" through. Accented Latin (Zoë, Nguyễn) survives;
 * a name written entirely in another script falls back to the generic label.
 * Latin modifier letters (\p{Lm}), U+A78F "ꞏ" and U+01C0–U+01C3 "ǀ ǁ ǂ ǃ"
 * (pipe and "!" look-alikes) are Latin-script look-alikes too. A combining mark
 * survives only on a letter: after a space, hyphen, apostrophe or stripped
 * character a dot-below mark would print as a floating ".".
 * Capped at 40 characters. Metadata (internal) may keep the raw value.
 * Pinned by e2e/invariant-invoice-route-abuse.spec.ts.
 */
export function invoiceSafeName(raw: unknown, fallback = "your player"): string {
  return cleanPersonName(raw) || fallback;
}

const NOT_A_NAME_CHARACTER =
  /(?:[^\p{Script=Latin}\p{M}'’\- ]|[\p{Lm}\uA78F\u01C0-\u01C3])+/gu;
const MARK_NOT_ON_A_LETTER = /(?<![\p{L}\p{M}])\p{M}+/gu;

/**
 * The same cleaning with no fallback: "" when nothing printable survives, so a
 * caller that must not invent a name (the Link & Dink roster) can tell.
 * Mirrored in scripts/audit-stripe-customer-names.mjs; the invoice spec runs
 * the same fixtures through both copies.
 */
export function cleanPersonName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFC")
    .replace(NOT_A_NAME_CHARACTER, " ")
    .replace(MARK_NOT_ON_A_LETTER, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
}
