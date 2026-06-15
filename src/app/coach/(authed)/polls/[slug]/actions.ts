"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  COACH_SESSION_COOKIE,
  verifySessionCookieValue,
} from "@/lib/coach-auth";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";
import {
  confirmCrew,
  type ConfirmCrewInput,
  type ConfirmCrewResult,
} from "@/lib/crew-confirm";

export type { ConfirmCrewInput, ConfirmCrewResult };

async function requireCoach(): Promise<string | null> {
  const c = await cookies();
  const value = c.get(COACH_SESSION_COOKIE)?.value;
  const email = value ? verifySessionCookieValue(value) : null;
  return email && isAllowedCoachEmail(email) ? email : null;
}

export async function confirmCrewAction(
  input: ConfirmCrewInput,
): Promise<ConfirmCrewResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };

  const result = await confirmCrew(input);

  if (result.ok && result.slug) {
    revalidatePath(`/coach/polls/${result.slug}`);
    revalidatePath("/coach/polls");
  }
  return result;
}
