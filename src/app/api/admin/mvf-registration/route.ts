import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionEmail } from "@/lib/admin-auth";
import { isAdminCookieRequest } from "@/lib/session-ops-auth";
import { siteOrigin } from "@/lib/site-origin";
import { adminMvfRegistration, AdminMvfRegistrationError } from "@/lib/admin-mvf-registration";

export const runtime = "nodejs";
function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!isAdminCookieRequest(req)) return json(401, { ok: false, error: "unauthorized" });
  if (req.headers.get("origin") !== siteOrigin()) return json(403, { ok: false, error: "bad_origin" });
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return json(400, { ok: false, error: "bad_input" });
  const body: unknown = await req.json().catch(() => null);
  const session = req.cookies.get(ADMIN_SESSION_COOKIE)!.value;
  try {
    return json(200, await adminMvfRegistration(body, session, verifyAdminSessionEmail(session)!));
  } catch (error) {
    if (error instanceof AdminMvfRegistrationError) return json(error.status, {
      ok: false, error: error.code, ...(error.errors ? { errors: error.errors } : {}), ...(error.waiverUrl ? { waiverUrl: error.waiverUrl } : {}),
    });
    return json(502, { ok: false, error: "request_failed" });
  }
}
