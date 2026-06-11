import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import { fetchSessionById } from "@/lib/notion-sessions";
import { fillGoal } from "@/lib/fill-meter";
import FillMeter from "@/components/FillMeter";

export const metadata: Metadata = {
  title: "Drop-in Confirmed · Next Gen Pickleball Academy",
  description: "Your drop-in is reserved. See you on the court.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ cs?: string }>;
}

export default async function ScheduleSuccessPage({ searchParams }: PageProps) {
  const { cs } = await searchParams;

  let parentName = "";
  let childName = "";
  let sessionTitle = "";
  let sessionDate = "";
  let sessionStart = "";
  let location = "";
  let fill: { registered: number; goal: number } | null = null;

  if (cs && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const checkout = await stripe.checkout.sessions.retrieve(cs);
      const m = checkout.metadata ?? {};
      parentName = String(m.parent_name ?? "");
      childName = String(m.child_first_name ?? "");
      sessionTitle = String(m.session_title ?? "");
      sessionDate = String(m.session_date ?? "");
      sessionStart = String(m.session_start ?? "");
      location = String(m.session_location ?? "");

      const sessionId = String(m.session_id ?? "");
      if (sessionId) {
        const live = await fetchSessionById(sessionId);
        if (live) {
          // The webhook bumps the count in the background and may not have
          // landed yet — count this signup either way, never overstate.
          fill = {
            registered: Math.max(1, live.registeredCount),
            goal: fillGoal(live),
          };
        }
      }
    } catch (err) {
      console.error("[schedule/success] failed to load checkout", err);
    }
  }

  return (
    <section className="bg-ngpa-navy py-20 px-4 sm:px-6 lg:px-8 min-h-[60vh]">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ngpa-lime text-ngpa-black text-xs font-bold tracking-wider uppercase mb-4">
          <Image
            src="/images/pickleball-single.webp"
            alt=""
            width={16}
            height={16}
            className="inline-block"
          />
          Drop-in confirmed
        </div>

        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-ngpa-white">
          See you on the court
          {childName ? `, ${childName}` : ""}!
        </h1>

        {(sessionTitle || sessionDate) && (
          <div className="mt-8 bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-left">
            {sessionTitle && (
              <p className="text-base font-bold text-ngpa-white mb-2">
                {sessionTitle}
              </p>
            )}
            {sessionDate && (
              <p className="text-sm text-ngpa-muted">
                <span className="text-ngpa-white font-semibold">When: </span>
                {formatLongDate(sessionDate)}
                {sessionStart ? ` · ${sessionStart}` : ""}
              </p>
            )}
            {location && (
              <p className="text-sm text-ngpa-muted mt-1">
                <span className="text-ngpa-white font-semibold">Where: </span>
                {location}
              </p>
            )}
            {parentName && (
              <p className="text-sm text-ngpa-muted mt-1">
                <span className="text-ngpa-white font-semibold">Booked by: </span>
                {parentName}
              </p>
            )}
          </div>
        )}

        {fill && fill.goal > 0 && (
          <div className="mt-6 bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-lime mb-3">
              You moved the meter
            </p>
            <FillMeter registered={fill.registered} goal={fill.goal} size="lg" />
            <p className="mt-3 text-sm text-ngpa-muted leading-relaxed">
              Every signup gets this session closer to a full court — the best
              kind of session there is. Know a teammate who&rsquo;d love it?
              Send them to the{" "}
              <Link
                href="/schedule"
                className="text-ngpa-lime font-bold hover:underline"
              >
                schedule
              </Link>
              .
            </p>
          </div>
        )}

        <div className="mt-6 text-sm text-ngpa-muted leading-relaxed max-w-md mx-auto">
          <p>
            A confirmation email is on its way. If we cancel for weather, you
            get an automatic full refund; otherwise drop-in payments are
            non-refundable. Bring water, court shoes, and a paddle if you
            have one — we have loaners if you don&rsquo;t.
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-ngpa-lime text-ngpa-black font-bold hover:bg-ngpa-cyan transition-colors text-base"
          >
            Book another session
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full border-2 border-ngpa-slate text-ngpa-white font-bold hover:border-ngpa-lime hover:text-ngpa-lime transition-colors text-base"
          >
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
