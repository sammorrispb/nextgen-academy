import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { faq } from "@/data/faq";
import JsonLd from "@/components/JsonLd";
import FAQSection from "@/components/FAQSection";
import CTABanner from "@/components/CTABanner";

export const metadata: Metadata = {
  title: seo.faq.title,
  description: seo.faq.description,
  alternates: { canonical: "/faq" },
};

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
      <JsonLd data={faqJsonLd} />
      <FAQSection headingAs="h1" />
      <CTABanner
        heading="Ready to Register?"
        description="Check the schedule, pick a session, and sign up — it takes two minutes."
        buttonText="View Schedule & Register"
        buttonHref="/schedule"
      />
    </>
  );
}
