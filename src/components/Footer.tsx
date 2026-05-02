"use client";

import Link from "next/link";
import { site } from "@/data/site";
import { familySiteUrl, familyMarketingRef, type FamilyDest } from "@/lib/urls";
import { trackEvent } from "@/lib/funnelClient";

type FamilyLink = { dest: FamilyDest; label: string; icon?: string };

const FAMILY_LINKS: FamilyLink[] = [
  { dest: "sammorrispb", label: "Private lessons with Sam" },
  { dest: "mocopb", label: "Find pickleball across MoCo" },
  { dest: "tournaments", label: "Tournament Series in MoCo" },
];

export default function Footer() {
  return (
    <footer className="bg-ngpa-black text-ngpa-muted">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
              Next Gen<span className="text-ngpa-lime">.</span>
            </h3>
            <p className="text-sm leading-relaxed">
              {site.boilerplate25}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="font-heading text-sm font-bold text-ngpa-white uppercase tracking-wider mb-3">
              Quick Links
            </h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#levels" className="hover:text-ngpa-lime transition-colors">Programs</a></li>
              <li><Link href="/schedule" className="hover:text-ngpa-lime transition-colors">Schedule & Register</Link></li>
              <li><a href="#contact-form" className="hover:text-ngpa-lime transition-colors">Get Started</a></li>
              <li><a href="#about" className="hover:text-ngpa-lime transition-colors">About Us</a></li>
              <li><a href="#faq" className="hover:text-ngpa-lime transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading text-sm font-bold text-ngpa-white uppercase tracking-wider mb-3">
              Get in Touch
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href={`mailto:${site.email}`} className="hover:text-ngpa-lime transition-colors">
                  {site.email}
                </a>
              </li>
              <li>
                <a href={`tel:${site.phone.replace(/\D/g, "")}`} className="hover:text-ngpa-lime transition-colors">
                  {site.phone}
                </a>
              </li>
              <li>
                <a
                  href={site.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ngpa-lime transition-colors"
                >
                  @nextgenpickleballacademy
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Family nav — cross-site reciprocal links */}
        <div className="mt-8 flex flex-col md:flex-row flex-wrap justify-center items-center gap-3">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-ngpa-slate rounded-full text-sm text-ngpa-white hover:border-ngpa-lime hover:text-ngpa-lime transition-colors"
              >
                {link.icon && <span aria-hidden="true">{link.icon}</span>}
                {link.label}
              </a>
            );
          })}
        </div>

        <div className="mt-10 pt-6 border-t border-ngpa-slate text-center text-xs text-ngpa-muted">
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
            className="hover:text-ngpa-lime transition-colors"
          >
            Built by Sam Morris
          </a>
        </div>
      </div>
    </footer>
  );
}
