import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/coach-auth-server";
import { siteOrigin } from "@/lib/site-origin";
import { runCoachParentCapability } from "@/lib/nga-parent-preview-source";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie", "Referrer-Policy": "no-referrer" } });
export async function POST(req: NextRequest) {
  const coach = await requireCoach().catch(() => null);
  if (!coach) return json(401, { error: "Unauthorized" });
  if (req.headers.get("origin") !== siteOrigin()) return json(403, { ok: false, error: "bad_origin" });
  const text = await req.text();
  if (Buffer.byteLength(text) > 8192) return json(413, { error: "Request too large" });
  let body: unknown; try { body = JSON.parse(text); } catch { return json(400, { error: "Invalid JSON" }); }
  const result = await runCoachParentCapability(body, coach);
  if (await requireCoach().catch(() => null) !== coach) return json(401, { error: "Unauthorized" });
  return json(result.status, result.body);
}
