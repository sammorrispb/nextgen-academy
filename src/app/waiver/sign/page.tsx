import type { Metadata } from "next";
import Link from "next/link";
import WaiverSignForm from "@/components/WaiverSignForm";
import {
  WAIVER_UPDATED,
  WAIVER_INTRO,
  WAIVER_SECTIONS,
  WAIVER_CONTACT_EMAIL,
  WAIVER_CONTACT_PHONE,
} from "@/data/waiver";

export const metadata: Metadata = {
  title: "Sign the Waiver · Next Gen Pickleball Academy",
  description:
    "Sign the Next Gen Pickleball Academy liability waiver and media release once — it covers your child for every program.",
  robots: { index: false, follow: false },
};

export default function WaiverSignPage() {
  return (
    <section className="bg-ngpa-navy py-14 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal-bright">
          Next Gen Pickleball Academy
        </p>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-ngpa-white mt-1 tracking-tight">
          Sign your one-time waiver
        </h1>
        <p className="mt-2 text-xs text-ngpa-muted">Last updated: {WAIVER_UPDATED}</p>

        <p className="mt-5 text-sm leading-relaxed text-ngpa-muted">{WAIVER_INTRO}</p>

        <div className="mt-7 space-y-5 rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-5 max-h-80 overflow-y-auto">
          {WAIVER_SECTIONS.map((s) => (
            <div key={s.n}>
              <h2 className="font-heading text-sm font-bold text-ngpa-white">
                {s.n}. {s.title}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ngpa-muted">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <WaiverSignForm />
        </div>

        <p className="mt-6 text-xs text-ngpa-muted/70">
          Questions? Email {WAIVER_CONTACT_EMAIL} or text Coach Sam at{" "}
          {WAIVER_CONTACT_PHONE}.
        </p>

        <div className="mt-6">
          <Link
            href="/waiver"
            className="text-sm text-ngpa-teal-bright font-semibold hover:underline"
          >
            ← Read the full waiver
          </Link>
        </div>
      </div>
    </section>
  );
}
