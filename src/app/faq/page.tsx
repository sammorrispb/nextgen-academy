import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { faq } from "@/data/faq";
import FAQSection from "@/components/FAQSection";

export const metadata: Metadata = {
  title: seo.faq.title,
  description: seo.faq.description,
};

// Generated from hardcoded src/data/faq.ts — no user input, safe to render as raw JSON
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <FAQSection />
    </>
  );
}
