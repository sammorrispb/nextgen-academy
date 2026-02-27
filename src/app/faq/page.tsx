import type { Metadata } from "next";
import { seo } from "@/data/seo";
import FAQSection from "@/components/FAQSection";

export const metadata: Metadata = {
  title: seo.faq.title,
  description: seo.faq.description,
};

export default function FaqPage() {
  return <FAQSection />;
}
