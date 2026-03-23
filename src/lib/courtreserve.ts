import type { CREvent, LocationConfig } from "@/types/schedule";

/** Simplified session for the free trial RSVP form */
export interface FreeTrialSession {
  eventId: number;
  eventName: string;
  location: "Rockville" | "North Bethesda";
  orgId: number;
  date: string;
  label: string;
  level: "Red Ball" | "Orange Ball";
}

const CR_BASE = "https://api.courtreserve.com";

const NEXT_GEN_CATEGORY = /(Next Gen|Kids Program)/i;

export const LOCATIONS: LocationConfig[] = [
  {
    key: "rockville",
    location: "Rockville",
    venue: "Dill Dinkers",
    address: "40 Southlawn Court, Suite C, Rockville, MD 20850",
    orgId: 10869,
    widgetUrl: "https://widgets.courtreserve.com/Online/Public/EmbedCode/10869/100672",
  },
  {
    key: "northbethesda",
    location: "North Bethesda",
    venue: "Dill Dinkers",
    address: "4942 Boiling Brook Parkway, North Bethesda, MD 20852",
    orgId: 10483,
    widgetUrl: "https://widgets.courtreserve.com/Online/Public/EmbedCode/10483/100673",
  },
];

function getCredentials(locationKey: string) {
  const prefix = `COURTRESERVE_${locationKey.toUpperCase().replace(/[\s-]+/g, "")}_`;
  const username = process.env[`${prefix}USERNAME`];
  const password = process.env[`${prefix}PASSWORD`];
  const orgId = process.env[`${prefix}ORG_ID`];
  return { username, password, orgId };
}

function crHeaders(locationKey: string): HeadersInit {
  const { username, password } = getCredentials(locationKey);
  if (!username || !password) {
    throw new Error(`Missing CR credentials for ${locationKey}`);
  }
  return {
    Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
    "Content-Type": "application/json",
  };
}

export function hasCredentials(): boolean {
  return LOCATIONS.every((loc) => {
    const { username, password } = getCredentials(loc.key);
    return !!username && !!password;
  });
}

export async function fetchNextGenEvents(
  loc: LocationConfig,
  startDate: string,
  endDate: string,
): Promise<CREvent[]> {
  const headers = crHeaders(loc.key);

  const params = new URLSearchParams({
    startDate,
    endDate,
    organizationId: String(loc.orgId),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(
      `${CR_BASE}/api/v1/eventcalendar/eventlist?${params}`,
      { headers, signal: controller.signal },
    );

    if (!res.ok) {
      throw new Error(`CR API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    // Defensive unwrapping — CR sometimes returns { Data: [...] }, sometimes raw array
    const events: CREvent[] = Array.isArray(data?.Data)
      ? data.Data
      : Array.isArray(data)
        ? data
        : [];

    return events.filter(
      (e) => NEXT_GEN_CATEGORY.test(e.EventCategoryName ?? "") && !e.IsCanceled,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Free Trial Sessions ─────────────────────────
const RED_ORANGE_RE = /\b(red|orange)\b/i;

const FULL_DAY_NAMES: Record<number, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
  4: "Thursday", 5: "Friday", 6: "Saturday",
};
const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const mins = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${h}${mins} ${ap}`;
}

/** Fetch all upcoming Red Ball + Orange Ball sessions from both locations. */
export async function fetchFreeTrialSessions(): Promise<FreeTrialSession[]> {
  if (!hasCredentials()) return [];

  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 60);

  const startStr = today.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const results = await Promise.allSettled(
    LOCATIONS.map(async (loc) => {
      const events = await fetchNextGenEvents(loc, startStr, endStr);
      return events
        .filter((e) => RED_ORANGE_RE.test(e.EventName))
        .map((e): FreeTrialSession => {
          const start = new Date(e.StartDateTime);
          const colorMatch = e.EventName.match(RED_ORANGE_RE);
          const color = colorMatch ? colorMatch[1].charAt(0).toUpperCase() + colorMatch[1].slice(1).toLowerCase() : "Red";
          const dayName = FULL_DAY_NAMES[start.getDay()] ?? "";
          const monthName = FULL_MONTH_NAMES[start.getMonth()] ?? "";
          return {
            eventId: e.Id,
            eventName: e.EventName,
            location: loc.location as "Rockville" | "North Bethesda",
            orgId: loc.orgId,
            date: start.toISOString().slice(0, 10),
            label: `${dayName}, ${monthName} ${start.getDate()} — ${fmtTime(e.StartDateTime)}–${fmtTime(e.EndDateTime)} (${loc.location})`,
            level: `${color} Ball` as "Red Ball" | "Orange Ball",
          };
        });
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<FreeTrialSession[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => a.date.localeCompare(b.date) || a.location.localeCompare(b.location));
}
