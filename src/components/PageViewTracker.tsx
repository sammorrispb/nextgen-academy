"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/funnelClient";

const SKIP_PREFIXES = ["/api", "/og", "/admin"];

function shouldSkip(pathname: string | null): boolean {
  if (!pathname) return true;
  return SKIP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Fires `page_view` on every App Router pathname change. Mounted once at
 * the root layout. The `lastFired` ref + 50ms debounce avoids React
 * StrictMode double-invocation in dev and rapid pathname flips.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const lastFired = useRef<string | null>(null);

  useEffect(() => {
    if (shouldSkip(pathname)) return;
    if (pathname === lastFired.current) return;

    const id = window.setTimeout(() => {
      if (pathname === lastFired.current) return;
      lastFired.current = pathname;
      try {
        trackEvent("page_view", {
          referrer: typeof document !== "undefined" ? document.referrer : "",
        });
      } catch {
        /* analytics must never break the page */
      }
    }, 50);

    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
