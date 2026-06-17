import { NextRequest, NextResponse } from "next/server";
import { authorizeSessionOps } from "@/lib/session-ops-auth";
import {
  cancelAllLevelsForDate,
  type GroupCancelInput,
} from "@/lib/session-cancel-group";
import type { CancelReason } from "@/lib/email/session-cancelled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS: CancelReason[] = ["weather", "venue", "low-enrollment", "other"];

/**
 * Cancel every level row of a multi-row session day in one call — refund every
 * confirmed registrant on every level + notify, then flip each row to
 * Cancelled. Same `authorizeSessionOps` gate as the single-row cancel (admin
 * cookie OR Bearer SESSION_OPS_SECRET); both fail closed and run BEFORE the
 * engine moves money.
 */
export async function POST(req: NextRequest) {
  if (!authorizeSessionOps(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<GroupCancelInput>;
  try {
    body = (await req.json()) as Partial<GroupCancelInput>;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { date, reason, note, titlePrefixes } = body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "A valid date (YYYY-MM-DD) is required" },
      { status: 400 },
    );
  }
  if (!reason || !REASONS.includes(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

  const result = await cancelAllLevelsForDate({ date, reason, note, titlePrefixes });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
