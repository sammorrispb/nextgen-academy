import type { CREvent, LocationConfig } from "@/types/schedule";

const CR_BASE = "https://api.courtreserve.com";

const NEXT_GEN_CATEGORY = /(Next Gen|Kids Program)/i;

export const LOCATIONS: LocationConfig[] = [
  {
    key: "rockville",
    location: "Rockville",
    venue: "Dill Dinkers",
    address: "40 Southlawn Court, Suite C, Rockville, MD 20850",
    orgId: 10869,
  },
  {
    key: "northbethesda",
    location: "North Bethesda",
    venue: "Dill Dinkers",
    address: "4942 Boiling Brook Parkway, North Bethesda, MD 20852",
    orgId: 10483,
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
