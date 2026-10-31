"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/funnelClient";
import { nextBannerWake, tournamentBannerState, tournamentBannerTiming } from "@/lib/tournament-banner-state";

/**
 * Sitewide announcement bar for the next MVF Junior Tournament in the series.
 *
 * The layout supplies the release gate and deadline. The client rechecks time
 * even on cached pages and open/background tabs. A later deployment selects
 * the next event; expired cached banners retire rather than advertise it.
 *
 * Hidden on admin and coach surfaces: Sam flagged the October bar on
 * /admin/fall as noise (agent-log, 2026-10-25).
 */
type Props = {
  href: string;
  eventIso: string;
  dateLabel: string;
  divisionsLabel: string;
  registrationOpen: boolean;
  registrationClosesAt?: string;
};

export default function TournamentBanner(props: Props) {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/admin") || pathname.startsWith("/coach") || pathname === props.href) {
    return null;
  }
  return <TimedTournamentBanner {...props} />;
}

function TimedTournamentBanner({ href, eventIso, dateLabel, divisionsLabel, registrationOpen, registrationClosesAt }: Props) {
  const timing = useMemo(() => tournamentBannerTiming(eventIso, registrationClosesAt), [eventIso, registrationClosesAt]);
  const subscribe = useCallback((onChange: () => void) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      onChange();
      const delay = nextBannerWake(timing, Date.now());
      if (delay != null) timer = setTimeout(refresh, delay);
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [timing]);
  const snapshot = useCallback(() => tournamentBannerState(timing, registrationOpen, Date.now()), [timing, registrationOpen]);
  // Cached SSR must never advertise an open release without a current clock.
  const state = useSyncExternalStore(subscribe, snapshot, () => "unknown");
  if (state === "past") return null;
  const cta = state === "open" ? "Register" : state === "unknown" ? "Details" : "Registration not open · Details";
  return (
    <div className="bg-ngpa-teal text-ngpa-deep">
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
