"use server";

import { cookies } from "next/headers";
import { cancelDropIn } from "@/lib/cancel-dropin";
import {
  COACH_SESSION_COOKIE,
  verifySessionCookieValue,
} from "@/lib/coach-auth";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";

async function requireCoach(): Promise<string | null> {
  const c = await cookies();
  const value = c.get(COACH_SESSION_COOKIE)?.value;
  const email = value ? verifySessionCookieValue(value) : null;
  return email && isAllowedCoachEmail(email) ? email : null;
}

export interface CancelActionResult {
  ok: boolean;
  message: string;
}

export async function cancelRegistrationAction(
  checkoutSessionId: string,
): Promise<CancelActionResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };

  if (!checkoutSessionId?.trim()) {
    return { ok: false, message: "Missing checkoutSessionId" };
  }

  const result = await cancelDropIn(checkoutSessionId, "Cancelled");
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not_found"
          ? "Registration not found"
          : "Failed to update Notion",
    };
  }
  if (result.idempotent) {
    return { ok: true, message: "Already cancelled" };
  }
  return {
    ok: true,
    message: result.decremented ? "Cancelled · seat freed" : "Cancelled",
  };
}
