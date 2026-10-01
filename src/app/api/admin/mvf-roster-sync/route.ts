import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { isAdminCookieRequest } from "@/lib/session-ops-auth";
import { resendMvfRoster, ResendRefusal } from "@/lib/admin-mvf-roster-resend";
import { siteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";
function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (!isAdminCookieRequest(req)) return json(401, { ok: false, error: "unauthorized" });
  if (req.headers.get("origin") !== siteOrigin()) return json(403, { ok: false, error: "bad_origin" });
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return json(400, { ok: false, error: "bad_input" });
  }
  const input: unknown = await req.json().catch(() => null);
  if (!input || typeof input !== "object" || Array.isArray(input)) return json(400, { ok: false, error: "bad_input" });
  const body = input as Record<string, unknown>;
  const keys = Object.keys(body);
  if (typeof body.invoiceId !== "string" || !/^in_[A-Za-z0-9]{1,100}$/.test(body.invoiceId) ||
    (body.action !== "preview" && body.action !== "replay") ||
    keys.some((key) => !["invoiceId", "action", "previewToken"].includes(key)) ||
    (body.action === "preview" && "previewToken" in body) ||
    (body.action === "replay" && (typeof body.previewToken !== "string" || body.previewToken.length > 100))) {
    return json(400, { ok: false, error: "bad_input" });
  }
  try {
    return json(200, await resendMvfRoster({ invoiceId: body.invoiceId, action: body.action,
      previewToken: body.previewToken as string | undefined }, req.cookies.get(ADMIN_SESSION_COOKIE)!.value));
  } catch (error) {
    // Never return/log upstream bodies or exception messages: Notion and L&D
    // failures may carry a child's identity or an authorization header.
    return error instanceof ResendRefusal
      ? json(error.status, { ok: false, error: error.code })
      : json(502, { ok: false, error: "request_failed" });
  }
}
