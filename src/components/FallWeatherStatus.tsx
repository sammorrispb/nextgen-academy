import {
  FALL_WEATHER_CALL_POLICY,
  buildFallCalendar,
  focusDate,
  longDayLabel,
  shortDayLabel,
  type FallGroupSchedule,
  type FallGroupSession,
} from "@/lib/fall-calls";
import type { FallCallsReadResult } from "@/lib/notion-fall-calls";

// The live weather status on /fall: the next Sunday per group (on, cancelled,
// or the call still to come), then every date with what happened to it. Reads
// the weather-call tracker only — no roster, no names.
//
// Honest failure matters more than polish here. A tracker that can't be read
// must NOT render as "on as scheduled": on a wet Sunday that sends families to
// a closed court. So a failed read says to check WhatsApp or email instead.

interface Props {
  calls: FallCallsReadResult;
  todayIso: string;
}

function pill(s: FallGroupSession, g: FallGroupSchedule): { text: string; tone: string } {
  switch (s.state) {
    case "cancelled":
      return { text: "Cancelled", tone: "bg-red-500/15 text-red-300 border-red-400/40" };
    case "on":
      return { text: "On", tone: "bg-ngpa-lime/15 text-ngpa-lime border-ngpa-lime/40" };
    case "held":
      return { text: "Played", tone: "bg-ngpa-slate/40 text-ngpa-white/70 border-ngpa-slate/60" };
    case "today":
      return {
        text: `Call by ${g.callTime}`,
        tone: "bg-amber-400/15 text-amber-200 border-amber-300/40",
      };
    default:
      return {
        text: s.makeupFor ? `Make-up for ${shortDayLabel(s.makeupFor)}` : "Scheduled",
        tone: "bg-ngpa-slate/30 text-ngpa-white/75 border-ngpa-slate/60",
      };
  }
}

function detail(s: FallGroupSession, g: FallGroupSchedule): string {
  if (s.state === "cancelled") {
    return s.makeupDate
      ? `Made up ${longDayLabel(s.makeupDate)}, ${g.timeLabel}.`
      : "Both rain dates are in use — we'll be in touch.";
  }
  if (s.state === "on") return `${g.timeLabel} — see you on court.`;
  if (s.state === "today") return `${g.timeLabel} · we post the call here, in WhatsApp and by email if it's off.`;
  return `${g.timeLabel} · weather call by ${g.callTime} on the day.`;
}

/**
 * The slim strip above the /fall hero — only on a session day, or while the
 * next session has a cancellation on it. The rest of the week the full block
 * further down is enough, and the hero stays the hero.
 */
export function FallWeatherAlert({ calls, todayIso }: Props) {
  if (calls.status !== "ok") return null;
  const calendar = buildFallCalendar(calls.rows, todayIso);
  const focus = focusDate(calendar, todayIso);
  if (!focus) return null;
  const lines = calendar.groups.flatMap((g) => {
    const s = g.sessions.find((x) => x.date === focus);
    return s ? [{ g, s }] : [];
  });
  const anyCancelled = lines.some(({ s }) => s.state === "cancelled");
  if (focus !== todayIso && !anyCancelled) return null;

  return (
    <div
      role="status"
      className={`border-b px-4 py-3 ${anyCancelled ? "bg-red-500/15 border-red-400/40" : "bg-ngpa-panel border-ngpa-slate/50"}`}
    >
      <div className="max-w-3xl mx-auto text-sm text-ngpa-white">
        <span className="font-bold">
          {focus === todayIso ? "Today" : longDayLabel(focus)} at the courts:
        </span>{" "}
        {lines.map(({ g, s }, i) => (
          <span key={g.group}>
            {i > 0 && " · "}
            {g.label} — {s.state === "cancelled" ? "cancelled" : pill(s, g).text.toLowerCase()}
            {s.state === "cancelled" && s.makeupDate ? ` (made up ${shortDayLabel(s.makeupDate)})` : ""}
          </span>
        ))}{" "}
        <a href="#weather" className="underline text-ngpa-teal-bright hover:text-ngpa-teal">
          Details
        </a>
      </div>
    </div>
  );
}

export default function FallWeatherStatus({ calls, todayIso }: Props) {
  if (calls.status === "config_missing") {
    return (
      <p className="text-sm text-ngpa-white/65 leading-relaxed mb-6">
        <strong className="text-ngpa-white">Weather calls.</strong> {FALL_WEATHER_CALL_POLICY} It
        goes up in your group&rsquo;s WhatsApp and, if we cancel, by email too.
      </p>
    );
  }

  if (calls.status === "query_failed") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-amber-300/50 bg-amber-300/10 p-5 mb-6 text-amber-100"
      >
        <p className="font-bold mb-1">We couldn&rsquo;t load today&rsquo;s weather call.</p>
        <p className="text-sm leading-relaxed">
          Check your group&rsquo;s WhatsApp or your email for the latest — or text Coach Sam at
          301-325-4731. {FALL_WEATHER_CALL_POLICY}
        </p>
      </div>
    );
  }

  const calendar = buildFallCalendar(calls.rows, todayIso);
  const focus = focusDate(calendar, todayIso);
  const dates = [...new Set(calendar.groups.flatMap((g) => g.sessions.map((s) => s.date)))].sort();

  return (
    <section aria-labelledby="fall-weather-heading" className="mb-10">
      {focus && (
        <div
          role="status"
          className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel p-5 sm:p-6 mb-4"
        >
          <p className="text-xs font-bold text-ngpa-lime uppercase tracking-[0.18em] mb-1">
            {focus === todayIso ? "Today" : "Next session"}
          </p>
          <h2
            id="fall-weather-heading"
            className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight mb-4"
          >
            <time dateTime={focus}>{longDayLabel(focus)}</time>
          </h2>
          <ul className="space-y-3">
            {calendar.groups.map((g) => {
              const s = g.sessions.find((x) => x.date === focus);
              if (!s) return null;
              const p = pill(s, g);
              return (
                <li key={g.group} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span className="font-heading font-bold text-ngpa-white min-w-[7.5rem]">
                    {g.label}
                  </span>
                  <span
                    className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold ${p.tone}`}
                  >
                    {p.text}
                  </span>
                  <span className="text-sm text-ngpa-white/75">{detail(s, g)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-sm text-ngpa-white/65 leading-relaxed mb-4">
        <strong className="text-ngpa-white">Weather calls.</strong> {FALL_WEATHER_CALL_POLICY} It
        goes up here, in your group&rsquo;s WhatsApp and, if we cancel, by email. A cancelled
        Sunday moves to the next open rain date.
      </p>

      <details className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-slate/20 p-4">
        <summary className="cursor-pointer font-heading text-sm font-bold text-ngpa-white">
          Season schedule &amp; weather record
        </summary>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.12em] text-ngpa-white/55">
              <th className="py-1.5 pr-2 font-bold">Date</th>
              {calendar.groups.map((g) => (
                <th key={g.group} className="py-1.5 pr-2 font-bold">
                  {g.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((d) => (
              <tr key={d} className="border-t border-ngpa-slate/40">
                <td className="py-2 pr-2 text-ngpa-white/85 whitespace-nowrap">
                  <time dateTime={d}>{shortDayLabel(d)}</time>
                </td>
                {calendar.groups.map((g) => {
                  const s = g.sessions.find((x) => x.date === d);
                  if (!s) return <td key={g.group} className="py-2 pr-2 text-ngpa-white/35">—</td>;
                  const label =
                    s.state === "cancelled"
                      ? s.makeupDate
                        ? `Rained out → ${shortDayLabel(s.makeupDate)}`
                        : "Cancelled"
                      : pill(s, g).text;
                  const tone =
                    s.state === "cancelled"
                      ? "text-red-300"
                      : s.state === "held" || s.state === "on"
                        ? "text-ngpa-lime"
                        : "text-ngpa-white/75";
                  return (
                    <td key={g.group} className={`py-2 pr-2 ${tone}`}>
                      {label}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
