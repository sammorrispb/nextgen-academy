import Link from "next/link";
import { requireCoach } from "@/lib/coach-auth-server";
import { redirect } from "next/navigation";
import JourneyPreview from "./JourneyPreview";
export const dynamic = "force-dynamic";
export default async function CoachJourneyPage() {
  if (!(await requireCoach())) redirect("/coach/login");
  return <>
    <Link href="/coach/ops" className="inline-flex min-h-12 items-center text-ngpa-teal hover:underline mb-5">Back to outreach ops</Link>
    <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-3">Review the next step</h1>
    <p className="text-base leading-relaxed text-ngpa-white/75 max-w-2xl mb-8">Choose one focus for the player’s next reps, then preview upcoming sessions against the recorded assessment. Scheduling choices apply to this preview only.</p>
    <JourneyPreview />
  </>;
}
