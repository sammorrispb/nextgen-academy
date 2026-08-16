/**
 * Client-safe half of the one-time-waiver gate contract.
 *
 * Deliberately separate from waiver-gate.ts: that module re-exports
 * hasWaiverOnFile from notion-waivers, so importing the shared constant from
 * there would drag the Notion client into every registration form's browser
 * bundle. This file holds no server code and reads no env, so the four paid
 * forms can import it freely; waiver-gate.ts re-exports the code from here to
 * keep exactly one definition of the string both sides compare on.
 */

/** Discriminator the checkout routes return on a 409 when no waiver is on file. */
export const WAIVER_REQUIRED_CODE = "waiver_required";

export interface CheckoutErrorBody {
  code?: string;
  error?: string;
  /** Prefilled /waiver/sign link. Retained for callers outside the forms —
   *  the forms sign in place and never navigate, so it isn't load-bearing. */
  signUrl?: string;
}

/**
 * Did this checkout response hit the waiver gate?
 *
 * Checks the code, NOT the presence of signUrl — the forms answer the gate
 * inline now, and requiring the link would drop a parent into a raw error
 * toast if it were ever absent. Every other 409 the checkout routes return
 * (sold_out, duplicate_registration) must fall through to its own message.
 */
export function isWaiverRequired(
  status: number,
  body: CheckoutErrorBody | null | undefined,
): boolean {
  return status === 409 && body?.code === WAIVER_REQUIRED_CODE;
}
