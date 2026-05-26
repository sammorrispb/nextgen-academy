import { c, s } from "./brand";

export const WHATSAPP_PARENT_GROUP_URL =
  "https://chat.whatsapp.com/D298cbHYUZo53zdBkbafq8?mode=gi_t";

// First-touch only — and rendered as a utility block, not a CTA. Keeping
// it quieter preserves the host email's single primary CTA (per
// BRAND_GUIDELINES.md → COMMS TEMPLATES → CTA hierarchy). Stays out of the
// public footer on purpose; the invite should travel with a real hand-shake,
// not be scraped from the homepage.
export function whatsappInviteHtml(): string {
  return `<div style="${s.card}">
    <p style="margin:0 0 6px 0;font-size:13px;color:${c.muted};text-transform:uppercase;letter-spacing:0.15em;font-weight:700;">You&rsquo;re invited &mdash; Next Gen parent WhatsApp</p>
    <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">
      Quickest way to reach the other Next Gen parents &mdash; carpool plans, who&rsquo;s coming this Saturday, what&rsquo;s working for your kid. Coach Sam&rsquo;s in there too. <a href="${WHATSAPP_PARENT_GROUP_URL}" style="${s.link}font-weight:700;">Open the WhatsApp group.</a> Better, together.
    </p>
  </div>`;
}

export function whatsappInviteText(): string {
  return [
    `You're invited — Next Gen parent WhatsApp. Quickest way to reach the other parents (carpool plans, who's coming this Saturday, what's working for your kid). Coach Sam's in there too. Better, together.`,
    `Open the group: ${WHATSAPP_PARENT_GROUP_URL}`,
  ].join("\n");
}
