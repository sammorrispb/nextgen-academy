/**
 * True for a registration Sam has withdrawn: Refunded or Cancelled on the
 * roster's Status select. No code writes either value (the checkout writes
 * Pending, the webhook Confirmed); they are set by hand, so the spelling is
 * read leniently. The reminder crons skip these rows before any Stripe call:
 * a refunded family needs no reminder, and its invoice may sit on an account
 * the site's key can't read, which would otherwise alert every day.
 */
export function isWithdrawnMvfRegistration(status: string): boolean {
  return /^(refunded|cancell?ed)$/i.test(status.trim());
}
