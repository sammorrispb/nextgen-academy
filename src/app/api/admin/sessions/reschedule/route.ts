import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionEmail } from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import {
  executeSessionReschedule,
  type RescheduleInput,
} from "@/lib/session-reschedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin reschedule: carry every paid spot to a new date/time + notify. No
 * refund. Auth gate runs BEFORE the engine (which mutates child rows). */
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
