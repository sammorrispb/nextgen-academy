// Regional rain forecast for the /schedule weather bar. Sessions rotate across
// Montgomery County courts and there is no per-venue geocoding source, so we
// pull one NWS forecast for a county-centroid point (Rockville) and key it by
// date — the bar is a county-level "will rain cancel this?" alert, not a
// per-court microforecast. NWS's daily horizon is ~7 days; dates beyond that
// resolve to null and the bar shows "forecast not yet available".

const NWS_LAT = 39.084;
const NWS_LNG = -77.153;
const NWS_USER_AGENT = "Sam-NGA-Weather (sam.morris2131@gmail.com)";
// Forecasts move slowly relative to the 5-min schedule ISR — cache an hour.
const WEATHER_REVALIDATE = 3600;

export type WeatherRisk = "proceed" | "watch" | "cancel";

export interface DayWeather {
  date: string; // YYYY-MM-DD (America/New_York)
  maxRain: number; // 0–100, max probabilityOfPrecipitation that day
  tempHigh: number | null; // °F, daytime high
  summary: string; // shortForecast for the daytime period
  risk: WeatherRisk;
}

function riskFromRain(maxRain: number): WeatherRisk {
  if (maxRain > 60) return "cancel";
  if (maxRain >= 40) return "watch";
  return "proceed";
}

interface NwsPeriod {
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  probabilityOfPrecipitation?: { value: number | null };
  shortForecast: string;
}

async function nwsFetch(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" },
      next: { revalidate: WEATHER_REVALIDATE },
    });
    if (!res.ok) {
      console.error("[weather] NWS fetch failed", url, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[weather] NWS fetch threw", url, err);
    return null;
  }
}

/**
 * Fetch the regional daily forecast and return a date→DayWeather map covering
 * only the requested session dates that fall within the NWS horizon. Dates with
 * no forecast (too far out, or NWS unavailable) are simply absent from the map —
 * the caller renders "forecast not yet available" for those.
 */
export async function fetchWeatherByDate(
  dates: string[],
): Promise<Map<string, DayWeather>> {
  const out = new Map<string, DayWeather>();
  if (dates.length === 0) return out;

  const points = (await nwsFetch(
    `https://api.weather.gov/points/${NWS_LAT},${NWS_LNG}`,
  )) as { properties?: { forecast?: string } } | null;
  const forecastUrl = points?.properties?.forecast;
  if (!forecastUrl) return out;

  const forecast = (await nwsFetch(forecastUrl)) as {
    properties?: { periods?: NwsPeriod[] };
  } | null;
  const periods = forecast?.properties?.periods;
  if (!periods) return out;

  const wanted = new Set(dates);
  // startTime carries the ET offset (e.g. "2026-05-23T06:00:00-04:00"), so the
  // leading 10 chars are already the local calendar date.
  for (const p of periods) {
    const date = p.startTime.slice(0, 10);
    if (!wanted.has(date)) continue;

    const rain = p.probabilityOfPrecipitation?.value ?? 0;
    const existing = out.get(date);
    const maxRain = Math.max(existing?.maxRain ?? 0, rain);

    out.set(date, {
      date,
      maxRain,
      // Prefer the daytime period for high temp + summary; keep it if already set.
      tempHigh: p.isDaytime ? p.temperature : (existing?.tempHigh ?? null),
      summary: p.isDaytime ? p.shortForecast : (existing?.summary ?? p.shortForecast),
      risk: riskFromRain(maxRain),
    });
  }

  return out;
}
