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
 * Latin modifier letters (\p{Lm}) and U+A78F "ꞏ" are Latin-script look-alikes too.
 * Capped at 40 characters. Metadata (internal) may keep the raw value.
 * Pinned by e2e/invariant-invoice-route-abuse.spec.ts.
 */
export function invoiceSafeName(raw: unknown, fallback = "your player"): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw
    .normalize("NFC")
    .replace(/(?:[^\p{Script=Latin}\p{M}'’\- ]|[\p{Lm}\uA78F])+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
  return cleaned || fallback;
}
