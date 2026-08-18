import Link from "next/link";
import { fetchSessionsInRange } from "@/lib/notion-sessions";
import { fetchCrewInterestDemand } from "@/lib/notion-crew-interest";
import { fetchFallInterestDemand } from "@/lib/notion-fall-interest";
import { ageFromBirthYear } from "@/lib/crew-matching";
import {
  type CalendarLevel,
  type DemandRow,
  buildDemandMatrix,
  buildMonthGrid,
  buildSupplyByDayLevel,
  fallEntriesForMonth,
  groupByDate,
  monthBounds,
  parseMonthParam,
  sessionsToEntries,
  shiftMonth,
  CALENDAR_LEVELS,
} from "@/lib/coach-calendar";
import CalendarGrid from "./CalendarGrid";
import DemandPanel from "./DemandPanel";

export const dynamic = "force-dynamic";

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monthLabel(month: string): string {
  return MONTH_LABEL.format(new Date(`${month}-01T12:00:00Z`));
}

function isCalendarLevel(v: unknown): v is CalendarLevel {
  return (CALENDAR_LEVELS as readonly string[]).includes(v as string);
}

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function CoachCalendarPage({ searchParams }: PageProps) {
  const { month: monthParam } = await searchParams;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const month = parseMonthParam(monthParam, todayIso);

  // Widen the read past the month edges so the grid's leading/trailing days
  // from the neighbouring months aren't silently empty.
  const { firstIso, lastIso } = monthBounds(month);
  const { firstIso: prevFirst } = monthBounds(shiftMonth(month, -1));
  const { lastIso: nextLast } = monthBounds(shiftMonth(month, 1));

  const [sessions, crew, fall] = await Promise.all([
    fetchSessionsInRange(prevFirst, nextLast),
    fetchCrewInterestDemand(),
    fetchFallInterestDemand(),
  ]);

  const entries = [
    ...sessionsToEntries(sessions.rows),
    ...fallEntriesForMonth(month),
    ...fallEntriesForMonth(shiftMonth(month, -1)),
    ...fallEntriesForMonth(shiftMonth(month, 1)),
  ];
  const weeks = buildMonthGrid(month);
  // Scope to the dates the grid actually draws — the neighbouring months are
  // read for the leading/trailing cells only, and shipping the rest would just
  // pad the payload with rows nothing renders.
  const visible = new Set(weeks.flat().map((d) => d.iso));
  const byDate = groupByDate(entries.filter((e) => visible.has(e.date)));

  // Supply is scoped to the month being viewed — the neighbouring rows are on
  // the grid for continuity, not for the "is this level covered?" question.
  const supply = buildSupplyByDayLevel(
    entries.filter((e) => e.date >= firstIso && e.date <= lastIso),
  );

  const demandRows: DemandRow[] = [
    ...crew.rows
      .filter((r) => isCalendarLevel(r.childLevel))
      .map((r) => ({
        level: r.childLevel as CalendarLevel,
        age: ageFromBirthYear(r.childBirthYear, now),
        days: r.preferredDays,
        area: r.preferredArea,
      })),
    ...fall.rows
      .filter((r) => isCalendarLevel(r.childLevel))
      .map((r) => ({
        level: r.childLevel as CalendarLevel,
        age: ageFromBirthYear(r.childBirthYear, now),
        // Fall Interest only asks about Sunday, so it contributes level and
        // age but never a weekday preference.
        days: [],
        area: "",
      })),
  ];
  const demand = buildDemandMatrix(demandRows);

  const fallSundayWorks = fall.rows.filter((r) =>
    r.days.includes("Sunday"),
  ).length;
  const fallSundayDoesnt = fall.rows.filter((r) =>
    r.days.includes("Sunday doesn't work"),
  ).length;
  const fallSubList = fall.rows.filter((r) => r.subListInterest).length;

  const monthEntryCount = entries.filter(
    (e) => e.date >= firstIso && e.date <= lastIso,
  ).length;

  const navPill =
    "inline-flex items-center justify-center min-w-[3rem] min-h-[3rem] px-4 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-bold transition-colors";

  return (
    <>
      <Link
        href="/coach"
        className="inline-block text-sm font-bold text-ngpa-teal hover:underline mb-6"
      >
        ← Back to dashboard
      </Link>

      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Calendar
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        {monthLabel(month)}
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-6 max-w-2xl">
        {monthEntryCount} grouping{monthEntryCount === 1 ? "" : "s"} on the
        calendar this month, with who&apos;s still waiting below.
      </p>

      {!sessions.ok && (
        <div className="mb-6 px-4 py-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 text-sm text-amber-200">
          The Sessions database is unavailable right now — the weekly sessions
          are missing from this grid, not cancelled. The Fall season below is
          file-backed and still accurate.
        </div>
      )}
      {sessions.truncated && (
        <div className="mb-6 px-4 py-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 text-sm text-amber-200">
          Hit the 500-row session read cap for this window; some rows aren&apos;t shown.
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <Link href={`?month=${shiftMonth(month, -1)}`} className={navPill} aria-label="Previous month">
          ‹
        </Link>
        <Link href={`?month=${shiftMonth(month, 1)}`} className={navPill} aria-label="Next month">
          ›
        </Link>
        <Link href="/coach/calendar" className={navPill}>
          Today
        </Link>
      </div>

      <CalendarGrid weeks={weeks} byDate={byDate} todayIso={todayIso} />

      <DemandPanel
        demand={demand}
        supply={supply}
        crewOk={crew.ok}
        crewTruncated={crew.truncated}
        fallOk={fall.ok}
        fallTruncated={fall.truncated}
        fallSundayWorks={fallSundayWorks}
        fallSundayDoesnt={fallSundayDoesnt}
        fallSubList={fallSubList}
      />
    </>
  );
}
