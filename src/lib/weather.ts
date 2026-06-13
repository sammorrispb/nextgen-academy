// Rain forecast for NGA outdoor sessions, scoped to each session's ET hours.
// Sessions rotate across Montgomery County courts with no per-venue geocoding,
// so we pull ONE NWS hourly forecast for a county-centroid point (Rockville)
// and window it to each session's actual start/end time — a "will rain hit THIS
// session?" read, not a per-court microforecast and not a whole-day max. NWS's
// hourly horizon is ~6.5 days; sessions beyond that resolve to null and the
// surface shows "forecast not yet available".

import { sessionStartUtcMs, sessionEndUtcMs } from "./session-time";

const NWS_LAT = 39.084;
const NWS_LNG = -77.153;
const NWS_USER_AGENT = "Sam-NGA-Weather (sam.morris2131@gmail.com)";
// Forecasts move slowly relative to the 5-min schedule ISR — cache an hour.
const WEATHER_REVALIDATE = 3600;
// api.weather.gov is intermittently flaky (sporadic 5xx/timeouts); retry a few.
const NWS_MAX_ATTEMPTS = 3;
const HOUR_MS = 3_600_000;

export type WeatherRisk = "proceed" | "watch" | "cancel";

export interface DayWeather {
  date: string; // YYYY-MM-DD (America/New_York)
  maxRain: number; // 0–100, max probabilityOfPrecipitation across the window
  tempHigh: number | null; // °F, max temp across the window
  summary: string; // shortForecast for the window
  risk: WeatherRisk;
}

/** Weather for one assessed window, before a date is attached. */
export type WindowWeather = Omit<DayWeather, "date">;

function riskFromRain(maxRain: number): WeatherRisk {
  if (maxRain > 60) return "cancel";
  if (maxRain >= 40) return "watch";
  return "proceed";
}

export interface NwsPeriod {
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  probabilityOfPrecipitation?: { value: number | null };
  shortForecast: string;
}

async function nwsFetch(url: string): Promise<unknown | null> {
  for (let attempt = 1; attempt <= NWS_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" },
        next: { revalidate: WEATHER_REVALIDATE },
      });
      if (res.ok) return await res.json();
      console.error("[weather] NWS fetch failed", url, res.status, `attempt ${attempt}`);
    } catch (err) {
      console.error("[weather] NWS fetch threw", url, err, `attempt ${attempt}`);
    }
    if (attempt < NWS_MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
  return null;
}

/**
 * PURE. Aggregate the NWS hourly periods that overlap [startMs, endMs) into one
 * window verdict. A period [t, t+1h) overlaps when `t + 1h > startMs && t < endMs`
 * (half-open both ends). Returns null when NO period overlaps — distinct from an
 * overlap whose precip is unknown (→ maxRain 0 / proceed), so a day with no
 * forecast can never masquerade as a confident 0%.
 */
export function assessWindow(
  periods: NwsPeriod[],
  startMs: number,
  endMs: number,
): WindowWeather | null {
  const inWindow = periods.filter((p) => {
    const t = Date.parse(p.startTime);
    if (Number.isNaN(t)) return false;
    return t + HOUR_MS > startMs && t < endMs;
  });
  if (inWindow.length === 0) return null;

  const maxRain = Math.max(
    ...inWindow.map((p) => p.probabilityOfPrecipitation?.value ?? 0),
  );
  const temps = inWindow
    .map((p) => p.temperature)
    .filter((t): t is number => typeof t === "number");
  const tempHigh = temps.length > 0 ? Math.max(...temps) : null;
  const summary = inWindow.find((p) => p.shortForecast)?.shortForecast ?? "";

  let risk = riskFromRain(maxRain);
  // Lightning ends outdoor youth play regardless of the precip %.
  const thunder = inWindow.some((p) => /thunder/i.test(p.shortForecast ?? ""));
  if (thunder && risk === "proceed") risk = "watch";

  return { maxRain, tempHigh, summary, risk };
}

type SessionLike = { date: string; startTime: string; endTime: string };

/**
 * PURE. Window each session against the hourly periods, keyed by date. When two
 * sessions share a date (Early/Late split), keep the WORST (max-rain) window so
 * the date-level bar/newsletter note still answers "could rain cancel this day?".
 * Unparseable end time falls back to a 2-hour window from the start.
 */
export function assessSessions(
  periods: NwsPeriod[],
  sessions: SessionLike[],
): Map<string, DayWeather> {
  const out = new Map<string, DayWeather>();
  for (const s of sessions) {
    const startMs = sessionStartUtcMs(s.date, s.startTime);
    if (startMs == null) continue;
    const endMs = sessionEndUtcMs(s.date, s.endTime) ?? startMs + 2 * HOUR_MS;
    const w = assessWindow(periods, startMs, endMs);
    if (!w) continue;
    const prev = out.get(s.date);
    if (!prev || w.maxRain > prev.maxRain) {
      out.set(s.date, { date: s.date, ...w });
    }
  }
  return out;
}

async function fetchHourlyPeriods(): Promise<NwsPeriod[] | null> {
  const points = (await nwsFetch(
    `https://api.weather.gov/points/${NWS_LAT},${NWS_LNG}`,
  )) as { properties?: { forecastHourly?: string } } | null;
  const hourlyUrl = points?.properties?.forecastHourly;
  if (!hourlyUrl) return null;

  const forecast = (await nwsFetch(hourlyUrl)) as {
    properties?: { periods?: NwsPeriod[] };
  } | null;
  return forecast?.properties?.periods ?? null;
}

/**
 * Fetch the regional hourly forecast ONCE and window it to each session, keyed
 * by date. Two NWS calls regardless of session count. Fails soft: NWS down →
 * empty map (callers render "forecast pending"/absent); sessions beyond the
 * hourly horizon are simply absent.
 */
export async function fetchWeatherForSessions(
  sessions: SessionLike[],
): Promise<Map<string, DayWeather>> {
  if (sessions.length === 0) return new Map();
  const periods = await fetchHourlyPeriods();
  if (!periods) return new Map();
  return assessSessions(periods, sessions);
}
