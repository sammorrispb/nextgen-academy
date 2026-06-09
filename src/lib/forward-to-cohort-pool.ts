import type { CrewLevel, CrewDay, CrewTimeOfDay } from "./validate-crew-interest";

// NGA ball colors → the cohort engine's internal skill vocabulary. Parents only
// ever see Red/Orange/Green/Yellow; this mapping is server-side only.
const LEVEL_TO_SKILL: Record<CrewLevel, "beginner" | "intermediate" | "advanced"> = {
  Red: "beginner",
  Orange: "beginner",
  Green: "intermediate",
  Yellow: "advanced",
};

const TOD_KEY: Record<CrewTimeOfDay, "morning" | "afternoon" | "evening"> = {
  Morning: "morning",
  Afternoon: "afternoon",
  Evening: "evening",
};

/**
 * Map preferred days + times into the cohort engine's coarse availability slots
 * (weekday/weekend × morning/afternoon/evening). The engine matches crews on a
 * shared slot, so any weekday counts as "weekday" and Sat/Sun as "weekend".
 */
export function toAvailabilitySlots(
  days: CrewDay[],
  times: CrewTimeOfDay[],
): string[] {
  const dayTypes = new Set<"weekday" | "weekend">();
  for (const d of days) {
    dayTypes.add(d === "Sat" || d === "Sun" ? "weekend" : "weekday");
  }
  const slots: string[] = [];
  for (const dt of dayTypes) {
    for (const t of times) slots.push(`${dt}_${TOD_KEY[t]}`);
  }
  return slots;
}

export interface CrewPoolForward {
  childFirstName: string;
  parentName: string;
  email: string;
  phone: string;
  childAge: number;
  childLevel: CrewLevel;
  preferredDays: CrewDay[];
  preferredTimeOfDay: CrewTimeOfDay[];
  preferredLocation?: string;
  utm?: Record<string, string | undefined>;
}

/**
 * Forward a Crew interest into the Coach OS cohort pool so it's auto-matched +
 * invoiced from the /cohorts dashboard. Fully fail-open: no-op when unconfigured,
 * never throws — the Crew form must succeed even if Coach OS is down.
 */
export async function forwardToCohortPool(data: CrewPoolForward): Promise<void> {
  const url = process.env.COACH_OS_COHORT_INTAKE_URL;
  const token = process.env.COHORT_INTAKE_TOKEN;
  if (!url || !token) return;

  const utm = Object.fromEntries(
    Object.entries(data.utm ?? {}).filter(([, v]) => Boolean(v)),
  );

  const payload = {
    track: "youth",
    player_name: data.childFirstName,
    contact_name: data.parentName,
    contact_email: data.email,
    contact_phone: data.phone || undefined,
    skill_band: LEVEL_TO_SKILL[data.childLevel],
    age: data.childAge,
    availability: toAvailabilitySlots(data.preferredDays, data.preferredTimeOfDay),
    preferred_area: data.preferredLocation || undefined,
    source: "nga_crew",
    utm,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cohort-intake-token": token,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[crew-interest] pool forward failed:", res.status, text);
    }
  } catch (err) {
    console.error("[crew-interest] pool forward error:", err);
  }
}
