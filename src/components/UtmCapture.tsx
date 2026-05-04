"use client";

import { useEffect } from "react";
import { captureUtm } from "@/lib/funnelClient";

/**
 * One-shot UTM capture. Reads utm_source/utm_campaign/utm_medium/ref from
 * the URL on first landing and stashes in sessionStorage. Idempotent —
 * safe to mount unconditionally.
 *
 * Note: unlike the sammorrispb sibling component this does NOT strip the
 * captured params from the URL. The NGA lead route forwards utm_* fields
 * to Notion + Open Brain by reading them directly from the form payload
 * (which the LeadForm captures from window.location.search at mount).
 * Stripping the URL would break that flow.
 */
export default function UtmCapture() {
  useEffect(() => {
    try {
      captureUtm();
    } catch {
      /* analytics must never break the page */
    }
  }, []);

  return null;
}
