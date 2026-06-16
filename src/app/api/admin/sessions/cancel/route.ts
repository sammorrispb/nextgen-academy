import { NextRequest, NextResponse } from "next/server";
import { authorizeSessionOps } from "@/lib/session-ops-auth";
import {
  executeSessionCancel,
  type SessionCancelInput,
} from "@/lib/session-cancel";
import type { CancelReason } from "@/lib/email/session-cancelled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS: CancelReason[] = ["weather", "venue", "low-enrollment", "other"];

/** Admin cancel: refund every confirmed registrant + notify, then flip status.
 * Authorized by admin cookie (UI) OR Bearer SESSION_OPS_SECRET (agent); both
 * fail closed and run BEFORE the cancel engine (which moves money). */
export async function POST(req: NextRequest) {
  if (!authorizeSessionOps(req)) {
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
