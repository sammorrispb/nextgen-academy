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
 * Capped at 40 characters. Metadata (internal) may keep the raw value.
 * Pinned by e2e/invariant-invoice-route-abuse.spec.ts.
 */
export function invoiceSafeName(raw: unknown, fallback = "your player"): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}'’\- ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
  return cleaned || fallback;
}
