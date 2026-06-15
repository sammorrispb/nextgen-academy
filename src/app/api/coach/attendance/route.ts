import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { applyAttendance } from "@/lib/attendance";
import type { AttendanceValue } from "@/lib/notion-dropins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agent-callable attendance check-in — the secret-gated twin of the coach
 * dashboard's `markAttendanceAction`. Both funnel through `applyAttendance()`,
 * so a back-office agent hitting this endpoint fires the IDENTICAL fan-out a
 * coach gets from the button (Notion `Attendance` + Open Brain `nga_attendance`
 * activity + player-profile stat recompute) instead of writing the Notion row
 * directly and silently dropping the rest.
 *
 * Gated by `NGA_ADMIN_SECRET` (`?secret=` or `x-admin-secret` header) with a
 * constant-time compare — fails CLOSED, mirroring the eval / admin-curl routes.
 *
 * Body (JSON): `{ checkoutSessionId, attended }` where `attended` is
 * "Present" | "No-show" | "clear".
 */
export async function POST(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-admin-secret");
  if (!secretEquals(secret, process.env.NGA_ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { checkoutSessionId?: string; attended?: AttendanceValue | "clear" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.checkoutSessionId?.trim()) {
    return NextResponse.json({ error: "Missing checkoutSessionId" }, { status: 400 });
  }
  const attended = body.attended;
  if (attended !== "Present" && attended !== "No-show" && attended !== "clear") {
    return NextResponse.json(
      { error: "attended must be 'Present', 'No-show', or 'clear'" },
      { status: 400 },
    );
  }

  const result = await applyAttendance({
    checkoutSessionId: body.checkoutSessionId,
    attended,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
