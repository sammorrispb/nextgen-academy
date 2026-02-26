import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { site } from "@/data/site";
import { locations } from "@/data/locations";
import SectionHeading from "@/components/SectionHeading";
import LocationMap from "@/components/LocationMap";

export const metadata: Metadata = {
  title: seo.contact.title,
  description: seo.contact.description,
};

export default function ContactPage() {
  return (
    <>
      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Get in Touch"
            subtitle="Questions about our programs? Want to schedule a free evaluation? We'd love to hear from you."
          />

          {/* Contact methods */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
            {/* Email */}
            <a
              href={`mailto:${site.email}`}
              className="bg-ngpa-panel rounded-xl p-6 border border-ngpa-slate hover:border-ngpa-lime transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-ngpa-slate flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-ngpa-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="font-heading font-bold text-ngpa-white mb-1">Email</div>
              <div className="text-sm text-ngpa-muted group-hover:text-ngpa-lime transition-colors">
                {site.email}
              </div>
            </a>

            {/* Instagram */}
            <a
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-ngpa-panel rounded-xl p-6 border border-ngpa-slate hover:border-ngpa-lime transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-ngpa-slate flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-ngpa-lime" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </div>
              <div className="font-heading font-bold text-ngpa-white mb-1">Instagram</div>
              <div className="text-sm text-ngpa-muted group-hover:text-ngpa-lime transition-colors">
                @nextgenpbacademy
              </div>
            </a>

            {/* Evaluation */}
            <a
              href={`mailto:${site.email}?subject=Free%20Evaluation%20Request`}
              className="bg-ngpa-panel rounded-xl p-6 border border-ngpa-lime hover:border-ngpa-cyan transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-ngpa-lime flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-ngpa-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="font-heading font-bold text-ngpa-white mb-1">Free Evaluation</div>
              <div className="text-sm text-ngpa-muted">
                Email to schedule a 30-minute assessment
              </div>
            </a>
          </div>

          {/* Locations */}
          <SectionHeading title="Our Locations" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {locations.map((loc) => (
              <LocationMap key={loc.name} location={loc} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
