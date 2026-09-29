// The fixed mobile CTA's target per route (AEO/brand review, 2026-09-13).
//
// Evaluations open a text to Coach Sam; lesson pages open lesson scheduling.
// On a partner-venue page where no evaluation is offered (Frederick — The
// Pickl Park runs registration there), that button would promise something
// that doesn't exist, so the page gets its own honest CTA instead.
// Pure: pinned by e2e/frederick-page.spec.ts.

import { EVALUATION_SMS_URL } from "@/data/scheduling";

export interface StickyCta {
  label: string;
  href: string;
  trackLabel: string;
}

const DEFAULT_CTA: StickyCta = {
  label: "Text for an Evaluation",
  href: EVALUATION_SMS_URL,
  trackLabel: "sticky_mobile_book_eval",
};

const ROUTE_CTAS: Record<string, StickyCta> = {
  "/lessons": {
    label: "Request a Lesson",
    href: "/lessons/book",
    trackLabel: "sticky_mobile_lesson_request",
  },
  "/youth-pickleball-frederick": {
    label: "See Frederick Leagues",
    href: "#leagues",
    trackLabel: "sticky_mobile_frederick_leagues",
  },
};

export function stickyCtaFor(pathname: string | null | undefined): StickyCta {
  const path = (pathname ?? "/").replace(/\/+$/, "") || "/";
  return ROUTE_CTAS[path] ?? DEFAULT_CTA;
}
