// Cluster age bands resolve from a full birthDATE against a fixed Sept 1
// cutoff — pure string/integer math, no Date object, so it can't drift on
// Vercel's UTC build servers and a kid's band can't change mid-season when
// their birthday passes. (The drop-in flow's year-subtraction is ±1 at
// boundaries; clusters can't afford that at the U12/U14 line.)

export const SEASON_YEAR = 2026;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Age in whole years on Sept 1 of the season year, or null on bad input. */
export function ageAsOfSeptFirst(
  birthDateIso: string,
  seasonYear: number = SEASON_YEAR,
): number | null {
  const m = ISO_DATE_RE.exec(birthDateIso?.trim() ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > DAYS_IN_MONTH[month - 1]) return null;
  if (year < 1900 || year > seasonYear) return null;

  const hadBirthdayBySeptFirst = month < 9 || (month === 9 && day === 1);
  return seasonYear - year - (hadBirthdayBySeptFirst ? 0 : 1);
}

export type ClusterBand = "U12" | "U14";

/** U12 = 10–12, U14 = 13–14, as of Sept 1 of the season year. */
export function resolveClusterBand(
  birthDateIso: string,
  seasonYear: number = SEASON_YEAR,
): ClusterBand | null {
  const age = ageAsOfSeptFirst(birthDateIso, seasonYear);
  if (age === null) return null;
  if (age >= 10 && age <= 12) return "U12";
  if (age >= 13 && age <= 14) return "U14";
  return null;
}
