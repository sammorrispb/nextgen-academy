import type { Metadata } from "next";
import YellowBallInquiryForm from "@/components/YellowBallInquiryForm";

export const metadata: Metadata = {
  title: "Yellow Ball Inquiry — Next Gen Pickleball Academy",
  description:
    "Request an evaluation for the Yellow Ball tournament track. For players 12+ rated 3.0 or above. A coach will reach out within 24 hours.",
};

export default function YellowBallInquiryPage() {
  return (
    <div className="bg-ngpa-navy min-h-screen py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-ngpa-skill-yellow/15 text-ngpa-skill-yellow mb-4 uppercase tracking-wider">
            Yellow Ball — Tournament Track
          </span>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-ngpa-white mb-4">
            Eval first. Play up from there.
          </h1>
          <p className="text-ngpa-muted text-lg leading-relaxed">
            Yellow Ball is our coach-curated competitive track for players 12+
            rated 3.0 or above. Small groups of 3&ndash;5 athletes, custom
            scheduling, focused tournament prep. Tell us about your player and
            we&rsquo;ll set up the eval.
          </p>
        </div>

        <YellowBallInquiryForm />
      </div>
    </div>
  );
}
