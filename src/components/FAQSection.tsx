"use client";

import { useState } from "react";
import { faq } from "@/data/faq";
import { site } from "@/data/site";

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="space-y-3">
        {faq.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i}>
              <button
                id={`faq-question-${i}`}
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${i}`}
                className={`w-full flex items-center justify-between gap-4 bg-ngpa-panel rounded-lg p-4 border transition-colors text-left ${
                  isOpen ? "border-ngpa-lime" : "border-ngpa-slate"
                }`}
              >
                <span className="text-ngpa-white font-heading font-semibold">
                  {item.question}
                </span>
                <span className="text-ngpa-lime text-xl shrink-0" aria-hidden="true">
                  {isOpen ? "\u2212" : "+"}
                </span>
              </button>
              <div
                id={`faq-answer-${i}`}
                role="region"
                aria-labelledby={`faq-question-${i}`}
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="text-ngpa-muted leading-relaxed px-4 pt-3 pb-4">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Still have questions? */}
      <div className="mt-8 text-center">
        <p className="text-ngpa-muted text-sm mb-3">Still have questions?</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`tel:${site.phone.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-2 text-ngpa-lime font-bold text-sm hover:text-ngpa-cyan transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Call or text {site.phone}
          </a>
          <span className="text-ngpa-slate hidden sm:inline">&middot;</span>
          <a
            href={`mailto:${site.email}`}
            className="inline-flex items-center gap-2 text-ngpa-lime font-bold text-sm hover:text-ngpa-cyan transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email us
          </a>
        </div>
      </div>
    </>
  );
}
