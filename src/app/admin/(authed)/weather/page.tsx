import { FALL_VENUE_SHORT } from "@/data/fall-2026";
import {
  ACTIVEMONTGOMERY_URL,
  FALL_CALL_BLOCKS,
  FALL_WEATHER_CALL_POLICY,
  buildFallCalendar,
  cupfBookingLine,
  focusDate,
  longDayLabel,
  shortDayLabel,
  type FallGroupSession,
} from "@/lib/fall-calls";
import { todayET } from "@/lib/fall-refund-policy";
import {
  FALL_CALL_SCHEMA,
  fetchFallCalls,
  probeFallCallsSchema,
} from "@/lib/notion-fall-calls";
import { requireAdmin } from "@/lib/require-admin";
import WeatherCallPanel, { type PanelDate, type PanelRainDate } from "./WeatherCallPanel";

// The weather call for the Walter Johnson Sunday season: make the call, see
// who gets told, post it, and track which rain dates still need a CUPF booking.
// Reads no child data — the tracker holds dates and statuses only, and the
// recipient preview (fetched on click) is parent emails.
export const dynamic = "force-dynamic";

function stateLabel(s: FallGroupSession): string {
  switch (s.state) {
    case "cancelled":
      return s.makeupDate ? `Cancelled → ${shortDayLabel(s.makeupDate)}` : "Cancelled · no rain date left";
    case "held":
      return s.derivedHeld ? "Played" : "Played ✓";
    case "on":
      return "On";
    case "today":
      return "Today — call pending";
    default:
      return s.makeupFor ? `Make-up for ${shortDayLabel(s.makeupFor)}` : "Scheduled";
  }
}

function stateTone(s: FallGroupSession): string {
  if (s.state === "cancelled") return "text-red-300";
  if (s.state === "held" || s.state === "on") return "text-ngpa-lime";
  if (s.state === "today") return "text-amber-300";
  return "text-ngpa-white/70";
}

export default async function AdminWeatherPage() {
  await requireAdmin();

  const todayIso = todayET();
  const [calls, probe] = await Promise.all([fetchFallCalls({ fresh: true }), probeFallCallsSchema()]);
  const rows = calls.status === "ok" ? calls.rows : [];
  const calendar = buildFallCalendar(rows, todayIso);
  const focus = focusDate(calendar, todayIso);

  const allDates = [...new Set(calendar.groups.flatMap((g) => g.sessions.map((s) => s.date)))].sort();
  const dates: PanelDate[] = allDates.map((date) => ({
    date,
    label: shortDayLabel(date),
    groups: calendar.groups.flatMap((g) => {
      const s = g.sessions.find((x) => x.date === date);
      return s
        ? [
            {
              group: g.group,
              label: g.label,
              timeLabel: g.timeLabel,
              callTime: g.callTime,
              status: s.status,
              state: s.state,
              stateLabel: stateLabel(s),
            },
          ]
        : [];
    }),
  }));
  const rain: PanelRainDate[] = calendar.rainDates.map((r) => ({
    date: r.date,
    label: longDayLabel(r.date),
    cupf: r.cupf,
    usedBy: r.usedBy.map((u) => `${u.group} (for ${shortDayLabel(u.makeupFor)})`),
    needsBooking: r.needsBooking,
    bookingLine: cupfBookingLine(r.date),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-black">Weather call</h1>
        <p className="text-ngpa-white/65 text-sm mt-1">
          Fall season at {FALL_VENUE_SHORT}. {FALL_WEATHER_CALL_POLICY}
        </p>
      </div>

      {calls.status === "config_missing" && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100 mb-6 space-y-2">
          <p>
            <b>The weather-call tracker isn&rsquo;t switched on.</b> Until it is, cancel by hand
            (WhatsApp + email) — nothing on this page can save.
          </p>
          <p>
            Set <code className="font-mono">NOTION_FALL_CALLS_DB_ID</code> to a Notion database
            with these properties, shared with the &ldquo;Player DB&rdquo; integration:{" "}
            {Object.entries(FALL_CALL_SCHEMA)
              .map(([name, type]) => `${name} (${type})`)
              .join(", ")}
            . It can start empty — rows are created on the first call.
          </p>
        </div>
      )}
      {calls.status === "query_failed" && (
        <div className="rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200 mb-6">
          <b>Can&rsquo;t read the tracker</b> ({calls.message}). Nothing here is safe to act on until
          it loads — check the Notion share, or make today&rsquo;s call by hand.
        </div>
      )}
      {probe.status === "mismatch" && (
        <div className="rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200 mb-6">
          <b>The tracker is missing columns — a save will fail.</b>{" "}
          {probe.missing.length > 0 && <>Missing: {probe.missing.join(", ")}. </>}
          {probe.mistyped.length > 0 && <>Wrong type: {probe.mistyped.join(", ")}.</>}
        </div>
      )}
      {calls.status === "ok" && calls.duplicates.length > 0 && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100 mb-6">
          Two tracker rows share a date ({calls.duplicates.join(", ")}). The oldest is used — delete
          the newer one in Notion.
        </div>
      )}

      <WeatherCallPanel
        dates={dates}
        focus={focus}
        rain={rain}
        todayIso={todayIso}
        enabled={calls.status === "ok"}
        activeMontgomeryUrl={ACTIVEMONTGOMERY_URL}
      />

      <section className="mt-12">
        <h2 className="font-heading text-xl font-black mb-1">Held vs cancelled</h2>
        <p className="text-ngpa-white/60 text-sm mb-4">
          A Sunday that passes without a call counts as played. A cancelled session takes the next
          open rain date for its group.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {calendar.groups.map((g) => (
            <div key={g.group} className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-heading font-black">{g.label}</h3>
                <span className="text-xs text-ngpa-white/60">
                  {g.timeLabel} · call by {g.callTime}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <Tile label="Played" value={g.held} />
                <Tile label="Cancelled" value={g.cancelled} />
                <Tile label="To go" value={g.remaining} />
              </div>
              <ul className="space-y-1.5 text-sm">
                {g.sessions.map((s) => (
                  <li key={s.date} className="flex justify-between gap-3">
                    <span className="text-ngpa-white/85">
                      <time dateTime={s.date}>{shortDayLabel(s.date)}</time>
                      {s.kind === "rain" && <span className="text-ngpa-white/50"> · rain date</span>}
                    </span>
                    <span className={stateTone(s)}>{stateLabel(s)}</span>
                  </li>
                ))}
              </ul>
              {g.unresolved.length > 0 && (
                <p className="mt-3 text-xs text-red-300">
                  No rain date left for {g.unresolved.map(shortDayLabel).join(", ")} — add a date or
                  refund those sessions (fall-refund-policy: NGA-cancelled is prorated).
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-ngpa-white/50">
          Call times: {FALL_CALL_BLOCKS.map((b) => `${b.label} ${b.callTime}`).join(" · ")}.
        </p>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ngpa-slate/50 bg-ngpa-deep/50 py-2">
      <p className="font-heading text-lg font-black">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.15em] text-ngpa-white/55">{label}</p>
    </div>
  );
}
