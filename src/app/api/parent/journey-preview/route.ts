import { NextRequest, NextResponse } from "next/server";
import { siteOrigin } from "@/lib/site-origin";
import { verifyParentPreviewCode } from "@/lib/nga-parent-preview";
import { runParentJourneyPreview } from "@/lib/nga-parent-preview-source";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization", "Referrer-Policy": "no-referrer" } });
export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization"), code = header?.startsWith("Bearer ") ? header.slice(7) : "";
  // No coach/admin/cancel/commit fallback and no source read before verification.
  if (!verifyParentPreviewCode(code)) return json(401, { error: "Unauthorized", code: "parent_preview_code_required" });
  if (req.headers.get("origin") !== siteOrigin()) return json(403, { ok: false, error: "bad_origin" });
  const text = await req.text();
  if (Buffer.byteLength(text) > 8192) return json(413, { error: "Request too large" });
  let body: unknown; try { body = JSON.parse(text); } catch { return json(400, { error: "Invalid JSON" }); }
  const result = await runParentJourneyPreview(code, body);
  return json(result.status, result.body);
}
