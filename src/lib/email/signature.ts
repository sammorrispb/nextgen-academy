import { c, s } from "./brand";

/**
 * The standard contact + community block that closes every recipient-facing
 * NGA email: Coach Sam's phone, plus both WhatsApp community invites.
 *
 * Deliberately APPENDS to each template's existing sign-off rather than
 * replacing it. An earlier pass tried to standardise the whole footer and
 * flattened per-template taglines that carry real voice — "Thanks for rolling
 * with us — better than yesterday, together." on a cancellation is warmer than
 * the generic "See you on the court", and `comms-templates.spec.ts` pins those
 * exact strings. So the signoff line stays the template's own; only the contact
 * details are shared, which is the part that must never drift.
 *
 * BOTH community groups ride along on every recipient-facing email — Sam's call
 * (2026-08-17), overriding a brand-matched-only recommendation. They are
 * LABELLED by audience so the adult invite reads as an intentional cross-invite
 * in a youth email rather than a misfire. Internal/ops mail does NOT use this:
 * eval-booking-notify (→ Sam), coach-pre-event and camp-checklist-reminder
 * (→ coaches) are excluded on purpose.
 *
 * Rendered as a utility footer, never a CTA, so it can't compete with a
 * template's single primary CTA (BRAND_GUIDELINES.md §CTA hierarchy).
 */

export const COACH_PHONE_DISPLAY = "301-325-4731";
export const COACH_PHONE_TEL = "13013254731";

// The same groups the codebase already pointed at — only WhatsApp's
// share-source params differ from the links Sam pasted, so the invite codes
// are unchanged and the existing constants stay authoritative.
export const WHATSAPP_NGA_GROUP_URL =
  "https://chat.whatsapp.com/D298cbHYUZo53zdBkbafq8?mode=gi_t";
export const WHATSAPP_LD_GROUP_URL =
  "https://chat.whatsapp.com/LaRjBQT8O5p5aJS5vSAk0i?mode=gi_t";

/** Both community invites, no phone — for templates that print a phone already. */
export function whatsappGroupsHtml(): string {
  return `<p style="margin:10px 0 0 0;color:${c.muted};font-size:12px;line-height:1.55;">
        <a href="${WHATSAPP_NGA_GROUP_URL}" style="${s.link}font-weight:700;">Next Gen parents WhatsApp</a>
        &mdash; carpools, who&rsquo;s coming this week.<br>
        <a href="${WHATSAPP_LD_GROUP_URL}" style="${s.link}font-weight:700;">Link &amp; Dink WhatsApp</a>
        &mdash; adult play around MoCo, if you&rsquo;re on court too.
      </p>`;
}

export function whatsappGroupsText(): string {
  return [
    `Next Gen parents WhatsApp — carpools, who's coming this week:`,
    WHATSAPP_NGA_GROUP_URL,
    `Link & Dink WhatsApp — adult play around MoCo, if you're on court too:`,
    WHATSAPP_LD_GROUP_URL,
  ].join("\n");
}

/** Phone + both community invites. The default close for recipient-facing mail. */
export function signatureExtrasHtml(): string {
  return `<p style="margin:8px 0 0 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Text or call Coach Sam: <a href="tel:${COACH_PHONE_TEL}" style="${s.link}">${COACH_PHONE_DISPLAY}</a>
      </p>
      ${whatsappGroupsHtml()}`;
}

export function signatureExtrasText(): string {
  return [
    `Text or call Coach Sam: ${COACH_PHONE_DISPLAY}`,
    ``,
    whatsappGroupsText(),
  ].join("\n");
}
