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
  const pathname = usePathname();
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isHome = pathname === "/";

  // Resolve anchor links: on homepage use bare #anchor, elsewhere prefix with /
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

  return (
    <nav className="sticky top-0 z-50 bg-ngpa-black/95 backdrop-blur border-b border-ngpa-slate">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <Image src="/images/logo.png" alt="Next Gen Pickleball Academy" width={140} height={40} className="h-10 w-auto" priority />
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const resolved = resolveHref(link.href);
              const isActive = !link.href.startsWith("#") && pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={resolved}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "text-ngpa-lime bg-ngpa-slate"
                      : "text-ngpa-white hover:text-ngpa-lime hover:bg-ngpa-slate"
                  }`}
                >
                  {link.label}
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
              className="ml-3 px-5 py-2 bg-ngpa-lime text-ngpa-black text-sm font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
            >
              Get Started
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={hamburgerRef}
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 text-ngpa-white hover:text-ngpa-lime"
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

        {/* Mobile menu */}
        {open && (
          <div
            ref={menuRef}
            id="mobile-menu"
            role="dialog"
            aria-label="Navigation menu"
            className="md:hidden pb-4 border-t border-ngpa-slate"
          >
            <div className="flex flex-col gap-1 pt-3">
              {links.map((link) => {
                const resolved = resolveHref(link.href);
                const isActive = !link.href.startsWith("#") && pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={resolved}
                    onClick={() => setOpen(false)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg ${
                      isActive
                        ? "text-ngpa-lime bg-ngpa-slate"
                        : "text-ngpa-white hover:bg-ngpa-slate"
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
                className="mt-2 mx-3 px-5 py-2.5 bg-ngpa-lime text-ngpa-black text-sm font-bold rounded-full text-center hover:bg-ngpa-cyan transition-colors"
              >
                Get Started
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
