/**
 * RFC 5545 calendar invite generator for NGA drop-in sessions.
 *
 * Uses a VTIMEZONE block with `America/New_York` so calendar clients can
 * resolve DST correctly without us having to compute the UTC offset for each
 * session date. Times are expressed as floating local time + TZID — the most
 * reliable cross-client format (Apple Calendar, Google Calendar, Outlook all
 * honor it).
 */

interface IcsInput {
  uid: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "5:30 PM"
  endTime: string; // "6:30 PM"
  title: string;
  location: string;
  description: string;
  /**
   * Additive (Phase 1a): "PUBLISH" (default — informational attachment) or
   * "REQUEST" (a real invitation, so mail clients like Gmail/Apple Mail offer
   * add-to-calendar/RSVP on the coach booking-notification email). REQUEST
   * requires `organizer` + at least one entry in `attendees` to be honored.
   */
  method?: "PUBLISH" | "REQUEST";
  organizer?: { name: string; email: string };
  attendees?: { name?: string; email: string }[];
}

function parseTime(time: string): { h: number; m: number } | null {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return { h, m };
}

function fmtLocalDateTime(date: string, time: string): string | null {
  const t = parseTime(time);
  if (!t) return null;
  const [y, mo, d] = date.split("-");
  return `${y}${mo}${d}T${String(t.h).padStart(2, "0")}${String(t.m).padStart(2, "0")}00`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function nowStampUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${da}T${h}${mi}${s}Z`;
}

const VTIMEZONE_AMERICA_NEW_YORK = [
  "BEGIN:VTIMEZONE",
  "TZID:America/New_York",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

/**
 * Returns the .ics text body for a single VEVENT, or null if inputs are
 * malformed (e.g. unparseable time string).
 */
export function buildDropInIcs(input: IcsInput): string | null {
  const dtStart = fmtLocalDateTime(input.date, input.startTime);
  const dtEnd = fmtLocalDateTime(input.date, input.endTime);
  if (!dtStart || !dtEnd) return null;

  const method = input.method ?? "PUBLISH";
  const participantLines: string[] = [];
  if (input.organizer) {
    participantLines.push(
      `ORGANIZER;CN=${escapeText(input.organizer.name)}:mailto:${input.organizer.email}`,
    );
  }
  for (const attendee of input.attendees ?? []) {
    const cn = attendee.name ? `;CN=${escapeText(attendee.name)}` : "";
    participantLines.push(
      `ATTENDEE${cn};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee.email}`,
    );
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Next Gen Pickleball Academy//Drop-in//EN",
    `METHOD:${method}`,
    "CALSCALE:GREGORIAN",
    VTIMEZONE_AMERICA_NEW_YORK,
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${nowStampUtc()}`,
    `DTSTART;TZID=America/New_York:${dtStart}`,
    `DTEND;TZID=America/New_York:${dtEnd}`,
    ...participantLines,
    `SUMMARY:${escapeText(input.title)}`,
    `LOCATION:${escapeText(input.location)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  return lines.join("\r\n");
}
