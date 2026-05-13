import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { seasons } from "@/data/schedule";
import SectionHeading from "@/components/SectionHeading";
import CTABanner from "@/components/CTABanner";
import RegistrationNotice from "@/components/RegistrationNotice";
import ReserveButton from "@/components/ReserveButton";
import ShareButton from "@/components/ShareButton";
import SessionInfoBlock from "@/components/SessionInfoBlock";
import { fetchUpcomingSessions, type NgaSession } from "@/lib/notion-sessions";
import { findSessionBySlug } from "@/lib/session-slug";

export const revalidate = 300;

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";

const heroSeason = seasons[seasons.length - 1];

const LEVEL_COLOR: Record<string, string> = {
  Red: "bg-ngpa-skill-red text-white",
  Orange: "bg-ngpa-skill-orange text-white",
  Green: "bg-ngpa-skill-green text-white",
  Yellow: "bg-ngpa-skill-yellow text-ngpa-deep",
};

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function locationShortName(loc: string): string {
  return loc.split(",")[0].trim();
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sessions = await fetchUpcomingSessions();
  const session = findSessionBySlug(sessions, slug);

  if (!session) {
    return {
      title: "Session not found",
      robots: { index: false, follow: false },
    };
  }

  const url = `${SITE_ORIGIN}/schedule/${slug}`;
  const dayLabel = formatLongDate(session.date);
  const shortLoc = locationShortName(session.location);
  const title = `${session.title} · ${dayLabel} · NGA Drop-in`;
  const description = `$40 to reserve a 1-hour pickleball slot on ${dayLabel} at ${shortLoc}. ${session.spotsLeft}/${session.capacity} seats left.`;

  return {
    title,
    description,
    alternates: { canonical: `/schedule/${slug}` },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: [
        {
          url: `${SITE_ORIGIN}/images/youth-indoor-player.jpeg`,
          width: 1200,
          height: 630,
          alt: "Next Gen Pickleball Academy youth session",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SessionPage({ params }: PageProps) {
  const { slug } = await params;
  const sessions = await fetchUpcomingSessions();
  const session = findSessionBySlug(sessions, slug);

  if (!session) notFound();

  return (
    <>
      <h1 className="sr-only">{session.title} — Reserve</h1>

      {/* ─── Hero ─────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/youth-indoor-player.jpeg"
            alt=""
            fill
            priority
            className="object-cover object-center opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-photo-overlay" />
        </div>
        <div className="absolute inset-x-0 top-0 h-72 bg-teal-glow pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-20 sm:pb-24">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">
            One Session · Reserve Now
          </p>
          <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.05] tracking-tight max-w-3xl">
            {session.title}
          </h2>
          <p className="mt-5 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            {formatLongDate(session.date)} · {session.startTime}
            {session.endTime ? `–${session.endTime}` : ""} ·{" "}
            {locationShortName(session.location)}
          </p>

          <div className="mt-7 inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-teal/30">
            <span
              className="w-2 h-2 rounded-full bg-ngpa-teal animate-pulse"
              aria-hidden="true"
            />
            <span className="font-mono text-sm sm:text-base font-bold text-ngpa-white">
              {heroSeason.label}
            </span>
            <span className="text-ngpa-white/50" aria-hidden="true">
              |
            </span>
            <span className="text-sm sm:text-base text-ngpa-white/80">
              {heroSeason.dates}
            </span>
          </div>
        </div>
      </section>

      {/* ─── Single session detail ───────────── */}
      <section className="bg-ngpa-navy py-20 sm:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            eyebrow="Reserve a Slot"
            title="Lock in this session."
            subtitle="$40 for one 1-hour slot. Drop-in only — no subscription, no commitment. Each pickleball court is capped at 4 players."
          />

          <RegistrationNotice />

          <SessionDetailCard session={session} slug={slug} />

          <div className="mt-8 text-center">
            <Link
              href="/schedule"
              className="text-ngpa-teal hover:text-ngpa-teal-bright font-bold underline-offset-4 hover:underline transition-colors text-sm"
            >
              ← View all upcoming sessions
            </Link>
          </div>
        </div>
      </section>

      <CTABanner
        heading="Questions about registration?"
        description="Tell us about your child and we'll help you find the right group."
        buttonText="Get Started"
        buttonHref="/#contact-form"
        trackingSection="session_detail_cta_banner"
      />
    </>
  );
}

function SessionDetailCard({
  session,
  slug,
}: {
  session: NgaSession;
  slug: string;
}) {
  const levelClass =
    (session.level && LEVEL_COLOR[session.level]) ??
    "bg-ngpa-slate text-ngpa-white";

  const seatsText =
    session.status === "Cancelled"
      ? "Cancelled"
      : session.spotsLeft === 0
        ? "Full"
        : `${session.spotsLeft} / ${session.capacity} seats left`;

  const seatsClass =
    session.status === "Cancelled" || session.spotsLeft === 0
      ? "text-red-400"
      : session.spotsLeft <= 2
        ? "text-ngpa-skill-orange"
        : "text-ngpa-white/65";

  const shareUrl = `${SITE_ORIGIN}/schedule/${slug}`;
  const shareTitle = `${session.title} · ${session.startTime}`;
  const shareText = `Reserve a $40 drop-in slot at NGA — ${session.title}, ${formatLongDate(session.date)}`;

  return (
    <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-6 sm:p-8 transition-colors hover:border-ngpa-teal/40">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {session.level && (
          <span
            className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${levelClass}`}
          >
            {session.level} Ball
          </span>
        )}
        <span className={`text-xs font-bold ${seatsClass}`}>{seatsText}</span>
      </div>

      <p className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight mb-1">
        {session.title}
      </p>
      <p className="text-base font-bold text-ngpa-white">
        <time dateTime={session.date}>
          {formatLongDate(session.date)} · {session.startTime}
          {session.endTime ? `–${session.endTime}` : ""}
        </time>
      </p>
      <p className="text-sm text-ngpa-white/65 mt-1">{session.location}</p>

      <div className="mt-6 pt-6 border-t border-ngpa-slate/60">
        <SessionInfoBlock session={session} />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <ReserveButton session={session} />
        <ShareButton
          url={shareUrl}
          title={shareTitle}
          text={shareText}
          label="Share this session"
        />
      </div>
    </div>
  );
}
