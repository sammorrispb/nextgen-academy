import { NextRequest, NextResponse } from "next/server";
import { authorizeSessionOps } from "@/lib/session-ops-auth";
import {
  executeSessionReschedule,
  type RescheduleInput,
} from "@/lib/session-reschedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin reschedule: carry every paid spot to a new date/time + notify. No
 * refund. Authorized by admin cookie (UI) OR Bearer SESSION_OPS_SECRET (agent);
 * both fail closed and run BEFORE the engine (which mutates child rows). */
export async function POST(req: NextRequest) {
  if (!authorizeSessionOps(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<RescheduleInput>;
  try {
    body = (await req.json()) as Partial<RescheduleInput>;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const {
    sessionRowId,
    sessionTitle,
    oldDate,
    oldStartTime,
    newDate,
    newStartTime,
    newEndTime,
  } = body;
  if (!sessionRowId || !sessionTitle || !newDate || !newStartTime) {
    return NextResponse.json(
      { error: "sessionRowId, sessionTitle, newDate, newStartTime are required" },
      { status: 400 },
    );
  }

  const result = await executeSessionReschedule({
    sessionRowId,
    sessionTitle,
    oldDate: oldDate ?? "",
    oldStartTime: oldStartTime ?? "",
    newDate,
    newStartTime,
    newEndTime: newEndTime ?? "",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
