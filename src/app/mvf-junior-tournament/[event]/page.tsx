import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MVF_JUNIOR_SERIES,
  findMvfJuniorSeriesEvent,
  mvfJuniorSeriesUrl,
} from "@/data/mvf-junior-series";

type Props = { params: Promise<{ event: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return MVF_JUNIOR_SERIES.map(({ slug }) => ({ event: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = findMvfJuniorSeriesEvent((await params).event);
  if (!event) notFound();
  return {
    robots: { index: false, follow: false },
    title: { absolute: `MVF Junior Tournament — ${event.monthLabel}` },
    description: `Junior pickleball in Montgomery Village, ${event.monthLabel}. Registration is not open yet; date and time are being confirmed.`,
    alternates: { canonical: mvfJuniorSeriesUrl(event) },
  };
}

export default async function MvfJuniorSeriesPage({ params }: Props) {
  const event = findMvfJuniorSeriesEvent((await params).event);
  if (!event) notFound();
  return (
    <article className="bg-ngpa-navy min-h-screen px-5 sm:px-8 pt-16 pb-20 max-w-3xl mx-auto">
      <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">
        Montgomery Village, MD · {event.monthLabel}
      </p>
      <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">
        MVF Junior Tournament
      </h1>
      <section aria-labelledby="registration-heading" className="mt-6 rounded-2xl border border-ngpa-teal/40 bg-ngpa-panel p-6">
        <h2 id="registration-heading" className="font-heading text-xl font-bold text-ngpa-white">
          Registration is not open yet.
        </h2>
        <p role="status" className="text-ngpa-white/80 mt-3">
          Date and time to be confirmed. Please check this page again for the confirmed schedule and registration details.
        </p>
      </section>

      <section aria-labelledby="schedule-heading" className="mt-8 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel p-6">
        <h2 id="schedule-heading" className="font-heading text-xl font-bold text-ngpa-white">Tentative schedule</h2>
        <p className="text-ngpa-white/80 mt-3">Proposed dates and times may change.</p>
        <p className="text-ngpa-white mt-3">
          {event.proposedDates.map((date, index) => (
            <span key={date.iso}>{index > 0 && " or "}<time dateTime={date.iso}>{date.label}</time></span>
          ))}
        </p>
        <p className="text-ngpa-white/80 mt-2">{event.proposedTime ?? "Time to be confirmed"}</p>
      </section>

      <section aria-labelledby="brackets-heading" className="mt-10">
        <h2 id="brackets-heading" className="font-heading text-2xl font-bold text-ngpa-white">Junior brackets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {event.divisions.map((division) => (
            <div key={division.slug} className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate/60">
              <h3 className="font-heading text-xl font-bold text-ngpa-white">{division.label}</h3>
              <p className="text-ngpa-white/80 text-sm mt-2">{division.ageLabel}</p>
              <p className="text-ngpa-white/80 text-sm mt-2">Maximum {division.capacity} players per bracket</p>
            </div>
          ))}
        </div>
        <p className="text-ngpa-white/80 text-sm mt-4">The age cutoff and bracket eligibility will be confirmed before registration opens.</p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
        <section aria-labelledby="venue-heading" className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate/60">
          <h2 id="venue-heading" className="font-heading text-lg font-bold text-ngpa-white">Location</h2>
          <p className="text-ngpa-white mt-3">{event.venue.name}</p>
          <p className="text-ngpa-white/80 text-sm mt-2">{event.venue.address}</p>
          <p className="text-ngpa-teal-bright text-sm mt-2">{event.venue.environmentLabel}</p>
          {!event.venue.indoors && <p className="text-ngpa-white/80 text-sm mt-3">November rain plan: to be confirmed.</p>}
        </section>
        <section aria-labelledby="price-heading" className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate/60">
          <h2 id="price-heading" className="font-heading text-lg font-bold text-ngpa-white">Entry fee per player</h2>
          <p className="text-ngpa-white mt-3">${event.prices.residentUsd} Montgomery Village resident</p>
          <p className="text-ngpa-white/80 mt-2">${event.prices.nonresidentUsd} non-resident</p>
        </section>
      </div>
    </article>
  );
}
