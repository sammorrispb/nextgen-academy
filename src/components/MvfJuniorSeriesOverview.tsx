import Link from "next/link";
import MvfSeriesFormatRules from "@/components/MvfSeriesFormatRules";
import {
  MVF_JUNIOR_SERIES,
  MVF_JUNIOR_SERIES_ENROLLMENT,
  MVF_JUNIOR_SERIES_SHORT_BRACKET,
  MVF_JUNIOR_SERIES_ELIGIBILITY,
  MVF_JUNIOR_SERIES_WEATHER_TERMS,
  MVF_JUNIOR_SERIES_CANCELLATION,
  mvfJuniorSeriesUrl,
} from "@/data/mvf-junior-series";

export default function MvfJuniorSeriesOverview({ todayEt, openEvents }: { todayEt: string; openEvents: readonly string[] }) {
  const { divisions, prices } = MVF_JUNIOR_SERIES[0];
  const upcomingEvents = MVF_JUNIOR_SERIES.filter(event => event.dates[0].iso >= todayEt);
  const featuredEvent = upcomingEvents.find(event => openEvents.includes(event.slug));

  return (
    <section aria-labelledby="series-overview-heading" className="px-5 sm:px-8 pt-16 pb-10 max-w-3xl mx-auto">
      <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">Montgomery Village, MD</p>
      <h1 id="series-overview-heading" className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">MVF Junior Tournaments</h1>
      {!featuredEvent && (
        <p role="status" className="mt-5 rounded-2xl border border-ngpa-teal/40 bg-ngpa-panel p-5 text-ngpa-white">
          {upcomingEvents.length
            ? "Registration is not open yet. Check each event for its schedule and policies."
            : "There are no upcoming tournaments scheduled."}
        </p>
      )}
      {upcomingEvents.length > 0 && (
        <>
          <p className="text-ngpa-white/80 mt-4">{divisions.map(d => d.label).join(" and ")} · Maximum {divisions[0].capacity} players per bracket · ${prices.residentUsd} Montgomery Village resident / ${prices.nonresidentUsd} non-resident.</p>
          <ul className="space-y-4 mt-6">
            {upcomingEvents.map(event => {
              const isFeatured = event === featuredEvent;
              const eventUrl = mvfJuniorSeriesUrl(event);
              return (
                <li key={event.slug} className={`rounded-2xl border bg-ngpa-panel p-5 ${isFeatured ? "border-ngpa-teal/70" : "border-ngpa-slate/60"}`}>
                  <h2 className="font-heading text-xl font-bold text-ngpa-white">
                    {isFeatured ? `${event.monthLabel} registration is open` : (
                      <Link className="inline-flex min-h-[48px] items-center text-ngpa-teal-bright underline underline-offset-4" href={eventUrl}>
                        {openEvents.includes(event.slug) ? `Register for ${event.monthLabel}` : `${event.monthLabel} details and updates`}
                      </Link>
                    )}
                  </h2>
                  <p className="text-ngpa-white mt-3">{event.dates.map(date => <time key={date.iso} dateTime={date.iso}>{date.label}</time>)}</p>
                  <p className="text-ngpa-white/80 mt-2">{event.timeLabel} · {event.venue.name} · {event.venue.environmentLabel}</p>
                  {isFeatured && (
                    <Link
                      href={`/mvf-junior-tournament/${event.slug}#register`}
                      className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-ngpa-teal px-6 py-3 text-center font-heading font-bold text-ngpa-deep transition-colors hover:bg-ngpa-teal-bright focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ngpa-teal-bright sm:w-auto"
                    >
                      Register for {event.monthLabel}
                    </Link>
                  )}
                  {event.weatherBackup && <p className="text-ngpa-white/80 text-base mt-3">Same-day weather backup at Lake Marion Community Center gymnasium, {event.weatherBackup.timeLabel}. No separate makeup date has been announced.</p>}
                  {event.makeup && <p className="text-ngpa-white/80 text-base mt-3">Offered makeup: <time dateTime={event.makeup.date.iso}>{event.makeup.date.label}</time>, {event.makeup.timeLabel}. {event.makeup.venue.name}.</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <MvfSeriesFormatRules />
      <section aria-labelledby="series-policies-heading" className="mt-8 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel p-5">
        <h2 id="series-policies-heading" className="font-heading text-xl font-bold text-ngpa-white">Tournament policies</h2>
        <p className="text-ngpa-white/80 mt-4">{MVF_JUNIOR_SERIES_ELIGIBILITY}</p>
        <p className="text-ngpa-white/80 mt-3">{MVF_JUNIOR_SERIES_ENROLLMENT}</p>
        <p className="text-ngpa-white/80 mt-3">{MVF_JUNIOR_SERIES_SHORT_BRACKET}</p>
        <p className="text-ngpa-white/80 mt-3">{MVF_JUNIOR_SERIES_WEATHER_TERMS}</p>
        <p className="text-ngpa-white/80 mt-3">{MVF_JUNIOR_SERIES_CANCELLATION}</p>
      </section>
    </section>
  );
}
