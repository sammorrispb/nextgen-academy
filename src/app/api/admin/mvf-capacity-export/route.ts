import { NextRequest, NextResponse } from "next/server";
import { isAdminCookieRequest } from "@/lib/session-ops-auth";
import { siteOrigin } from "@/lib/site-origin";
import { adminMvfCapacityExport, AdminMvfCapacityExportError } from "@/lib/admin-mvf-capacity-export";

export const runtime = "nodejs";
function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!isAdminCookieRequest(req)) return json(401, { ok: false, error: "unauthorized" });
  if (req.headers.get("origin") !== siteOrigin()) return json(403, { ok: false, error: "bad_origin" });
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return json(400, { ok: false, error: "bad_input" });
  const body = await req.text().catch(() => "");
  if (Buffer.byteLength(body, "utf8") > 16_384) return json(400, { ok: false, error: "bad_input" });
  let input: unknown;
  try { input = JSON.parse(body); } catch { return json(400, { ok: false, error: "bad_input" }); }
  try {
    return json(200, await adminMvfCapacityExport(input));
  } catch (error) {
    if (error instanceof AdminMvfCapacityExportError) return json(error.status, { ok: false, error: error.code });
    return json(502, { ok: false, error: "source_unavailable" });
  }
}
