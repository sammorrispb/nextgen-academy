import { sessionStartUtcMs } from "./session-time";

export type BannerTiming = { eventEndsAt: number | null; registrationClosesAt: number | null };
export type BannerState = "past" | "open" | "closed";

function isCalendarDate(value: string): boolean {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN;
  return Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === value;
}

export function tournamentBannerTiming(eventIso: string, deadline?: string): BannerTiming {
  // 23:59 is unambiguous even on Eastern daylight-saving transition days.
  const lastMinute = isCalendarDate(eventIso) ? sessionStartUtcMs(eventIso, "11:59 PM") : null;
  const close = deadline && isCalendarDate(deadline.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(deadline) ? Date.parse(deadline) : NaN;
  return {
    eventEndsAt: lastMinute == null ? null : lastMinute + 60_000,
    registrationClosesAt: Number.isFinite(close) ? close : null,
  };
}

export function tournamentBannerState(timing: BannerTiming, enabled: boolean, now: number): BannerState {
  if (timing.eventEndsAt == null || now >= timing.eventEndsAt) return "past";
  return enabled && timing.registrationClosesAt != null && now < timing.registrationClosesAt ? "open" : "closed";
}

/** Clamp long waits to the browser timer limit, then recheck before rescheduling. */
export function nextBannerWake(timing: BannerTiming, now: number): number | null {
  const next = [timing.eventEndsAt, timing.registrationClosesAt]
    .filter((value): value is number => value != null && value > now);
  return next.length ? Math.min(2_147_483_647, Math.min(...next) - now) : null;
}
