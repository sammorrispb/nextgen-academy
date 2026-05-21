import { c, s } from "./brand";

export type PreEventRisk = "proceed" | "watch" | "cancel";

export interface CoachPreEventInput {
  sessionTitle: string;
  sessionDateLong: string; // "Saturday, May 23, 2026"
  sessionStart: string; // "4:30 PM"
  location: string;
  rosterSize: number;
  weather: {
    maxRain: number;
    tempHigh: number | null;
    summary: string;
    risk: PreEventRisk;
  } | null;
  cancelUrl: string; // signed → /coach/cancel-session/[token]
  sessionUrl: string; // /coach/[slug]
}

const RISK_LABEL: Record<PreEventRisk, string> = {
  proceed: "Looks playable",
  watch: "Watch the sky",
  cancel: "High rain risk",
};

function weatherLine(w: CoachPreEventInput["weather"]): string {
  if (!w) return "Forecast not available yet (more than ~7 days out).";
  const temp = w.tempHigh != null ? `, ${w.tempHigh}°F` : "";
  return `${RISK_LABEL[w.risk]} — ${w.maxRain}% rain${temp}. ${w.summary}.`;
}

export function coachPreEventHtml(input: CoachPreEventInput): string {
  const { sessionTitle, sessionDateLong, sessionStart, location, rosterSize, weather, cancelUrl, sessionUrl } =
    input;
  const accent = weather?.risk === "cancel" ? c.accentYellow : c.accentLime;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tomorrow &mdash; ${escape(sessionTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${accent};font-weight:700;">24-hour check &middot; coach only</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(sessionTitle)} is ~24h out.</h1>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${escape(sessionDateLong)} &middot; ${escape(sessionStart)}</p>
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(location)}</p>
      <p style="margin:0;color:${c.muted};font-size:14px;">${rosterSize} registered.</p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Weather</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:15px;line-height:1.55;">${escape(weatherLine(weather))}</p>
    </div>

    <p style="margin:24px 0 8px 0;color:${c.text};line-height:1.55;">
      If you need to call it off, this cancels the session and refunds all ${rosterSize} registration${rosterSize === 1 ? "" : "s"} in full. You&rsquo;ll get a confirmation screen first &mdash; nothing happens until you confirm.
    </p>
    <p style="margin:0 0 8px 0;">
      <a href="${cancelUrl}" style="display:inline-block;background:${c.accentYellow};color:${c.bgDark};font-weight:800;text-decoration:none;padding:12px 22px;border-radius:9999px;font-family:Montserrat,Arial,sans-serif;">Review &amp; cancel session</a>
    </p>
    <p style="margin:14px 0 0 0;">
      <a href="${sessionUrl}" style="${s.link}font-weight:700;text-decoration:none;">Open the roster instead &rarr;</a>
    </p>

    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        Auto-sent ~24h before each session so you never miss a weather call.<br>
        <strong style="color:${c.text};">Next Gen Pickleball Academy</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function coachPreEventText(input: CoachPreEventInput): string {
  return [
    `${input.sessionTitle} is ~24h out.`,
    "",
    `${input.sessionDateLong} · ${input.sessionStart}`,
    input.location,
    `${input.rosterSize} registered.`,
    "",
    `Weather: ${weatherLine(input.weather)}`,
    "",
    `Need to call it off? This cancels the session and refunds all ${input.rosterSize} registration(s) in full — you'll get a confirmation screen first:`,
    input.cancelUrl,
    "",
    `Open the roster instead: ${input.sessionUrl}`,
    "",
    `Auto-sent ~24h before each session. — Next Gen Pickleball Academy`,
  ].join("\n");
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
