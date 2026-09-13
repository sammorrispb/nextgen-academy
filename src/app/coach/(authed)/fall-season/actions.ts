"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/coach-auth-server";
import { seasonLeagueGroupSlug } from "@/data/season-league-2026";
import {
  lockTeams,
  parseGroup,
  parseWeek,
  previewDay,
  previewTeams,
  recordGameScore,
  recordPlayoffScore,
  saveDay,
  unlockTeams,
  type DayPreview,
  type LockResult,
  type SaveDayResult,
  type ScoreResult,
  type TeamsPreview,
} from "@/lib/season-league-view";

// Thin coach-auth wrappers over @/lib/season-league-view — the same shape as
// markAttendanceAction over applyAttendance. Every action: requireCoach, fail
// closed, delegate, revalidate the concrete paths. No Notion call lives here.

const UNAUTHORIZED = { ok: false as const, message: "Unauthorized" };

function revalidateLeague(group: unknown, week?: unknown): void {
  revalidatePath("/coach/fall-season");
  const g = parseGroup(group);
  if (!g) return;
  const w = parseWeek(week);
  revalidatePath(`/coach/fall-season/${seasonLeagueGroupSlug(g)}/${w ?? 6}`);
}

export async function previewDayAction(input: {
  group: string;
  week: number;
  presentIds: string[];
  rounds?: number | null;
}): Promise<DayPreview> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  return previewDay({ ...input, rounds: input.rounds ?? undefined });
}

export async function saveDayAction(input: {
  group: string;
  week: number;
  presentIds: string[];
  rounds?: number | null;
}): Promise<SaveDayResult> {
  const email = await requireCoach();
  if (!email) return { ...UNAUTHORIZED, created: 0, updated: 0, skipped: 0, failed: 0, voided: 0 };
  const result = await saveDay({ ...input, rounds: input.rounds ?? undefined });
  revalidateLeague(input.group, input.week);
  return result;
}

export async function recordScoreAction(input: {
  group: string;
  week: number;
  key: string;
  scoreA: number;
  scoreB: number;
  timed: boolean;
}): Promise<ScoreResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  const result = await recordGameScore(input);
  revalidateLeague(input.group, input.week);
  return result;
}

export async function previewTeamsAction(input: {
  group: string;
  presentIds: string[];
  teams?: Array<{ seed: number; members: string[] }>;
}): Promise<TeamsPreview> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  return previewTeams(input);
}

export async function lockTeamsAction(input: {
  group: string;
  presentIds: string[];
  teams?: Array<{ seed: number; members: string[] }>;
}): Promise<LockResult> {
  const email = await requireCoach();
  if (!email) return { ...UNAUTHORIZED, created: 0, updated: 0, failed: 0, voided: 0 };
  const result = await lockTeams(input);
  revalidateLeague(input.group, 6);
  return result;
}

export async function unlockTeamsAction(input: { group: string }): Promise<ScoreResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  const result = await unlockTeams(input);
  revalidateLeague(input.group, 6);
  return result;
}

export async function recordPlayoffScoreAction(input: {
  group: string;
  slot: string;
  scoreA: number;
  scoreB: number;
  timed: boolean;
}): Promise<ScoreResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  const result = await recordPlayoffScore(input);
  revalidateLeague(input.group, 6);
  return result;
}
