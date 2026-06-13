import type { DayWeather, WeatherRisk } from "@/lib/weather";

interface WeatherBarProps {
  /** Ordered, unique upcoming session dates (YYYY-MM-DD). */
  dates: string[];
  weather: Map<string, DayWeather>;
}

const RISK_STYLES: Record<
  WeatherRisk,
  { label: string; icon: string; pill: string }
> = {
  proceed: {
    label: "Likely on",
    icon: "☀️",
    pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  },
  watch: {
    label: "Watching",
    icon: "⛅",
    pill: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  },
  cancel: {
    label: "Likely cancel",
    icon: "🌧️",
    pill: "bg-red-500/15 text-red-300 border-red-500/40",
  },
};

function formatDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function WeatherBar({ dates, weather }: WeatherBarProps) {
  if (dates.length === 0) return null;

  const anyCancelRisk = dates.some((d) => weather.get(d)?.risk === "cancel");

  return (
    <section
      aria-label="Weather watch for upcoming outdoor sessions"
      className="bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-slate/60 rounded-2xl p-6 mb-8"
    >
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-heading text-sm font-bold text-ngpa-teal uppercase tracking-[0.2em]">
          Weather Watch
        </h3>
      </div>

      <p className="text-sm text-ngpa-white/70 leading-relaxed mb-4">
        Our sessions are outdoors on Montgomery County courts. We track the
        forecast for every session date and cancel only when conditions make play
        unsafe.{" "}
        <strong className="text-ngpa-white">
          If we cancel a session for weather, you get an automatic full refund —
          no action needed.
        </strong>
      </p>

      {anyCancelRisk && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 leading-relaxed">
          <strong>High rain risk on one or more dates below.</strong> Those
          sessions may be cancelled — watch your email and texts. You&rsquo;ll be
          refunded in full if we call it off.
        </p>
      )}

      <ul className="divide-y divide-ngpa-slate/40">
        {dates.map((date) => {
          const w = weather.get(date);
          return (
            <li
              key={date}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span className="font-mono text-sm text-ngpa-white/90 shrink-0">
                {formatDate(date)}
              </span>

              {w ? (
                <span className="flex items-center gap-2 sm:gap-3 text-right min-w-0">
                  <span className="text-sm text-ngpa-white/70 truncate">
                    {w.maxRain}% rain
                    {w.tempHigh !== null ? ` · ${w.tempHigh}°F` : ""}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full border text-xs font-bold ${RISK_STYLES[w.risk].pill}`}
                  >
                    <span aria-hidden="true">{RISK_STYLES[w.risk].icon}</span>
                    {RISK_STYLES[w.risk].label}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-ngpa-white/40 italic">
                  Forecast updates ~6 days out
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
