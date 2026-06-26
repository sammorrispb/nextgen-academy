import Link from "next/link";
import { CAMPS } from "@/data/camps";

export const dynamic = "force-dynamic";

export default function CoachCampsPage() {
  return (
    <>
      <Link
        href="/coach"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← All sessions
      </Link>

      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Camps
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Camp rosters
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-8 max-w-2xl">
        Day-of rosters with allergies, emergency contacts, and attending days —
        read live from Stripe. Tap a camp to view and print.
      </p>

      <div className="space-y-3">
        {CAMPS.map((camp) => (
          <Link
            key={camp.slug}
            href={`/coach/camps/${camp.slug}`}
            className="block bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 px-5 py-5 sm:px-6 hover:border-ngpa-teal/60 transition-colors"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal mb-1">
              {camp.weekLabel}
            </p>
            <p className="font-heading text-lg font-black text-ngpa-white tracking-tight">
              {camp.title}
            </p>
            <p className="text-sm text-ngpa-white/65 mt-0.5">
              {camp.publicArea}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
