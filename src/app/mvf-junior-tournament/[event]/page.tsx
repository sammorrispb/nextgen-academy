import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import MvfSeriesRegistrationForm from "@/components/MvfSeriesRegistrationForm";
import { publicSeriesRelease, publishedSeriesRelease, type SeriesRelease } from "@/data/mvf-series-registration";
import JsonLd from "@/components/JsonLd";
import { mvfSeriesJsonLd } from "@/lib/mvf-series-jsonld";
import {
  MVF_JUNIOR_SERIES,
  findMvfJuniorSeriesEvent,
  mvfJuniorSeriesUrl,
  MVF_JUNIOR_SERIES_ENROLLMENT,
  MVF_JUNIOR_SERIES_SHORT_BRACKET,
  MVF_JUNIOR_SERIES_ELIGIBILITY,
  MVF_JUNIOR_SERIES_WEATHER_TERMS,
  MVF_JUNIOR_SERIES_CANCELLATION,
} from "@/data/mvf-junior-series";

type Props = { params: Promise<{ event: string }> };

// Vercel preview deployments only: a sample of the registration form so the
// layout can be reviewed before a real release exists. Placeholder policy text,
// and the register API still answers "registration_closed" because the sample
// is never an active release. Production never renders it.
function previewSampleRelease(event: NonNullable<ReturnType<typeof findMvfJuniorSeriesEvent>>): SeriesRelease | undefined {
  if (process.env.VERCEL_ENV !== "preview") return undefined;
  return {
    event: event.slug, revision: "preview-sample", date: event.dates[0].iso, startTime: "10:00 AM", endTime: "1:00 PM",
    registrationClosesAt: `${event.dates[0].iso}T00:00:00-05:00`,
    eligibility: { "12u": { minAge: 6, maxAge: 12 }, "16u": { minAge: 13, maxAge: 16 } }, multipleBrackets: false,
    eligibilityText: "Preview sample: eligibility text goes here.", minimumEnrollmentPolicy: MVF_JUNIOR_SERIES_ENROLLMENT,
    cancellationPolicy: "Preview sample: cancellation policy goes here.", rainPolicy: "Preview sample: weather policy goes here.",
    invoiceDueDays: 7, ngaRevenueShare: 0.8,
  };
}

export const dynamicParams = false;
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return MVF_JUNIOR_SERIES.map(({ slug }) => ({ event: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = findMvfJuniorSeriesEvent((await params).event);
  if (!event) notFound();
  const registration = process.env.VERCEL_ENV === "production" ? publicSeriesRelease(event.slug) : undefined;
  const published = process.env.VERCEL_ENV === "production" ? publishedSeriesRelease(event.slug) : undefined;
  return {
    robots: { index: false, follow: false },
    title: { absolute: `MVF Junior Tournament — ${event.monthLabel}` },
    description: registration ? `MVF Junior Tournament — ${event.monthLabel}. Parent registration and invoice payment for 12U and 16U.` : published ? `MVF Junior Tournament — ${event.monthLabel}. Registration is closed; event details remain available.` : `MVF junior pickleball: ${event.dates[0].label} at ${event.venue.name}. ${event.timeLabel}. Registration is not open yet; see the schedule and tournament policies.`,
    alternates: { canonical: mvfJuniorSeriesUrl(event) },
  };
}

export default async function MvfJuniorSeriesPage({ params }: Props) {
  const event = findMvfJuniorSeriesEvent((await params).event);
  if (!event) notFound();
  const registration = process.env.VERCEL_ENV === "production" ? publicSeriesRelease(event.slug) : undefined;
  const published = process.env.VERCEL_ENV === "production" ? publishedSeriesRelease(event.slug) : undefined;
  return (
    <article className="bg-ngpa-navy min-h-screen px-5 sm:px-8 pt-16 pb-20 max-w-3xl mx-auto">
      {published && <JsonLd data={{ ...mvfSeriesJsonLd(published), offers: registration ? mvfSeriesJsonLd(published).offers : undefined }} />}
      <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">
        Montgomery Village, MD · {event.monthLabel}
      </p>
      <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">
        MVF Junior Tournament
      </h1>
      {!registration && <section aria-labelledby="registration-heading" className="mt-6 rounded-2xl border border-ngpa-teal/40 bg-ngpa-panel p-6">
        <h2 id="registration-heading" className="font-heading text-xl font-bold text-ngpa-white">
          {published ? "Registration is closed." : "Registration is not open yet."}
        </h2>
        <p role="status" className="text-ngpa-white/80 mt-3">
          {published ? "The confirmed event details remain below. Existing invoice holders can use their private status link." : "Registration remains closed. Please check this page for opening updates."}
        </p>
      </section>}

      <section aria-labelledby="schedule-heading" className="mt-8 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel p-6">
        <h2 id="schedule-heading" className="font-heading text-xl font-bold text-ngpa-white">{published || event.scheduleConfirmed ? "Tournament schedule" : "Planned tournament schedule"}</h2>
        {!published && <p className="text-ngpa-white/80 mt-3">{event.scheduleNote}</p>}
        <p className="text-ngpa-white mt-3">
          {published ? <time dateTime={published.date}>{published.date}</time> : event.dates.map((date, index) => (
            <span key={date.iso}>{index > 0 && " or "}<time dateTime={date.iso}>{date.label}</time></span>
          ))}
        </p>
        <p className="text-ngpa-white/80 mt-2">{published ? `${published.startTime}–${published.endTime} ET` : event.timeLabel}</p>
        {!published && event.weatherBackup && <section aria-labelledby="weather-backup-heading" className="mt-5 border-t border-ngpa-slate/60 pt-4">
          <h3 id="weather-backup-heading" className="font-heading font-bold text-ngpa-white">Weather backup</h3>
          <p className="text-ngpa-white/80 mt-2">MVF has {event.weatherBackup.venue.name} gymnasium available on November 14, {event.weatherBackup.timeLabel}, as an indoor backup for bad weather.</p>
          <p className="text-ngpa-white/80 text-sm mt-2">{event.weatherBackup.venue.address}</p>
          <p className="text-ngpa-white/80 text-base mt-3">This backup is on the same day, at a later time than the outdoor tournament. No separate makeup date has been announced.</p>
        </section>}
        {!published && event.makeup && <section aria-labelledby="makeup-heading" className="mt-5 border-t border-ngpa-slate/60 pt-4">
          <h3 id="makeup-heading" className="font-heading font-bold text-ngpa-white">Offered makeup date</h3>
          <p className="text-ngpa-white mt-2"><time dateTime={event.makeup.date.iso}>{event.makeup.date.label}</time></p>
          <p className="text-ngpa-white/80 mt-2">{event.makeup.timeLabel}</p>
          <p className="text-ngpa-white/80 text-sm mt-2">Offered by MVF. The makeup venue is still to be confirmed.</p>
        </section>}
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
        <p className="text-ngpa-white/80 text-base mt-4">{published ? published.eligibilityText : MVF_JUNIOR_SERIES_ELIGIBILITY}</p>
        <p className="text-ngpa-white/80 text-base mt-3">{published ? published.minimumEnrollmentPolicy : MVF_JUNIOR_SERIES_ENROLLMENT}</p>
        {!published && <p className="text-ngpa-white/80 text-sm mt-2">{MVF_JUNIOR_SERIES_SHORT_BRACKET}</p>}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
        <section aria-labelledby="venue-heading" className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate/60">
          <h2 id="venue-heading" className="font-heading text-lg font-bold text-ngpa-white">Location</h2>
          <p className="text-ngpa-white mt-3">{event.venue.name}</p>
          <p className="text-ngpa-white/80 text-sm mt-2">{event.venue.address}</p>
          <p className="text-ngpa-teal-bright text-sm mt-2">{event.venue.environmentLabel}</p>
          {!event.venue.indoors && published && <p className="text-ngpa-white/80 text-base mt-3">{published.rainPolicy}</p>}
        </section>
        <section aria-labelledby="price-heading" className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate/60">
          <h2 id="price-heading" className="font-heading text-lg font-bold text-ngpa-white">Entry fee per player</h2>
          <p className="text-ngpa-white mt-3">${event.prices.residentUsd} Montgomery Village resident</p>
          <p className="text-ngpa-white/80 mt-2">${event.prices.nonresidentUsd} non-resident</p>
        </section>
      </div>

      {!published && <section aria-labelledby="policies-heading" className="mt-8 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel p-6">
        <h2 id="policies-heading" className="font-heading text-xl font-bold text-ngpa-white">Tournament policies</h2>
        <p className="text-ngpa-white/80 mt-3">{MVF_JUNIOR_SERIES_WEATHER_TERMS}</p>
        <p className="text-ngpa-white/80 mt-3">{MVF_JUNIOR_SERIES_CANCELLATION}</p>
      </section>}

      {registration && <section id="register" aria-labelledby="registration-heading" className="mt-10 scroll-mt-24">
        <h2 id="registration-heading" className="font-heading text-2xl font-black text-ngpa-white mb-5">
          Register — ${event.prices.residentUsd} resident / ${event.prices.nonresidentUsd} non-resident
        </h2>
        <p className="text-ngpa-white/70 mb-6">
          Fill this in and we&rsquo;ll email you an invoice — pay it online to lock your player&rsquo;s spot. Each division is capped at {event.divisions[0].capacity} players.
        </p>
        <MvfSeriesRegistrationForm release={registration} event={event} />
      </section>}

      {!registration && previewSampleRelease(event) && <section id="register" aria-labelledby="preview-registration-heading" className="mt-10 scroll-mt-24">
        <p role="note" className="mb-5 rounded-xl border border-ngpa-red/40 bg-ngpa-red/10 p-4 text-sm text-ngpa-white">
          Preview deployment only: a sample of the registration form with placeholder policies. It cannot submit, and production registration stays closed.
        </p>
        <h2 id="preview-registration-heading" className="font-heading text-2xl font-black text-ngpa-white mb-5">
          Register — ${event.prices.residentUsd} resident / ${event.prices.nonresidentUsd} non-resident
        </h2>
        <p className="text-ngpa-white/70 mb-6">
          Fill this in and we&rsquo;ll email you an invoice — pay it online to lock your player&rsquo;s spot. Each division is capped at {event.divisions[0].capacity} players.
        </p>
        <MvfSeriesRegistrationForm release={previewSampleRelease(event)!} event={event} />
      </section>}

      <section aria-labelledby="photos-heading" className="mt-10">
        <h2 id="photos-heading" className="font-heading text-2xl font-bold text-ngpa-white">Previous tournament photos</h2>
        <p className="text-ngpa-white/80 text-base mt-3">Photos from a previous outdoor tournament. See the location above for this event.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <Image
            src="/images/mvf/previous-tournament-medals.webp"
            alt="Junior pickleball participants with medals at a previous tournament"
            width={1200}
            height={1600}
            sizes="(min-width: 640px) 336px, calc(100vw - 40px)"
            className="w-full h-auto rounded-2xl border border-ngpa-slate/60"
          />
          <Image
            src="/images/mvf/previous-tournament-group.webp"
            alt="Junior pickleball participants together on outdoor courts at a previous tournament"
            width={1200}
            height={1600}
            sizes="(min-width: 640px) 336px, calc(100vw - 40px)"
            className="w-full h-auto rounded-2xl border border-ngpa-slate/60"
          />
        </div>
      </section>
    </article>
  );
}
