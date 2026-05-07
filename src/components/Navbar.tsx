"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/funnelClient";

const links = [
  { href: "#levels", label: "Programs" },
  { href: "/schedule", label: "Schedule" },
  { href: "/schools", label: "For Schools" },
  { href: "#about", label: "About" },
  { href: "#faq", label: "FAQ" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isHome = pathname === "/";

  function resolveHref(href: string) {
    if (href.startsWith("#")) {
      return isHome ? href : `/${href}`;
    }
    return href;
  }

  const closeMenu = useCallback(() => {
    setOpen(false);
    hamburgerRef.current?.focus();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;

    const focusableEls = menu.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])'
    );
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeMenu();
        return;
      }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    }

    menu.addEventListener("keydown", handleKeyDown);
    firstEl?.focus();
    return () => menu.removeEventListener("keydown", handleKeyDown);
  }, [open, closeMenu]);

  const navBg = scrolled
    ? "bg-ngpa-deep/95 border-ngpa-slate/70 shadow-lg shadow-black/20"
    : "bg-ngpa-deep/70 border-transparent";

  return (
    <nav
      className={`sticky top-0 z-50 backdrop-blur-md border-b transition-all duration-200 ${navBg}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href="/" className="flex items-center" aria-label="Next Gen Pickleball Academy — Home">
            <Image
              src="/images/logo.png"
              alt="Next Gen Pickleball Academy"
              width={160}
              height={46}
              className="h-9 sm:h-11 w-auto"
              priority
            />
          </Link>

          <div className="hidden md:flex items-center gap-1">
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
              href={resolveHref("#contact-form")}
              onClick={() =>
                trackEvent("cta_click", {
                  label: "navbar_get_started",
                  destination: resolveHref("#contact-form"),
                  section: "navbar_desktop",
                })
              }
              className="ml-4 inline-flex items-center gap-2 px-5 py-2.5 bg-ngpa-teal text-ngpa-deep text-sm font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors shadow-lg shadow-ngpa-teal/20"
            >
              Free Evaluation
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          <button
            ref={hamburgerRef}
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 -mr-2 text-ngpa-white hover:text-ngpa-teal min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <div
            ref={menuRef}
            id="mobile-menu"
            role="dialog"
            aria-label="Navigation menu"
            className="md:hidden pb-5 border-t border-ngpa-slate/60"
          >
            <div className="flex flex-col gap-1 pt-4">
              {links.map((link) => {
                const resolved = resolveHref(link.href);
                const isActive = !link.href.startsWith("#") && pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={resolved}
                    onClick={() => setOpen(false)}
                    className={`px-4 py-3 text-base font-semibold rounded-lg ${
                      isActive
                        ? "text-ngpa-teal bg-ngpa-slate/40"
                        : "text-ngpa-white hover:bg-ngpa-slate/40"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <a
                href={resolveHref("#contact-form")}
                onClick={() => {
                  setOpen(false);
                  trackEvent("cta_click", {
                    label: "navbar_get_started",
                    destination: resolveHref("#contact-form"),
                    section: "navbar_mobile",
                  });
                }}
                className="mt-3 mx-1 px-5 py-3.5 bg-ngpa-teal text-ngpa-deep text-base font-bold rounded-full text-center hover:bg-ngpa-teal-bright transition-colors"
              >
                Get Free Evaluation
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
