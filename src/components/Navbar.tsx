"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { EVALUATION_SMS_URL } from "@/data/scheduling";
import { trackEvent } from "@/lib/funnelClient";
import { NAV_LINKS } from "@/lib/mobile-tabs";

// The doors live in lib/mobile-tabs so the phone bar can never miss one. This
// bar shows them from lg up; below that the fixed bottom bar steers the site.
const links = NAV_LINKS;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  function resolveHref(href: string) {
    if (href.startsWith("#")) {
      return isHome ? href : `/${href}`;
    }
    return href;
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navBg = scrolled
    ? "bg-ngpa-deep/95 border-ngpa-slate/70 shadow-lg shadow-black/20"
    : "bg-ngpa-deep/70 border-transparent";

  return (
    <nav
      aria-label="Site"
      className={`sticky top-0 z-50 backdrop-blur-md border-b transition-all duration-200 ${navBg}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Next Gen Pickleball Academy — Home">
            <Image
              src="/images/logo.png"
              alt="Next Gen Pickleball Academy"
              width={160}
              height={46}
              className="h-9 sm:h-11 w-auto"
              priority
            />
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {links.map((link) => {
              const resolved = resolveHref(link.href);
              const isActive = !link.href.startsWith("#") && pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={resolved}
                  className={`relative px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    isActive
                      ? "text-ngpa-teal"
                      : "text-ngpa-white/85 hover:text-ngpa-teal"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full bg-ngpa-teal"
                    />
                  )}
                </Link>
              );
            })}
            <a
              href={EVALUATION_SMS_URL}
              onClick={() =>
                trackEvent("cta_click", {
                  label: "navbar_get_started",
                  destination: EVALUATION_SMS_URL,
                  section: "navbar_desktop",
                })
              }
              className="ml-4 inline-flex items-center gap-2 px-5 py-2.5 bg-ngpa-teal text-ngpa-deep text-sm font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors shadow-lg shadow-ngpa-teal/20"
            >
              Text for an Evaluation
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
