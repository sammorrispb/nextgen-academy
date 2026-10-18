import type Stripe from "stripe";

export const PAYMENT_OWNER = "nga_site";

const CHECKOUT_KINDS = new Set([
  "camp", "league", "cluster", "fall", "picklpark", "monday-girls",
  "monday-girls-dropin", "lesson", "mvf-junior-tournament",
]);
const INVOICE_KINDS = new Set(["lesson", "monday-girls-dropin", "mvf-junior-tournament"]);
const FOREIGN_KEYS = new Set([
  "nga_request_id", "rsvp_id", "ladder_league_registration_id",
  "partner_league_pair_member_id", "participation_id",
]);

/** Explicit ownership and reserved product markers beat look-alike native fields. */
export function hasForeignPaymentOwner(metadata: Stripe.Metadata | null | undefined): boolean {
  if (!metadata) return false;
  if (Object.hasOwn(metadata, "payment_owner") && metadata.payment_owner !== PAYMENT_OWNER) return true;
  return Object.keys(metadata).some(key => key.startsWith("coach_os_") || FOREIGN_KEYS.has(key));
}

/**
 * Only these existing native product shapes may enter a roster/email handler.
 * A valid signature proves Stripe sent an event, not which app owns the sale.
 * Missing ownership on pre-rollout payments is accepted only with known native
 * product metadata. Unknown kinds never fall through to the drop-in lane.
 */
export function nativePaymentOwned(
  metadata: Stripe.Metadata | null | undefined,
  lane: "checkout" | "invoice",
): boolean {
  if (!metadata || hasForeignPaymentOwner(metadata)) return false;
  const kind = metadata.kind;
  if (kind) return (lane === "invoice" ? INVOICE_KINDS : CHECKOUT_KINDS).has(kind);
  return lane === "checkout" && Boolean(metadata.session_id?.trim() && metadata.child_first_name?.trim() && metadata.parent_name?.trim());
}

/** Keep the owner on both webhook objects; do not copy child fields to the PI. */
export function ownedCheckoutParams(params: Stripe.Checkout.SessionCreateParams): Stripe.Checkout.SessionCreateParams {
  return {
    ...params,
    metadata: { ...params.metadata, payment_owner: PAYMENT_OWNER },
    ...(params.mode === "setup" ? {
      setup_intent_data: { ...params.setup_intent_data, metadata: { ...params.setup_intent_data?.metadata, payment_owner: PAYMENT_OWNER } },
    } : {
      payment_intent_data: { ...params.payment_intent_data, metadata: { ...params.payment_intent_data?.metadata, payment_owner: PAYMENT_OWNER } },
    }),
  };
}
