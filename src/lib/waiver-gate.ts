// Shared bits for the pre-checkout one-time-waiver gate. The boolean read lives
// in notion-waivers.ts (hasWaiverOnFile); this file just standardizes the 409
// contract every checkout route returns when a parent has no waiver on file, so
// the client forms can detect it uniformly and redirect to /waiver/sign.

export { hasWaiverOnFile } from "./notion-waivers";

/** Discriminator the client forms check on a 409 to trigger the sign redirect. */
export const WAIVER_REQUIRED_CODE = "waiver_required";

export const WAIVER_REQUIRED_MESSAGE =
  "Please sign the one-time waiver before registering — it only takes a minute and covers every NGA program.";

/** Build the prefilled /waiver/sign link the 409 hands back to the form. */
export function buildWaiverSignUrl(ctx: {
  email?: string;
  parentName?: string;
  /** Where to send the parent after they sign (defaults to /schedule). */
  next?: string;
}): string {
  const params = new URLSearchParams();
  if (ctx.email) params.set("email", ctx.email);
  if (ctx.parentName) params.set("name", ctx.parentName);
  if (ctx.next) params.set("next", ctx.next);
  const qs = params.toString();
  return qs ? `/waiver/sign?${qs}` : "/waiver/sign";
}
