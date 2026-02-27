"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/programs", label: "Programs" },
  { href: "/schedule", label: "Schedule" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  pathname === link.href
                    ? "text-ngpa-lime bg-ngpa-slate"
                    : "text-ngpa-white hover:text-ngpa-lime hover:bg-ngpa-slate"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/schedule"
              className="ml-3 px-5 py-2 bg-ngpa-lime text-ngpa-black text-sm font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
            >
              Register
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 text-ngpa-white hover:text-ngpa-lime"
            aria-label="Toggle menu"
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
          <div className="md:hidden pb-4 border-t border-ngpa-slate">
            <div className="flex flex-col gap-1 pt-3">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg ${
                    pathname === link.href
                      ? "text-ngpa-lime bg-ngpa-slate"
                      : "text-ngpa-white hover:bg-ngpa-slate"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/schedule"
                onClick={() => setOpen(false)}
                className="mt-2 mx-3 px-5 py-2.5 bg-ngpa-lime text-ngpa-black text-sm font-bold rounded-full text-center hover:bg-ngpa-cyan transition-colors"
              >
                Register
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
