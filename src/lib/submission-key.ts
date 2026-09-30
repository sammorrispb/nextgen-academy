// The submission id an invoice sign-up form sends becomes Stripe's
// Idempotency-Key (see createAndSendSignupInvoice). Stripe replays the FIRST
// result for a repeated key, and rejects a repeated key whose request differs.
// So the key follows the form's content for the life of the page: the same
// content — a retry after a dropped connection, the resubmit after the inline
// waiver, an edit undone — reuses its key and gets the invoice that already
// went out; new content gets a new key. The key itself is random: Stripe
// advises against building keys from personal data.
//
// Pinned by e2e/invariant-invoice-form-retry-key.spec.ts.

/**
 * The key for this form content. `issued` must live as long as the page
 * (a component ref) — a fresh map per submit mints a fresh key every time.
 */
export function submissionKeyFor(
  issued: Map<string, string>,
  content: unknown,
  mint: () => string = () => crypto.randomUUID(),
): string {
  const snapshot = JSON.stringify(content);
  const existing = issued.get(snapshot);
  if (existing) return existing;
  const key = mint();
  issued.set(snapshot, key);
  return key;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The client's submission id, if it is shaped like the ones the forms mint.
 * Anything else means no key — the sign-up still goes through, just without
 * replay protection — so an odd client can never turn a sign-up into a 502
 * (Stripe caps keys at 255 characters).
 */
export function parseSubmissionId(value: unknown): string | undefined {
  return typeof value === "string" && UUID_RE.test(value) ? value : undefined;
}
