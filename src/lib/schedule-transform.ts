import type { BallColor } from "@/data/levels";
import type { CREvent, LiveLocation, LiveSession, LiveSlot, LocationConfig } from "@/types/schedule";

// Match first color word — handles "Green/Yellow Ball", "Red Ball", etc.
const BALL_LEVEL_RE = /\b(red|orange|green)\b/i;

const DAY_NAMES: Record<number, string> = {
  0: "Sundays",
  1: "Mondays",
  2: "Tuesdays",
  3: "Wednesdays",
  4: "Thursdays",
  5: "Fridays",
  6: "Saturdays",
};

const SHORT_DAYS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseBallLevel(eventName: string): BallColor | null {
  const match = eventName.match(BALL_LEVEL_RE);
  if (!match) return null;
  return match[1].toLowerCase() as BallColor;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const mins = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;
  return `${hours}${mins} ${ampm}`;
}

function formatDisplayDate(d: Date): string {
  return `${SHORT_DAYS[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildRegistrationUrl(loc: LocationConfig): string {
  return loc.widgetUrl;
}

export function transformEvents(events: CREvent[], loc: LocationConfig): LiveLocation {
  const slotMap = new Map<string, LiveSession[]>();

  for (const event of events) {
    const level = parseBallLevel(event.EventName);
    if (!level) continue;

    const start = new Date(event.StartDateTime);
    const dayOfWeek = DAY_NAMES[start.getDay()] ?? "Unknown";
    const timeRange = `${formatTime(event.StartDateTime)}\u2013${formatTime(event.EndDateTime)}`;
    const slotKey = `${dayOfWeek} ${timeRange}`;

    const spotsTotal = event.MaxRegistrants || 0;
    const spotsFilled = event.RegisteredCount || 0;

    const session: LiveSession = {
      date: formatDateKey(start),
      displayDate: formatDisplayDate(start),
      startIso: event.StartDateTime,
      endIso: event.EndDateTime,
      level,
      spotsTotal,
      spotsFilled,
      spotsRemaining: Math.max(0, spotsTotal - spotsFilled),
      registrationUrl: buildRegistrationUrl(loc),
    };

    const existing = slotMap.get(slotKey);
    if (existing) {
      existing.push(session);
    } else {
      slotMap.set(slotKey, [session]);
    }
  }

  // Convert map to sorted LiveSlot array
  const slots: LiveSlot[] = [];
  const dayNameToIndex: Record<string, number> = {};
  for (const [idx, name] of Object.entries(DAY_NAMES)) {
    dayNameToIndex[name] = Number(idx);
  }

  // Parse "9 AM" or "5:30 PM" to minutes since midnight for sorting
  function timeToMinutes(t: string): number {
    const m = t.match(/^(\d+)(?::(\d+))?\s*(AM|PM)$/i);
    if (!m) return 0;
    let hours = Number(m[1]);
    const mins = Number(m[2] || 0);
    const isPM = m[3].toUpperCase() === "PM";
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return hours * 60 + mins;
  }

  const sortedEntries = [...slotMap.entries()].sort(([a], [b]) => {
    const dayA = dayNameToIndex[a.split(" ")[0]] ?? 7;
    const dayB = dayNameToIndex[b.split(" ")[0]] ?? 7;
    if (dayA !== dayB) return dayA - dayB;
    // Sort by start time numerically
    const timeA = timeToMinutes(a.split(" ").slice(1).join(" ").split("\u2013")[0].trim());
    const timeB = timeToMinutes(b.split(" ").slice(1).join(" ").split("\u2013")[0].trim());
    return timeA - timeB;
  });

  for (const [slotKey, sessions] of sortedEntries) {
    sessions.sort((a, b) => a.date.localeCompare(b.date));

    const parts = slotKey.split(" ");
    const dayOfWeek = parts[0];
    const timeRange = parts.slice(1).join(" ");

    const levels = [...new Set(sessions.map((s) => s.level))];

    slots.push({ dayOfWeek, timeRange, levels, sessions });
  }

  return {
    location: loc.location,
    venue: loc.venue,
    address: loc.address,
    slots,
  };
}
