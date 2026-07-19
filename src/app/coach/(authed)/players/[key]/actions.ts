"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/coach-auth-server";
import { encodeParentKey } from "@/lib/player-profiles";
import {
  setPlayerLevel,
  isPlayerLevel,
  type PlayerLevel,
} from "@/lib/notion-player-bracket";

export interface SetBracketResult {
  ok: boolean;
  message: string;
  level?: PlayerLevel | "";
}

// Coach-auth-gated wrapper around the Player CRM Level write. The bracket
// (Red/Orange/Green/Yellow) is the durable, coach-owned per-child attribute; the
// write core (setPlayerLevel) touches ONLY the Level select and only egresses to
// Notion — pinned by invariant-player-bracket-egress.spec.ts.
export async function setPlayerBracketAction(input: {
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  parentName?: string;
  /** A ball color to assign, or null to clear the bracket. */
  level: PlayerLevel | null;
}): Promise<SetBracketResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };

  if (input.level !== null && !isPlayerLevel(input.level)) {
    return { ok: false, message: "Invalid bracket" };
  }
  if (!input.childFirstName?.trim()) {
    return { ok: false, message: "Missing player" };
  }

  const result = await setPlayerLevel({
    parentEmail: input.parentEmail || null,
    parentPhone: input.parentPhone || "",
    childFirstName: input.childFirstName,
    parentName: input.parentName,
    level: input.level,
  });

  if (result.ok) {
    const key = encodeParentKey(input.parentEmail, input.parentPhone);
    if (key) revalidatePath(`/coach/players/${key}`);
    revalidatePath("/coach/players");
  }
  return result;
}
