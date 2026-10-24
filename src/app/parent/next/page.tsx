import type { Metadata } from "next";
import ParentJourneyPreview from "./ParentJourneyPreview";
export const metadata: Metadata = { title: "Your next step | Next Gen", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function ParentNextPage() {
  return <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
    <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4">Preview your player’s next step</h1>
    <p className="text-base leading-relaxed text-ngpa-white/75 mb-8">Use the preview code your coach gave you to see a reviewed focus and check upcoming sessions. Your scheduling choices stay on this page and do not change the assessed ball level.</p>
    <ParentJourneyPreview />
  </main>;
}
