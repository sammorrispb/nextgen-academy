import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionEmail } from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import {
  executeSessionCancel,
  type SessionCancelInput,
} from "@/lib/session-cancel";
import type { CancelReason } from "@/lib/email/session-cancelled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS: CancelReason[] = ["weather", "venue", "low-enrollment", "other"];

/** Admin cancel: refund every confirmed registrant + notify, then flip status.
 * Auth gate runs BEFORE the cancel engine (which moves money) — fails closed. */
function adminEmail(req: NextRequest): string | null {
  try {
    const e = verifyAdminSessionEmail(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    return e && isAllowedAdminEmail(e) ? e : null;
  } catch {
    return null; // unset signing secret / malformed token → fail closed
  }
}

export async function POST(req: NextRequest) {
  if (!adminEmail(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<SessionCancelInput>;
  try {
    body = (await req.json()) as Partial<SessionCancelInput>;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { sessionRowId, sessionTitle, sessionDate, sessionStartTime, reason, note } = body;
  if (!sessionRowId || !sessionTitle || !sessionDate || !sessionStartTime) {
    return NextResponse.json(
      { error: "sessionRowId, sessionTitle, sessionDate, sessionStartTime are required" },
      { status: 400 },
    );
  }
  if (!reason || !REASONS.includes(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

  const result = await executeSessionCancel({
    sessionRowId,
    sessionTitle,
    sessionDate,
    sessionStartTime,
    reason,
    note,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
