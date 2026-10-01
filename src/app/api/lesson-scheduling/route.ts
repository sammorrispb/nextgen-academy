import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { runLessonScheduling } from "@/lib/lesson-scheduling";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const secret = process.env.NGA_LESSON_SCHEDULING_SECRET;
  if (!secret || secret.length < 32 || secret.trim() !== secret
    || !secretEquals(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw = await request.text();
  if (raw.length > 4096) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const result = await runLessonScheduling(body);
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
