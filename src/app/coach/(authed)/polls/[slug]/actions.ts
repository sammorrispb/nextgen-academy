"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/coach-auth-server";
import {
  confirmCrew,
  type ConfirmCrewInput,
  type ConfirmCrewResult,
} from "@/lib/crew-confirm";

export type { ConfirmCrewInput, ConfirmCrewResult };

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
