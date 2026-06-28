import type { Metadata } from "next";
import Link from "next/link";
import {
  WAIVER_UPDATED,
  WAIVER_INTRO,
  WAIVER_SECTIONS,
  WAIVER_CONTACT_EMAIL,
  WAIVER_CONTACT_PHONE,
} from "@/data/waiver";

export const metadata: Metadata = {
  title: "Liability Waiver & Media Release · Next Gen Pickleball Academy",
  description:
    "Next Gen Pickleball Academy liability waiver, assumption of risk, medical authorization, and photo/media release for youth programs.",
  robots: { index: false, follow: false },
};

function Section({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <section className="mt-7">
      <h2 className="font-heading text-lg font-bold text-ngpa-white">
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ngpa-muted">
        <p>{body}</p>
      </div>
    </section>
  );
}

export default function WaiverPage() {
  return (
    <section className="bg-ngpa-navy py-14 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal-bright">
          Next Gen Pickleball Academy
        </p>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-ngpa-white mt-1 tracking-tight">
          Liability Waiver, Assumption of Risk &amp; Media Release
        </h1>
        <p className="mt-2 text-xs text-ngpa-muted">Last updated: {WAIVER_UPDATED}</p>

        <p className="mt-5 text-sm leading-relaxed text-ngpa-muted">{WAIVER_INTRO}</p>

        {WAIVER_SECTIONS.map((s) => (
          <Section key={s.n} n={s.n} title={s.title} body={s.body} />
        ))}

        <div className="mt-9 rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/60 p-5">
          <p className="text-sm leading-relaxed text-ngpa-white">
            Sign once and you&rsquo;re set for every NGA program. We&rsquo;ll
            email you a copy for your records.
          </p>
          <Link
            href="/waiver/sign"
            className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-full bg-ngpa-lime text-ngpa-deep font-bold hover:brightness-110 transition-all min-h-[48px]"
          >
            Sign the waiver →
          </Link>
        </div>

        <p className="mt-6 text-xs text-ngpa-muted/70">
          Questions? Email {WAIVER_CONTACT_EMAIL} or text Coach Sam at{" "}
          {WAIVER_CONTACT_PHONE}.
        </p>

        <div className="mt-8">
          <Link
            href="/camp"
            className="text-sm text-ngpa-teal-bright font-semibold hover:underline"
          >
            ← Back to camp
          </Link>
        </div>
      </div>
    </section>
  );
}
