import Link from "next/link";
import ConfirmEvalForm from "./ConfirmEvalForm";

export const dynamic = "force-dynamic";

export default function ConfirmEvalPage() {
  return (
    <>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Free evaluation
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Confirm an eval
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-8 max-w-2xl">
        Booked a free evaluation? Send the parent the branded confirmation with a
        calendar invite attached. This also stamps the Eval Date on their CRM row.
        Preview the copy first, then send.
      </p>

      <ConfirmEvalForm />

      <p className="mt-8 text-sm text-ngpa-white/55">
        <Link href="/coach" className="hover:text-ngpa-teal transition-colors">
          ← Back to dashboard
        </Link>
      </p>
    </>
  );
}
