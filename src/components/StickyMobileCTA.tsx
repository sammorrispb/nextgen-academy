"use client";

import { site } from "@/data/site";

export default function StickyMobileCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-ngpa-black/95 backdrop-blur border-t border-ngpa-slate px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3 max-w-lg mx-auto">
        <a
          href="#contact-form"
          className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-ngpa-lime text-ngpa-black font-heading font-bold text-sm rounded-full hover:bg-ngpa-cyan transition-colors min-h-[48px]"
        >
          Get Started
        </a>
        <a
          href={`tel:${site.phone.replace(/\D/g, "")}`}
          className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-ngpa-lime text-ngpa-lime hover:bg-ngpa-lime hover:text-ngpa-black transition-colors shrink-0"
          aria-label="Call us"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}
