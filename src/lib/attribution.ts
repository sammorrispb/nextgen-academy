/**
 * Shared UTM → human "Source" attribution vocabulary.
 *
 * Single source of truth for mapping a raw utm_source onto the clean Notion
 * select values used across the lead form, drop-in roster, and waitlist DBs.
 * Extracted from /api/lead so every funnel surface speaks the SAME vocab —
 * don't fork this logic back into a route.
 */

export interface UtmFields {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  ref?: string | null;
}

/**
 * Map common ad sources to clean Notion select values. Unknown sources keep
 * their raw name behind an "Ad: " prefix so new channels surface without a
 * code change (Notion auto-creates select options on first write).
 *
 * `fallback` is the no-attribution label: "Website" for paid surfaces
 * (drop-in roster, waitlist), "Website Lead Form" for the lead route (its
 * historical vocab — existing Notion selects must not drift).
 */
export function attributedSource(
  utm: UtmFields,
  fallback: string = "Website",
): string {
  const src = utm.utm_source?.toLowerCase();
  if (src === "facebook" || src === "fb") return "Facebook Ad";
  if (src === "instagram" || src === "ig") return "Instagram Ad";
  if (src === "google") return "Google Ad";
  // Notion select names cap at 100 chars — a hostile/garbage utm_source must
  // not 400 the row create (on the webhook path that's a paid-but-unregistered
  // parent). Commas are illegal in select names; swap for spaces.
  if (utm.utm_source) {
    return `Ad: ${utm.utm_source}`.replace(/,/g, " ").slice(0, 100);
  }
  return fallback;
}
