import Link from "next/link";
import { site } from "@/data/site";

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
              <li><Link href="/programs" className="hover:text-ngpa-lime transition-colors">Programs</Link></li>
              <li><Link href="/schedule" className="hover:text-ngpa-lime transition-colors">Schedule & Register</Link></li>
              <li><Link href="/about" className="hover:text-ngpa-lime transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-ngpa-lime transition-colors">Contact</Link></li>
              <li><Link href="/faq" className="hover:text-ngpa-lime transition-colors">FAQ</Link></li>
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

        <div className="mt-10 pt-6 border-t border-ngpa-slate text-center text-xs text-ngpa-muted">
          &copy; {new Date().getFullYear()} Next Gen Pickleball Academy. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
