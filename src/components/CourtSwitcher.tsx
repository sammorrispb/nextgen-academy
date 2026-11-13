"use client";

import { FAMILY_CORNERS, familyMarketingRef, familySiteUrl } from "@/lib/urls";
import { trackEvent } from "@/lib/funnelClient";

/** Accessible name of the switcher landmark. Draft wording; Sam finalizes it. */
export const COURT_SWITCHER_LABEL = "Sam Morris pickleball sites";
/** Read by screen readers after each outbound site name. Draft wording; Sam finalizes it. */
export const NEW_TAB_CUE = "(opens in a new tab)";

// One court, one service box per site: light lines on a dark court. The boxes
// keep FAMILY_CORNERS order at every width (stacked rows on a phone, three
// across from sm), so the court reads the same on each of Sam's sites.
//
// This site's box is lit and is deliberately not a link: a link to the page
// you are on is a dead tap, and aria-current tells a screen reader the same
// thing the teal tells the eye. Text on teal is ngpa-deep (7.15:1); the other
// boxes are ngpa-white on ngpa-navy (13.25:1).
const BOX =
  "flex min-h-12 w-full items-center justify-center px-4 py-3 text-center font-heading text-sm font-bold leading-snug";

// The ring is drawn INSIDE the box and marked important on purpose. The court
// clips its corners (overflow-hidden), and globals.css sets an unlayered
// `*:focus-visible` outline 2px outside the element in the same light colour
// as the court lines: left alone, that ring is clipped away and a keyboard
// user sees no focus at all.
const FOCUS_RING =
  "focus-visible:outline-[3px]! focus-visible:-outline-offset-[5px]! focus-visible:outline-ngpa-teal-bright!";

export default function CourtSwitcher() {
  return (
    <nav aria-label={COURT_SWITCHER_LABEL} className="mt-10 pt-8 border-t border-ngpa-slate/40">
      <ul className="mx-auto grid max-w-3xl grid-cols-1 sm:grid-cols-3 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-ngpa-white/70 overflow-hidden rounded-md border-2 border-ngpa-white/70 bg-ngpa-navy">
        {FAMILY_CORNERS.map((corner) => {
          const dest = corner.dest;
          if (!dest) {
            return (
              <li key={corner.id} data-corner={corner.id}>
                <span aria-current="page" className={`${BOX} bg-ngpa-teal text-ngpa-deep`}>
                  {corner.name}
                </span>
              </li>
            );
          }
          const label = `switcher_${dest}`;
          const href = familySiteUrl(dest, "/", label);
          return (
            <li key={corner.id} data-corner={corner.id}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent("external_link", { label, url: href, page: "footer" }, familyMarketingRef(dest))
                }
                className={`${BOX} text-ngpa-white transition-colors motion-reduce:transition-none hover:bg-ngpa-panel hover:text-ngpa-teal-bright ${FOCUS_RING}`}
              >
                <span>
                  {corner.name}
                  <span className="sr-only">{` ${NEW_TAB_CUE}`}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
