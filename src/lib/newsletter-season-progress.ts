import { FALL_SUNDAYS, FALL_RAIN_DATES } from "@/data/fall-2026";
import { PICKLPARK_SATURDAYS } from "@/data/picklpark-2026";
import { buildFallCalendar, shortDayLabel } from "./fall-calls";
import type { FallCallsReadResult } from "./notion-fall-calls";

export interface FallNewsletterProgress {
  underway: boolean;
  hasUpcoming: boolean;
  scheduleNotes: string[];
  makeupNotes: string[];
}

function validDay(day: string): boolean {
  const date = new Date(`${day}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

/** Date-injected, public schedule data only; the existing calendar owns makeups. */
export function fallNewsletterProgress(today: string, calls: FallCallsReadResult): FallNewsletterProgress {
  if (!validDay(today)) return { underway: false, hasUpcoming: false, scheduleNotes: [], makeupNotes: [] };
  const underway = today >= FALL_SUNDAYS[0];
  if (calls.status !== "ok") return {
    underway,
    hasUpcoming: today <= FALL_RAIN_DATES[FALL_RAIN_DATES.length - 1],
    scheduleNotes: ["Check the current fall calendar and your group's WhatsApp for the latest dates and weather calls."],
    makeupNotes: [],
  };
  const calendar = buildFallCalendar(calls.rows, today);
  const dates = calendar.groups.map(group => group.sessions.filter(session =>
    session.date >= today && session.state !== "cancelled" && session.state !== "held",
  ).map(session => session.date));
  const sameDates = dates.every(groupDates => groupDates.join(",") === dates[0].join(","));
  const remainingLabel = (groupDates: string[]) =>
    `${groupDates.length} ${groupDates.length === 1 ? "Sunday" : "Sundays"} remaining${groupDates.length ? `: ${groupDates.map(shortDayLabel).join("; ")}` : ""}.`;
  const scheduleNotes = sameDates ? [remainingLabel(dates[0])] :
    dates.map((groupDates, index) => `${calendar.groups[index].label}: ${remainingLabel(groupDates)}`);
  const makeupNotes = calendar.rainDates.flatMap(rain => {
    const uses = rain.usedBy.filter(use => calendar.groups.find(group => group.group === use.group)?.sessions.some(
      session => session.date === rain.date && session.date >= today && session.state !== "cancelled" && session.state !== "held",
    ));
    if (!uses.length) return [];
    const originals = [...new Set(uses.map(use => use.makeupFor))];
    const groups = uses.map(use => `${use.group} Ball`).join(" and ");
    return [`${shortDayLabel(rain.date)} is the makeup for ${originals.map(shortDayLabel).join(" and ")} (${groups}).${rain.needsBooking ? " Court booking confirmation is pending; check the fall calendar before heading out." : ""}`];
  });
  if (calendar.groups.some(group => group.unresolved.length)) {
    makeupNotes.push("A cancelled session still needs a replacement date. Check the fall calendar or contact Coach Sam for the update.");
  }
  return { underway, hasUpcoming: dates.some(groupDates => groupDates.length > 0), scheduleNotes, makeupNotes };
}

export function picklParkNewsletterProgress(today: string): { underway: boolean; remaining: number; scheduleNote: string } {
  if (!validDay(today)) return { underway: false, remaining: 0, scheduleNote: "" };
  const remaining = PICKLPARK_SATURDAYS.filter(date => date >= today);
  return {
    underway: today >= PICKLPARK_SATURDAYS[0], remaining: remaining.length,
    scheduleNote: `${remaining.length} ${remaining.length === 1 ? "Saturday" : "Saturdays"} remaining${remaining.length ? `: ${remaining.map(shortDayLabel).join("; ")}` : ""}.`,
  };
}
