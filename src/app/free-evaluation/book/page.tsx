import type { Metadata } from "next";
import Link from "next/link";
import EvaluationSchedulingCard from "@/components/EvaluationSchedulingCard";

export const metadata: Metadata = {
  title: "Text to Schedule a Free Evaluation",
  description: "Text Coach Sam at 301-325-4731 to arrange a free 30-minute pickleball evaluation for your child, ages 6–16.",
  alternates: { canonical: "/free-evaluation" },
};

// Keep old email links useful without fetching or advertising self-book slots.
export default function EvalBookPage() {
  return (
    <section className="bg-ngpa-deep min-h-[65vh] px-4 sm:px-6 py-14 sm:py-20">
      <div className="max-w-xl mx-auto">
        <p className="text-ngpa-teal font-bold mb-3">Free evaluation</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-8">
          Your first step onto the court.
        </h1>
        <EvaluationSchedulingCard />
        <Link href="/free-evaluation" className="mt-6 inline-flex min-h-[48px] items-center text-ngpa-teal hover:text-ngpa-teal-bright font-semibold">
          What happens at an evaluation &rarr;
        </Link>
      </div>
    </section>
  );
}
