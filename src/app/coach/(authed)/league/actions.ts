"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/coach-auth-server";
import {
  checkIn,
  lockPlayoffTeams,
  planWeek,
  previewPlayoff,
  recordPlayoffScore,
  unlockPlayoffTeams,
  type PlayoffPreview,
  recordScore,
  removeGame,
  syncSeason,
  type Outcome,
  type PlanResult,
} from "@/lib/rotation-league/view";

// Thin coach-auth wrappers over @/lib/rotation-league/view: requireCoach first,
// fail closed, delegate, revalidate. No fetch lives here; the view re-validates
// every input against the season registry.

const UNAUTHORIZED = { ok: false as const, message: "Unauthorized" };

function revalidate(slug: unknown, week?: unknown): void {
  revalidatePath("/coach/league");
  if (typeof slug !== "string") return;
  revalidatePath(`/coach/league/${slug}`);
  if (week !== undefined) revalidatePath(`/coach/league/${slug}/${String(week)}`);
}

export async function syncRosterAction(input: {
  slug: string;
}): Promise<Outcome<{ sent: number; skipped: number; refused: number }>> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const result = await syncSeason(input.slug);
  revalidate(input.slug);
  return result;
}

export async function checkInAction(input: {
  slug: string;
  week: number;
  externalRef: string;
  present: boolean;
}): Promise<Outcome> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const result = await checkIn(input.slug, input.week, input.externalRef, input.present);
  revalidate(input.slug, input.week);
  return result;
}

export async function planAction(input: {
  slug: string;
  week: number;
  rounds: number | null;
  attempt: number;
  save: boolean;
}): Promise<Outcome<PlanResult>> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const result = await planWeek(input);
  if (input.save) revalidate(input.slug, input.week);
  return result;
}

export async function scoreAction(input: {
  slug: string;
  week: number;
  gameId: string;
  scoreA: number;
  scoreB: number;
  gameTarget: number;
  timed: boolean;
}): Promise<Outcome> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const result = await recordScore(input);
  revalidate(input.slug, input.week);
  return result;
}

export async function removeGameAction(input: {
  slug: string;
  week: number;
  gameId: string;
}): Promise<Outcome> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const result = await removeGame(input.slug, input.gameId);
  revalidate(input.slug, input.week);
  return result;
}

function revalidatePlayoff(slug: unknown): void {
  revalidatePath("/coach/league");
  if (typeof slug === "string") revalidatePath(`/coach/league/${slug}/playoff`);
}

export async function previewPlayoffAction(input: { slug: string }): Promise<Outcome<PlayoffPreview>> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  return previewPlayoff(input.slug);
}

export async function lockPlayoffAction(input: { slug: string; teams: string[][] }): Promise<Outcome> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const result = await lockPlayoffTeams(input.slug, input.teams);
  revalidatePlayoff(input.slug);
  return result;
}

export async function unlockPlayoffAction(input: { slug: string }): Promise<Outcome> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const result = await unlockPlayoffTeams(input.slug);
  revalidatePlayoff(input.slug);
  return result;
}

export async function playoffScoreAction(input: {
  slug: string;
  slot: string;
  scoreA: number;
  scoreB: number;
  gameTarget: number;
  timed: boolean;
}): Promise<Outcome> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const result = await recordPlayoffScore(input);
  revalidatePlayoff(input.slug);
  return result;
}
