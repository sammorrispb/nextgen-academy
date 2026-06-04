/**
 * First-party UTM stamping for newsletter links.
 *
 * Clicks land back on our own site and are attributed via the first-party
 * /api/analytics → Open Brain pipe — no third-party pixel, so this stays
 * inside the GA4/Meta/@vercel-analytics ban in CLAUDE.md.
 *
 * Only stamp same-origin links. Never stamp external news URLs (we don't
 * attribute traffic we send away), the unsubscribe link, or the referral
 * link (it carries its own `ref` attribution and is shown verbatim to the
 * parent, so an extra query string would just make the visible URL ugly).
 */
export function appendUtm(url: string, content: string, campaign: string): string {
  const params = new URLSearchParams({
    utm_source: "newsletter",
    utm_medium: "email",
    utm_campaign: campaign,
    utm_content: content,
  });
  // Insert the query before any #hash so anchor links (e.g. /#contact-form)
  // keep jumping to the right section; preserve an existing query string.
  const hashIndex = url.indexOf("#");
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${params.toString()}${hash}`;
}
