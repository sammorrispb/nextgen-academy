import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { markAttendanceCore } from "@/lib/mark-attendance";
import type { AttendanceValue } from "@/lib/notion-dropins";

export const runtime = "nodejs";

interface AttendanceBody {
  checkoutSessionId?: string;
  attended?: AttendanceValue | "clear";
}

// Agent-callable day-of attendance check-in. Gives an out-of-band caller the
// SAME side-effect fan-out the coach UI toggle gets (markAttendanceAction) by
// routing through the shared markAttendanceCore, instead of writing the Notion
// roster row directly and silently skipping the OB activity + profile recompute.
//
// Auth: Bearer ATTENDANCE_SECRET (dedicated secret — isolates blast radius from
// NGA_ADMIN_SECRET). Fails CLOSED: a missing/unset secret rejects every call.
// The ack is PII-free (status only) — never echoes child/parent fields.
export async function POST(req: NextRequest) {
  const expected = process.env.ATTENDANCE_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!expected || !secretEquals(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AttendanceBody;
  try {
    body = (await req.json()) as AttendanceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const checkoutSessionId = body.checkoutSessionId?.trim();
  if (!checkoutSessionId) {
    return NextResponse.json(
      { error: "checkoutSessionId is required" },
      { status: 400 },
    );
  }
  if (
    body.attended !== "Present" &&
    body.attended !== "No-show" &&
    body.attended !== "clear"
  ) {
    return NextResponse.json(
      { error: "attended must be one of: Present, No-show, clear" },
      { status: 400 },
    );
  }

  const result = await markAttendanceCore({ checkoutSessionId, attended: body.attended });

  // Durability: await the OB ingest so the activity lands before the function
  // can freeze on Vercel. ingestToOpenBrain never throws (internal try/catch).
  if (result.obIngest) await result.obIngest;

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    if (result.message === "Failed to update Notion") {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  const status = result.attendance === "" ? "cleared" : result.attendance;
  return NextResponse.json({
    ok: true,
    pageId: result.pageId,
    status,
    idempotent: result.idempotent ?? false,
  });
}
