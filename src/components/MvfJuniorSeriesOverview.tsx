import Link from "next/link";
import {
  MVF_JUNIOR_SERIES,
  MVF_JUNIOR_SERIES_ENROLLMENT,
  MVF_JUNIOR_SERIES_SHORT_BRACKET,
  MVF_JUNIOR_SERIES_ELIGIBILITY,
  MVF_JUNIOR_SERIES_WEATHER_TERMS,
  MVF_JUNIOR_SERIES_CANCELLATION,
  mvfJuniorSeriesUrl,
} from "@/data/mvf-junior-series";

export default function MvfJuniorSeriesOverview() {
  const { divisions, prices } = MVF_JUNIOR_SERIES[0];
  return (
    <section aria-labelledby="series-overview-heading" className="px-5 sm:px-8 pt-16 pb-10 max-w-3xl mx-auto">
      <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">Montgomery Village, MD</p>
      <h1 id="series-overview-heading" className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">MVF Junior Tournaments</h1>
      <p role="status" className="mt-5 rounded-2xl border border-ngpa-teal/40 bg-ngpa-panel p-5 text-ngpa-white">
        Registration is not open yet. Check each month for its schedule, makeup arrangements and tournament policies.
      </p>
      <p className="text-ngpa-white/80 mt-4">{divisions.map(d => d.label).join(" and ")} · Maximum {divisions[0].capacity} players per bracket · ${prices.residentUsd} Montgomery Village resident / ${prices.nonresidentUsd} non-resident.</p>
      <ul className="space-y-4 mt-6">
        {MVF_JUNIOR_SERIES.map(event => (
          <li key={event.slug} className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel p-5">
            <h2 className="font-heading text-xl font-bold text-ngpa-white"><Link className="inline-flex min-h-[48px] items-center text-ngpa-teal-bright underline underline-offset-4" href={mvfJuniorSeriesUrl(event)}>{event.monthLabel} details and updates</Link></h2>
            <p className="text-ngpa-white mt-3">{event.dates.map(date => <time key={date.iso} dateTime={date.iso}>{date.label}</time>)}</p>
            <p className="text-ngpa-white/80 mt-2">{event.timeLabel} · {event.venue.name} · {event.venue.environmentLabel}</p>
            {event.weatherBackup && <p className="text-ngpa-white/80 text-base mt-3">Same-day weather backup at Lake Marion Community Center gymnasium, {event.weatherBackup.timeLabel}. No separate makeup date has been announced.</p>}
            {event.makeup && <p className="text-ngpa-white/80 text-base mt-3">Offered makeup: <time dateTime={event.makeup.date.iso}>{event.makeup.date.label}</time>, {event.makeup.timeLabel}. {event.makeup.venue.name}.</p>}
          </li>
        ))}
      </ul>
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
