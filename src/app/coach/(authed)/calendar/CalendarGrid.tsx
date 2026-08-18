import Link from "next/link";
import { LEVEL_COLOR, LEVEL_COLOR_FALLBACK } from "@/lib/level-colors";
import { formatLongDate } from "@/lib/format-date";
import type { CalendarEntry, MonthGridDay } from "@/lib/coach-calendar";

const WEEKDAY_HEADS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function chipClass(entry: CalendarEntry): string {
  if (entry.status === "Cancelled") {
    return "bg-ngpa-slate/40 text-ngpa-white/50 line-through";
  }
  if (entry.status === "Tentative") {
    // Outlined, not filled — a rain-date hold isn't a booked evening.
    return `border border-dashed ${
      entry.level ? "border-ngpa-teal/60 text-ngpa-teal" : "border-ngpa-slate text-ngpa-white/70"
    }`;
  }
  return entry.level ? LEVEL_COLOR[entry.level] : LEVEL_COLOR_FALLBACK;
}

function fillLabel(entry: CalendarEntry): string {
  if (entry.registered === null) {
    return entry.capacity === null ? "" : `?/${entry.capacity}`;
  }
  return entry.capacity === null
    ? String(entry.registered)
    : `${entry.registered}/${entry.capacity}`;
}

function Chip({ entry }: { entry: CalendarEntry }) {
  const fill = fillLabel(entry);
  return (
    <span
      className={`flex items-center justify-between gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold leading-tight ${chipClass(entry)}`}
    >
      <span className="truncate">{entry.level ?? "Unassigned"}</span>
      {fill && <span className="font-mono shrink-0">{fill}</span>}
    </span>
  );
}

function EntryChips({ entries }: { entries: CalendarEntry[] }) {
  const shown = entries.slice(0, 4);
  const overflow = entries.length - shown.length;
  return (
    <div className="flex flex-col gap-1 mt-1">
      {shown.map((e) =>
        e.href ? (
          <Link key={e.key} href={e.href} title={`${e.title} · ${e.timeLabel}`}>
            <Chip entry={e} />
          </Link>
        ) : (
          <span key={e.key} title={`${e.title} · ${e.timeLabel}`}>
            <Chip entry={e} />
          </span>
        ),
      )}
      {overflow > 0 && (
        <span className="text-[11px] font-bold text-ngpa-white/55 px-1.5">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

interface Props {
  weeks: MonthGridDay[][];
  byDate: Map<string, CalendarEntry[]>;
  todayIso: string;
}

/**
 * Two renderings of the same month, chosen by breakpoint rather than script: a
 * seven-column grid on tablet and up, an agenda list on phones. A 7-col grid at
 * 375px is unreadable, and the phone is where a coach actually opens this.
 */
export default function CalendarGrid({ weeks, byDate, todayIso }: Props) {
  const agendaDays = weeks
    .flat()
    .filter((d) => d.inMonth && (byDate.get(d.iso)?.length ?? 0) > 0);

  return (
    <>
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-px mb-1">
          {WEEKDAY_HEADS.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-bold tracking-wider uppercase text-ngpa-white/55 py-1"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-ngpa-slate/40 rounded-2xl overflow-hidden border border-ngpa-slate/60">
          {weeks.flat().map((day) => {
            const entries = byDate.get(day.iso) ?? [];
            const isToday = day.iso === todayIso;
            return (
              <div
                key={day.iso}
                className={`min-h-[6.5rem] p-1.5 ${
                  day.inMonth ? "bg-ngpa-panel/80" : "bg-ngpa-navy/60"
                }`}
              >
                <div
                  className={`font-mono text-xs font-bold ${
                    isToday
                      ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-ngpa-teal text-ngpa-deep"
                      : day.inMonth
                        ? "text-ngpa-white/70 px-1"
                        : "text-ngpa-white/30 px-1"
                  }`}
                >
                  {Number(day.iso.slice(8, 10))}
                </div>
                {entries.length > 0 && <EntryChips entries={entries} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sm:hidden space-y-3">
        {agendaDays.length === 0 && (
          <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70">
            Nothing on the calendar this month yet.
          </div>
        )}
        {agendaDays.map((day) => {
          const entries = byDate.get(day.iso) ?? [];
          return (
            <div
              key={day.iso}
              className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 px-4 py-4"
            >
              <p
                className={`font-mono text-sm font-bold mb-2 ${
                  day.iso === todayIso ? "text-ngpa-teal" : "text-ngpa-white/70"
                }`}
              >
                {formatLongDate(day.iso)}
                {day.iso === todayIso && " · today"}
              </p>
              <div className="space-y-2">
                {entries.map((e) => {
                  const body = (
                    <div className="flex items-center gap-3 min-h-[3rem]">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold shrink-0 ${chipClass(e)}`}
                      >
                        {e.level ?? "Unassigned"}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ngpa-white truncate">
                          {e.title}
                        </span>
                        <span className="block text-xs text-ngpa-white/65">
                          {[e.timeLabel, e.location].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="ml-auto font-mono text-sm font-bold text-ngpa-white/70 shrink-0">
                        {fillLabel(e)}
                      </span>
                    </div>
                  );
                  return e.href ? (
                    <Link key={e.key} href={e.href} className="block">
                      {body}
                    </Link>
                  ) : (
                    <div key={e.key}>{body}</div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
