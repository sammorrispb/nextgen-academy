"use server";

import { cancelDropIn } from "@/lib/cancel-dropin";
import { verifyCancelToken } from "@/lib/cancel-token";

export interface SelfCancelResult {
  ok: boolean;
  message: string;
}

export async function selfCancelAction(
  token: string,
): Promise<SelfCancelResult> {
  const cs = verifyCancelToken(token);
  if (!cs) {
    return {
      ok: false,
      message:
        "This link isn't valid. Reply to your confirmation email or text Sam at 301-325-4731 and we'll help.",
    };
  }

  const result = await cancelDropIn(cs, "Cancelled");
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not_found"
          ? "We couldn't find this reservation. It may have already been cancelled."
          : "Something went wrong. Please reply to your confirmation email or text Sam at 301-325-4731.",
    };
  }

  if (result.idempotent) {
    return { ok: true, message: "This reservation was already cancelled." };
  }

  return {
    ok: true,
    message:
      "Cancelled. We freed your seat for another player. Thanks for letting us know.",
  };
}
