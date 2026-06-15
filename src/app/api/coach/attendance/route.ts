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
 * Gated by `Authorization: Bearer ATTENDANCE_SECRET` (constant-time compare,
 * fails CLOSED). The secret is dedicated — NOT NGA_ADMIN_SECRET — so this
 * minor-PII write can't ride the mega-secret's blast radius, and it travels in
 * a header rather than the query string (no access-log exposure).
 *
 * Body (JSON): `{ checkoutSessionId, attended }` where `attended` is
 * "Present" | "No-show" | "clear". The ack is PII-free (status only).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.ATTENDANCE_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!expected || !secretEquals(auth, `Bearer ${expected}`)) {
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

  // Durability: await the OB ingest so the activity lands before this function
  // can freeze on Vercel. ingestToOpenBrain never throws (internal try/catch).
  if (result.obIngest) await result.obIngest;

  if (!result.ok) {
    const status = result.message === "Registration not found" ? 404 : 400;
    return NextResponse.json({ error: result.message }, { status });
  }

  // PII-free ack — status only, never child/parent fields.
  return NextResponse.json({
    ok: true,
    status: result.attendance === "" ? "cleared" : result.attendance,
    idempotent: result.idempotent ?? false,
  });
}
