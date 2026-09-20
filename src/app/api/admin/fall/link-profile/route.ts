import { NextRequest, NextResponse } from "next/server";
import { isAdminCookieRequest } from "@/lib/session-ops-auth";
import { linkFallProfile } from "@/lib/admin-fall-actions";

export const runtime = "nodejs";

// Link a trial profile to the paid registration that followed it, from
// /admin/fall. Admin COOKIE only — there is no agent caller, so no Bearer path
// exists to leak. The body allowlist is exact: a typo is a 400, never a default
// that would move the wrong child's results.
export async function POST(req: NextRequest) {
  if (!isAdminCookieRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const fromPageId = str(body.fromPageId);
  const toPageId = str(body.toPageId);
  if (!fromPageId || !toPageId) {
    return NextResponse.json(
      { error: "fromPageId and toPageId are both required" },
      { status: 400 },
    );
  }

  const result = await linkFallProfile({ fromPageId, toPageId });
  if (result.ok) return NextResponse.json(result);

  const status =
    result.reason === "not_found"
      ? 404
      : result.reason === "config_missing" || result.reason === "query_failed" || result.reason === "write_failed"
        ? 502
        : 409;
  return NextResponse.json({ error: result.message, reason: result.reason }, { status });
}
