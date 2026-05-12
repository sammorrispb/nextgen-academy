"use client";

import Link from "next/link";
import Image from "next/image";
import { site } from "@/data/site";
import { familySiteUrl, familyMarketingRef, type FamilyDest } from "@/lib/urls";
import { trackEvent } from "@/lib/funnelClient";

type FamilyLink = { dest: FamilyDest; label: string; icon?: string };

const FAMILY_LINKS: FamilyLink[] = [
  { dest: "sammorrispb", label: "Adult lessons with Coach Sam" },
  { dest: "mocopb", label: "Find pickleball across MoCo" },
];

export default function Footer() {
  return (
    <footer className="relative isolate overflow-hidden bg-ngpa-deep text-ngpa-white/70 border-t border-ngpa-slate/40">
      {/* Subtle teal accent line */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ngpa-teal/40 to-transparent"
      />

      {/* Paddle ghost accent — desktop only, inverted so white product bg blends into dark footer */}
      <div
        aria-hidden="true"
        className="hidden lg:block absolute top-10 right-10 w-32 h-44 opacity-[0.08] -rotate-[18deg] pointer-events-none invert"
      >
        <Image
          src="/images/paddle-product-front.webp"
          alt=""
          fill
          sizes="128px"
          className="object-contain"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand */}
          <div className="md:col-span-5">
            <Image
              src="/images/logo.png"
              alt="Next Gen Pickleball Academy"
              width={160}
              height={46}
              className="h-10 w-auto mb-5"
            />
            <p className="text-base text-ngpa-white/65 leading-relaxed max-w-md">
              {site.boilerplate25}
            </p>
            <a
              href="#contact-form"
              className="mt-6 inline-flex items-center gap-2 text-ngpa-teal hover:text-ngpa-teal-bright font-bold text-sm transition-colors"
            >
              Book a free evaluation
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {/* Quick links */}
          <div className="md:col-span-3">
            <h4 className="font-heading text-xs font-bold text-ngpa-white uppercase tracking-[0.2em] mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#levels" className="hover:text-ngpa-teal transition-colors">Programs</a></li>
              <li><Link href="/schedule" className="hover:text-ngpa-teal transition-colors">Schedule &amp; Register</Link></li>
              <li><a href="#contact-form" className="hover:text-ngpa-teal transition-colors">Get Started</a></li>
              <li><a href="#about" className="hover:text-ngpa-teal transition-colors">About Us</a></li>
              <li><a href="#faq" className="hover:text-ngpa-teal transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-4">
            <h4 className="font-heading text-xs font-bold text-ngpa-white uppercase tracking-[0.2em] mb-4">
              Get in Touch
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="inline-flex items-center gap-2 hover:text-ngpa-teal transition-colors"
                >
                  <svg className="w-4 h-4 text-ngpa-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {site.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${site.phone.replace(/\D/g, "")}`}
                  className="inline-flex items-center gap-2 hover:text-ngpa-teal transition-colors"
                >
                  <svg className="w-4 h-4 text-ngpa-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  {site.phone}
                </a>
              </li>
              <li>
                <a
                  href={site.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-ngpa-teal transition-colors"
                >
                  <svg className="w-4 h-4 text-ngpa-teal" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                  @nextgenpickleballacademy
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* For Schools & Organizations */}
        <div className="mt-12 pt-8 border-t border-ngpa-slate/40">
          <h4 className="font-heading text-xs font-bold text-ngpa-white uppercase tracking-[0.2em] mb-4 text-center">
            For Schools &amp; Organizations
          </h4>
          <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-3">
            <Link
              href="/schools"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-ngpa-slate/60 rounded-full text-sm text-ngpa-white/85 hover:border-ngpa-teal/60 hover:text-ngpa-teal transition-colors"
            >
              Programs for schools &amp; camps
            </Link>
            <Link
              href="/yellowball/inquiry"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-ngpa-slate/60 rounded-full text-sm text-ngpa-white/85 hover:border-ngpa-teal/60 hover:text-ngpa-teal transition-colors"
            >
              Yellow Ball inquiry (invite-only)
            </Link>
          </div>
        </div>

        {/* Family nav */}
        <div className="mt-10 pt-8 border-t border-ngpa-slate/40">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-white/50 text-center mb-5">
            Part of the Sam Morris pickleball family
          </p>
          <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-3">
            {FAMILY_LINKS.map((link) => {
              const href = familySiteUrl(link.dest);
              return (
                <a
                  key={link.dest}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackEvent(
                      "external_link",
                      { label: `family_${link.dest}`, url: href, page: "footer" },
                      familyMarketingRef(link.dest),
                    )
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-ngpa-slate/60 rounded-full text-sm text-ngpa-white/85 hover:border-ngpa-teal/60 hover:text-ngpa-teal transition-colors"
                >
                  {link.icon && <span aria-hidden="true">{link.icon}</span>}
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-ngpa-slate/40 text-center">
          <p className="font-heading text-sm sm:text-base font-bold text-ngpa-white tracking-tight">
            Built by parents, for parents.
          </p>
          <p className="mt-1.5 text-xs sm:text-sm text-ngpa-white/65 max-w-xl mx-auto">
            Sam and Amine are dads first. The coach you meet on the court is the
            one who built this program.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-ngpa-slate/30 text-center text-xs text-ngpa-white/55">
          &copy; {new Date().getFullYear()} Next Gen Pickleball Academy. All rights reserved.
          <span className="mx-1.5">&middot;</span>
          <a
            href={familySiteUrl("sammorrispb")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              const href = familySiteUrl("sammorrispb");
              trackEvent(
                "external_link",
                { label: "built_by_sam_morris", url: href, page: "footer" },
                familyMarketingRef("sammorrispb"),
              );
            }}
            className="hover:text-ngpa-teal transition-colors"
          >
            Built by Sam Morris
          </a>
        </div>
      </div>
    </footer>
  );
}
