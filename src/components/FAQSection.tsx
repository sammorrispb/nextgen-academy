"use client";

import { useState } from "react";
import { faq } from "@/data/faq";
import SectionHeading from "@/components/SectionHeading";

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <SectionHeading
          title="Frequently Asked Questions"
          subtitle="Everything families need to know"
        />

        <div className="space-y-3">
          {faq.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className={`w-full flex items-center justify-between gap-4 bg-ngpa-panel rounded-lg p-4 border transition-colors text-left ${
                    isOpen ? "border-ngpa-lime" : "border-ngpa-slate"
                  }`}
                >
                  <span className="text-ngpa-white font-heading font-semibold">
                    {item.question}
                  </span>
                  <span className="text-ngpa-lime text-xl shrink-0">
                    {isOpen ? "\u2212" : "+"}
                  </span>
                </button>
                <div
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
      </div>
    </section>
  );
}
