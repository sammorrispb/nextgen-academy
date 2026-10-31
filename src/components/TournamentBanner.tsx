"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/funnelClient";

/**
 * Sitewide announcement bar for the next MVF Junior Tournament in the series.
 *
 * Sam 2026-10-31: put the November tournament back in front of parents with a
 * banner and a "Tournaments" nav item. The layout picks the event and decides
 * whether registration is actually open (the same `publicSeriesRelease` gate
 * the event page uses), so the bar never says "Register" while the page says
 * registration is not open. It flips to "Register" on its own when a release
 * is published, and moves to the next month after each event.
 *
 * Hidden on admin and coach surfaces: Sam flagged the October bar on
 * /admin/fall as noise (agent-log, 2026-10-25).
 */
const noopSubscribe = () => () => {};

export default function TournamentBanner({
  href,
  eventIso,
  dateLabel,
  divisionsLabel,
  registrationOpen,
}: {
  href: string;
  eventIso: string;
  dateLabel: string;
  divisionsLabel: string;
  registrationOpen: boolean;
}) {
  const pathname = usePathname() ?? "";
  // Static pages freeze the layout's "next event" at build time. If a page was
  // built before the event and served after it, hide the bar rather than
  // advertise a tournament that already happened; the next deploy rolls it on.
  const past = useSyncExternalStore(
    noopSubscribe,
    () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()) > eventIso,
    () => false,
  );
  if (past || pathname.startsWith("/admin") || pathname.startsWith("/coach") || pathname === href) {
    return null;
  }
  const cta = registrationOpen ? "Register" : "Registration opens soon · Details";
  return (
    <div className="bg-ngpa-lime text-ngpa-deep">
      <Link
        href={href}
        onClick={() =>
          trackEvent("cta_click", {
            label: "tournament_banner",
            destination: href,
            section: "sitewide_banner",
          })
        }
        className="mx-auto flex min-h-[48px] max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-4 py-2 text-center"
      >
        <span className="font-heading text-xs sm:text-sm font-black uppercase tracking-widest">
          MVF Junior Tournament
        </span>
        <span className="text-xs sm:text-sm font-semibold">
          {dateLabel} &middot; {divisionsLabel}
        </span>
        <span className="font-heading text-xs sm:text-sm font-black underline underline-offset-2">
          {cta} &rarr;
        </span>
      </Link>
    </div>
  );
}
