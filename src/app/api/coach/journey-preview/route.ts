import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/coach-auth-server";
import { siteOrigin } from "@/lib/site-origin";
import { runNgaJourneyPreview } from "@/lib/nga-journey-source";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
/** Cookie + current allowlist only. Existing one-registration parent links and
 * operator send secrets deliberately grant no new family capability. */
export async function POST(req: NextRequest) {
  const coach = await requireCoach().catch(() => null);
  if (!coach) return json(401, { error: "Unauthorized", code: "coach_session_required" });
  if (req.headers.get("origin") !== siteOrigin()) return json(403, { ok: false, error: "bad_origin" });
  const text = await req.text();
  if (text.length > 8192) return json(413, { error: "Request too large" });
  let body: unknown; try { body = JSON.parse(text); } catch { return json(400, { error: "Invalid JSON" }); }
  const result = await runNgaJourneyPreview(body);
  if (await requireCoach().catch(() => null) !== coach) return json(401, { error: "Unauthorized", code: "coach_access_revoked" });
  return json(result.status, result.body);
}
