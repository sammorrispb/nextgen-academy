import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CampRegisterForm from "@/components/CampRegisterForm";
import {
  CAMPS,
  CAMP_OPTIONS,
  CAMP_AGE_MIN,
  CAMP_AGE_MAX,
  findCampBySlug,
} from "@/data/camps";

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return CAMPS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const camp = findCampBySlug(slug);
  if (!camp) return { title: "Camp not found · Next Gen Pickleball Academy" };
  return {
    title: `${camp.title} (${camp.weekLabel}) | Ages ${CAMP_AGE_MIN}–${CAMP_AGE_MAX} | Next Gen Pickleball Academy`,
    description: `Register for Next Gen Pickleball ${camp.title} — ${camp.weekLabel}, Mon–Thu mornings in Gaithersburg, MD. Ages ${CAMP_AGE_MIN}–${CAMP_AGE_MAX} — $50 a morning, or $150 for the full week.`,
    alternates: { canonical: `${SITE_ORIGIN}/camp/${camp.slug}` },
  };
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

export default async function CampWeekPage({ params }: PageProps) {
  const { slug } = await params;
  const camp = findCampBySlug(slug);
  if (!camp) notFound();

  return (
    <section className="bg-ngpa-navy py-14 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/camp"
          className="text-sm text-ngpa-muted hover:text-ngpa-teal-bright"
        >
          ← All camp weeks
        </Link>

        <div className="mt-4">
          <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ngpa-teal/15 text-ngpa-teal-bright text-xs font-bold tracking-wider uppercase mb-3">
            {camp.title.replace("Summer Camp — ", "Summer Camp · ")}
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-ngpa-white tracking-tight">
            {camp.weekLabel}
          </h1>
          <p className="mt-2 text-ngpa-muted">
            {formatLongDate(camp.startDate)} – {formatLongDate(camp.endDate)}{" "}
            (Mon–Thu) · Gaithersburg, MD · ages {CAMP_AGE_MIN}–{CAMP_AGE_MAX}
          </p>
        </div>

        {/* Quick facts */}
        <div className="mt-6 bg-ngpa-panel rounded-2xl border border-ngpa-slate p-5 text-sm">
          <ul className="space-y-1.5 text-ngpa-muted">
            {CAMP_OPTIONS.map((o) => (
              <li key={o.key}>
                <span className="text-ngpa-white font-semibold">
                  {o.label}:
                </span>{" "}
                {o.hours} — ${o.priceUsd}
                {o.key === "day" ? " a morning" : " for the week"}
              </li>
            ))}
            <li className="pt-1.5">
              <span className="text-ngpa-white font-semibold">Weather:</span>{" "}
              Rain or shine.
            </li>
            <li>
              <span className="text-ngpa-white font-semibold">Location:</span>{" "}
              Gaithersburg, MD — exact site shared with registered families
              before camp.
            </li>
          </ul>
        </div>

        <h2 className="font-heading text-xl font-bold text-ngpa-white mt-8 mb-3">
          Register
        </h2>
        <CampRegisterForm campSlug={camp.slug} />
      </div>
    </section>
  );
}
